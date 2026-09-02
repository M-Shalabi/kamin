import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage, type AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

/** Pull a JSON-like candidate out of a model reply: the first tool call's arguments, else JSON found in the text. */
export function extractCandidate(msg: AIMessage): unknown {
  const tc = msg.tool_calls?.[0];
  if (tc?.args && Object.keys(tc.args).length) return tc.args;
  const text = typeof msg.content === "string" ? msg.content : msg.content.map((c) => ("text" in c ? String((c as { text: unknown }).text) : "")).join("\n");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export type StructuredOptions<T> = {
  name: string;
  description?: string;
  toolSchema: z.ZodType;
  parseSchema: z.ZodType<T>;
  config?: RunnableConfig;
  maxRetries?: number;
  onRetry?: (issues: string) => Promise<void> | void;
};

/**
 * Structured output that does not trust the provider: the model sees the strict schema as a tool,
 * the reply is parsed from a tool call or from JSON text, validated with a lenient schema, and
 * retried once with the validation issues fed back.
 */
export async function invokeStructured<T>(model: BaseChatModel, messages: BaseMessage[], opts: StructuredOptions<T>): Promise<T> {
  const jsonSchema = z.toJSONSchema(opts.toolSchema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  if (!model.bindTools) throw new Error("model does not support tool binding");
  const tooled = model.bindTools([{ type: "function", function: { name: opts.name, description: opts.description ?? `Return the ${opts.name}`, parameters: jsonSchema } }]);
  const history: BaseMessage[] = [...messages];
  let lastIssues = "";
  const jsonInstruction = new SystemMessage(`Respond with only one JSON object and nothing else. It must match this JSON schema exactly, with every property present and null for unknown values:\n${JSON.stringify(jsonSchema)}`);
  let useJsonText = false;
  for (let attempt = 0; attempt <= (opts.maxRetries ?? 1); attempt++) {
    let msg: AIMessage;
    if (useJsonText) {
      msg = (await model.invoke([jsonInstruction, ...history], opts.config)) as AIMessage;
    } else {
      try {
        msg = (await tooled.invoke(history, opts.config)) as AIMessage;
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
    const parsed = opts.parseSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
    lastIssues = candidate === undefined
      ? "no JSON object or tool call was found in the reply"
      : parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    await opts.onRetry?.(lastIssues);
    history.push(msg, new HumanMessage(`Your previous reply did not match the required schema: ${lastIssues}. ${useJsonText ? "Reply again with only the corrected JSON object" : `Call the ${opts.name} tool again`} with every field present, using null for unknown values. /no_think`));
  }
  throw new Error(`structured output failed for ${opts.name}: ${lastIssues}`);
}
