import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

export type Provider = "ollama" | "anthropic" | "openai" | "deepseek";
export type Role = "coordinator" | "detective" | "specifier" | "auditor" | "advisor";
const PROVIDERS: Provider[] = ["ollama", "anthropic", "openai", "deepseek"];
const DEFAULT_CHAT = "ollama:qwen3.5:9b";
const DEFAULT_EMBED = "ollama:bge-m3";

export const ollamaHost = () => process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export function parseModelRef(ref: string): { provider: Provider; model: string } {
  const i = ref.indexOf(":");
  if (i < 0) throw new Error(`model ref must look like provider:model, got ${ref}`);
  const provider = ref.slice(0, i) as Provider;
  if (!PROVIDERS.includes(provider)) throw new Error(`unknown provider ${provider}`);
  return { provider, model: ref.slice(i + 1) };
}

export function modelRefFor(role: Role): string {
  return process.env[`${role.toUpperCase()}_MODEL`] ?? DEFAULT_CHAT;
}

export function getChatModel(role: Role): BaseChatModel {
  const { provider, model } = parseModelRef(modelRefFor(role));
  switch (provider) {
    case "ollama": return new ChatOllama({ model, baseUrl: ollamaHost(), temperature: 0, numCtx: 8192, think: false });
    case "anthropic": return new ChatAnthropic({ model, temperature: 0 });
    case "openai": return new ChatOpenAI({ model, temperature: 0 });
    case "deepseek": return new ChatDeepSeek({ model, temperature: 0 });
  }
}

export function getEmbeddings(): Embeddings {
  const { provider, model } = parseModelRef(process.env.EMBEDDING_MODEL ?? DEFAULT_EMBED);
  if (provider !== "ollama") throw new Error(`only ollama embeddings are wired in milestone 1, got ${provider}`);
  return new OllamaEmbeddings({ model, baseUrl: ollamaHost() });
}

export async function ollamaUp(): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
