import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kamin/core"],
  serverExternalPackages: ["postgres", "playwright", "p-limit", "@langchain/core", "@langchain/langgraph", "@langchain/ollama", "@langchain/anthropic", "@langchain/openai", "@langchain/deepseek"],
};
export default nextConfig;
