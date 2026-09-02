# Trajectories are product data; Langfuse is dev-only

Every agent run writes its steps (model calls, tool calls, pages read, intermediate claims) into Postgres as first-class records, because the evidence drill-down screen and the live cold-miss both render a trajectory, and a judge asking "how do you know" is answered by that record. On top of this, Langfuse runs self-hosted in Docker for dev-time inspection and for scoring the Coordinator spike, and a terminal stream prints every step of a run as it happens. Langfuse can be switched off without losing anything the product needs; the Postgres trajectory cannot.

## Considered options

- **Tracing tool only** (LangSmith or Langfuse): full detail for developers, but provenance would live outside the graph and disappear with the tool.
- **Self-hosted Langfuse only, no in-graph trajectory**: same problem; and traces are not queryable alongside capabilities.
