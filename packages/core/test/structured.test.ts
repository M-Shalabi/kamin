import { describe, expect, test } from "bun:test";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { extractCandidate, invokeStructured } from "../src/models/structured";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HsChoiceLoose, NormalizedSpecLoose } from "../src/coordinator/loose";

describe("extractCandidate", () => {
  const schema = z.object({ a: z.number() });
  test("prefers the first tool call's arguments", () => {
    const msg = new AIMessage({ content: "", tool_calls: [{ name: "out", args: { a: 1 }, id: "x", type: "tool_call" }] });
    expect(extractCandidate(msg)).toEqual({ a: 1 });
  });
  test("falls back to JSON in the content", () => {
    expect(extractCandidate(new AIMessage({ content: '{"a": 2}' }))).toEqual({ a: 2 });
  });
  test("strips code fences and leading prose", () => {
    expect(extractCandidate(new AIMessage({ content: 'Here you go:\n```json\n{"a": 3}\n```' }))).toEqual({ a: 3 });
  });
  test("revives nested JSON strings inside tool-call arguments, leaving plain strings alone", () => {
    const msg = new AIMessage({ content: "", tool_calls: [{ name: "out", args: { items: '[{"x": 1}]', meta: '{"k": "v"}', plain: "text", num: "5", nested: { deep: '["a"]' } }, id: "x", type: "tool_call" }] });
    expect(extractCandidate(msg)).toEqual({ items: [{ x: 1 }], meta: { k: "v" }, plain: "text", num: "5", nested: { deep: ["a"] } });
  });
  test("returns undefined when nothing parses", () => {
    expect(extractCandidate(new AIMessage({ content: "no json here" }))).toBeUndefined();
    expect(schema.safeParse(undefined).success).toBe(false);
  });
});

describe("NormalizedSpecLoose", () => {
  test("fills missing nullable keys, coerces numeric strings and canonicalises free-text enums", () => {
    const r = NormalizedSpecLoose.parse({
      object_class: "Gate Valve", object_family: "Valves", size_inch: "4", material: "cast iron", connection: "flange",
      extra_attrs: { standard: "BS 5163", face: "RF" }, english_description: "4 inch cast iron gate valve", source_language: "english",
    });
    expect(r.size_inch).toBe(4);
    expect(r.size_dn).toBeNull();
    expect(r.object_family).toBe("valve");
    expect(r.material).toBe("cast_iron");
    expect(r.connection).toBe("flanged");
    expect(r.pressure_bar).toBeNull();
    expect(r.standard).toBeNull();
    expect(r.extra_attrs).toEqual([{ key: "standard", value: "BS 5163" }, { key: "face", value: "RF" }]);
    expect(r.source_language).toBe("en");
  });
  test("infers the family from the object class when the model gives garbage", () => {
    const r = NormalizedSpecLoose.parse({ object_class: "butt weld elbow", object_family: "pipe part", english_description: "elbow" });
    expect(r.object_family).toBe("fitting");
    expect(NormalizedSpecLoose.parse({ object_class: "weld neck flange", object_family: "x", english_description: "f" }).object_family).toBe("flange");
    expect(NormalizedSpecLoose.parse({ object_class: "centrifugal pump", english_description: "p" }).object_family).toBe("pump");
  });
  test("unknown materials become null rather than failing", () => {
    expect(NormalizedSpecLoose.parse({ object_class: "valve", english_description: "v", material: "unobtainium" }).material).toBeNull();
  });
});

describe("HsChoiceLoose", () => {
  test("accepts a numeric hs6 and a string confidence", () => {
    expect(HsChoiceLoose.parse({ hs6: 848180, confidence: "0.85", reasoning: "r" })).toEqual({ hs6: "848180", confidence: 0.85, reasoning: "r" });
  });
  test("accepts dotted codes and clamps confidence", () => {
    expect(HsChoiceLoose.parse({ hs6: "8481.80", confidence: 1.4, reasoning: "" })).toEqual({ hs6: "848180", confidence: 1, reasoning: "" });
  });
});

describe("invokeStructured preferJsonText", () => {
  test("skips tool binding entirely and asks for JSON text from the first call", async () => {
    const calls: string[] = [];
    const fake = {
      bindTools: () => { calls.push("bind"); return { invoke: async () => { calls.push("tool"); return new AIMessage({ content: "" }); } }; },
      invoke: async (msgs: { content: unknown }[]) => { calls.push("plain"); expect(String(msgs[0]!.content)).toContain("JSON schema"); return new AIMessage({ content: '{"a": 7}' }); },
    } as unknown as BaseChatModel;
    const r = await invokeStructured(fake, [], { name: "out", toolSchema: z.object({ a: z.number() }), parseSchema: z.object({ a: z.number() }), preferJsonText: true });
    expect(r).toEqual({ a: 7 });
    expect(calls).toEqual(["plain"]);
  });
});

describe("invokeStructured fallback", () => {
  test("falls back to JSON-in-text when the provider rejects the tool call as malformed XML", async () => {
    const calls: string[] = [];
    const fake = {
      bindTools: () => ({ invoke: async () => { calls.push("tool"); throw new Error("XML syntax error on line 14: element <parameter> closed by </function>"); } }),
      invoke: async (msgs: { content: unknown }[]) => { calls.push("plain"); expect(String(msgs[0]!.content)).toContain("JSON"); return new AIMessage({ content: '{"a": 42}' }); },
    } as unknown as BaseChatModel;
    const r = await invokeStructured(fake, [], { name: "out", toolSchema: z.object({ a: z.number() }), parseSchema: z.object({ a: z.number() }) });
    expect(r).toEqual({ a: 42 });
    expect(calls).toEqual(["tool", "plain"]);
  });
});
