import { describe, expect, test } from "bun:test";
import { getChatModel, getEmbeddings, modelRefFor, ollamaUp, parseModelRef } from "../src/models/registry";

describe("parseModelRef", () => {
  test("splits provider from a model name that itself contains colons", () => {
    expect(parseModelRef("ollama:qwen3.5:9b")).toEqual({ provider: "ollama", model: "qwen3.5:9b" });
    expect(parseModelRef("anthropic:claude-opus-5")).toEqual({ provider: "anthropic", model: "claude-opus-5" });
    expect(parseModelRef("deepseek:deepseek-chat")).toEqual({ provider: "deepseek", model: "deepseek-chat" });
  });
  test("rejects unknown providers", () => {
    expect(() => parseModelRef("gemini:pro")).toThrow();
  });
  test("modelRefFor reads ROLE_MODEL from env with an ollama default", () => {
    process.env.AUDITOR_MODEL = "ollama:qwen3:8b";
    expect(modelRefFor("auditor")).toBe("ollama:qwen3:8b");
    delete process.env.DETECTIVE_MODEL;
    expect(modelRefFor("detective")).toBe("ollama:qwen3.5:9b");
  });
});

describe.skipIf(!(await ollamaUp()))("ollama models", () => {
  test("embeds a query to 1024 dims with bge-m3", async () => {
    const v = await getEmbeddings().embedQuery("ball valve");
    expect(v).toHaveLength(1024);
  }, 60_000);
  test("the coordinator chat model answers", async () => {
    const res = await getChatModel("coordinator").invoke("Reply with the single word: ready /no_think");
    expect(String(res.content).toLowerCase()).toContain("ready");
  }, 180_000);
});
