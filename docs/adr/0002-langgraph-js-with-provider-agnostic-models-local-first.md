# LangGraph.js with a provider-agnostic model registry, local models first

Agents fan out across hundreds of entities and must run on a local Ollama model during the build, then switch per role to Claude, OpenAI or DeepSeek without code changes. We chose LangGraph.js (TypeScript) for the agent runtimes, with a registry that maps each role to a provider and model from the environment. Ollama with Qwen3.5 9B is the default chat model (Mohammed's call: it was already on the machine and it is the newer model), bge-m3 through Ollama is the embedding model, and Tavily is the search tool because local models have no built-in web search. Per-role swapping is what lets the twenty-line Coordinator spike choose models on measured evidence rather than assumption, and open weights keep an in-Kingdom hosting story available for the pitch.

## Considered options

- **Anthropic SDK directly**: the best access to Claude-specific features (server-side web search, caching), but a single vendor and no local path.
- **Hand-rolled loop plus a provider SDK each**: less abstraction, but re-implements tool loops, streaming and structured output per provider.

## Consequences

LangGraph calls every workflow a "graph". In this codebase the graph is only the capability graph; agent workflows are called runs, in code and in conversation.
