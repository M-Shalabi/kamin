import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, type AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

/**
 * Ollama's tool-call parser for Qwen hands nested arrays and objects over as JSON *strings*
 * (`"capabilities": "[{...}]"`). Walk the value and parse any string that is itself JSON, so a
 * schema sees the structure the model meant. Plain strings, including numeric ones, stay strings.
 */
export function reviveJsonStrings(v: unknown): unknown {
  if (typeof v === "string") {
    if (!/^\s*[\[{]/.test(v)) return v;
    try { return reviveJsonStrings(JSON.parse(v)); } catch { return v; }
  }
  if (Array.isArray(v)) return v.map(reviveJsonStrings);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, reviveJsonStrings(x)]));
  return v;
}

/**
 * Parse JSON that a small model almost got right. Qwen regularly drops one closing brace before a
 * trailing top-level key, and a reply can be cut off mid-string. Try the text as is, then a single
 * `}` inserted before each trailing `,"key"` from the end, then closing every open string, bracket
 * and brace. Returns undefined when nothing yields an object.
 */
export function parseJsonLoosely(text: string): unknown {
  const attempt = (t: string): unknown => { try { const v = JSON.parse(t); return v && typeof v === "object" ? v : undefined; } catch { return undefined; } };
  const direct = attempt(text);
  if (direct !== undefined) return direct;
  const cutOff = !text.trimEnd().endsWith("}");
  const insertBrace = (): unknown => {
    const commas = [...text.matchAll(/,\s*"[^"]+"\s*:/g)].map((m) => m.index!).reverse();
    for (const i of commas.slice(0, 12)) {
      const fixed = attempt(`${text.slice(0, i)}}${text.slice(i)}`);
      if (fixed !== undefined) return fixed;
    }
    return undefined;
  };
  // A reply that ends with a brace is complete but unbalanced: a brace was dropped before a trailing key.
  if (!cutOff) { const fixed = insertBrace(); if (fixed !== undefined) return fixed; }
  // Cut-off reply: close an open string, drop a dangling partial token, then balance brackets.
  let t = text.replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
  const quotes = (t.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 === 1) t += '"';
  t = t.replace(/,\s*"[^"]*"\s*:?\s*$/, "");
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (inString) { if (ch === "\\") i++; else if (ch === '"') inString = false; continue; }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  const closed = attempt(t + stack.reverse().join(""));
  return closed !== undefined ? closed : cutOff ? insertBrace() : undefined;
}

/** Pull a JSON-like candidate out of a model reply: the first tool call's arguments, else JSON found in the text. */
export function extractCandidate(msg: AIMessage): unknown {
  const tc = msg.tool_calls?.[0];
  if (tc?.args && Object.keys(tc.args).length) return reviveJsonStrings(tc.args);
  const text = typeof msg.content === "string" ? msg.content : msg.content.map((c) => ("text" in c ? String((c as { text: unknown }).text) : "")).join("\n");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  if (start < 0) return undefined;
  const whole = body.slice(start).trimEnd();
  const end = whole.lastIndexOf("}");
  // A reply that stops after its last brace is taken up to that brace; a reply cut off mid-string is repaired whole.
  const parsed = whole.endsWith("}") ? parseJsonLoosely(whole.slice(0, end + 1)) : parseJsonLoosely(whole);
  return parsed === undefined ? undefined : reviveJsonStrings(parsed);
}

export type StructuredOptions<T> = {
  name: string;
  description?: string;
  toolSchema: z.ZodType;
  parseSchema: z.ZodType<T>;
  config?: RunnableConfig;
  maxRetries?: number;
  onRetry?: (issues: string) => Promise<void> | void;
  /** Ask for JSON text from the first call instead of binding a tool. Set for roles whose long free-text fields trip Ollama's tool-call parser. */
  preferJsonText?: boolean;
};

/**
 * Structured output that does not trust the provider: the model sees the strict schema as a tool,
 * the reply is parsed from a tool call or from JSON text, validated with a lenient schema, and
 * retried once with the validation issues fed back.
 */
export async function invokeStructured<T>(model: BaseChatModel, messages: BaseMessage[], opts: StructuredOptions<T>): Promise<T> {
  const jsonSchema = z.toJSONSchema(opts.toolSchema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  if (!opts.preferJsonText && !model.bindTools) throw new Error("model does not support tool binding");
  const tooled = opts.preferJsonText ? null : model.bindTools!([{ type: "function", function: { name: opts.name, description: opts.description ?? `Return the ${opts.name}`, parameters: jsonSchema } }]);
  const history: BaseMessage[] = [...messages];
  let lastIssues = "";
  const jsonInstruction = new SystemMessage(`Respond with only one JSON object and nothing else. It must match this JSON schema exactly, with every property present and null for unknown values:\n${JSON.stringify(jsonSchema)}`);
  let useJsonText = !!opts.preferJsonText;
  for (let attempt = 0; attempt <= (opts.maxRetries ?? 1); attempt++) {
    let msg: AIMessage;
    if (useJsonText) {
      msg = (await model.invoke([jsonInstruction, ...history], opts.config)) as AIMessage;
    } else {
      try {
        msg = (await tooled!.invoke(history, opts.config)) as AIMessage;
      } catch (err) {
        // Ollama parses Qwen's XML-shaped tool calls itself and rejects malformed ones; the plain JSON path avoids that template.
        if (/xml|tool call|parameter|function/i.test(String((err as Error).message))) {
          await opts.onRetry?.(`provider rejected the tool call: ${(err as Error).message.slice(0, 120)}; retrying as JSON text`);
          useJsonText = true;
          attempt--;
          continue;
        }
        throw err;
      }
    }
    const candidate = extractCandidate(msg);
    // A reply with no JSON object at all never reaches the schema: a lenient schema would accept it as empty and hide the failure.
    const parsed = candidate === undefined ? null : opts.parseSchema.safeParse(candidate);
    if (parsed?.success) return parsed.data;
    lastIssues = !parsed
      ? "no JSON object or tool call was found in the reply"
      : parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    await opts.onRetry?.(lastIssues);
    history.push(msg, new HumanMessage(`Your previous reply did not match the required schema: ${lastIssues}. ${useJsonText ? "Reply again with only the corrected JSON object" : `Call the ${opts.name} tool again`} with every field present, using null for unknown values. /no_think`));
  }
  throw new Error(`structured output failed for ${opts.name}: ${lastIssues}`);
}
