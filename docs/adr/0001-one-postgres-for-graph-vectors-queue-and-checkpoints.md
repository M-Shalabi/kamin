# One Postgres for the graph, vectors, queue and checkpoints

KAMIN's product is a capability graph, which suggests a graph database. We chose Postgres with pgvector as the single store: the node types are tables, foreign keys are the edges, embeddings for cross-lingual specification matching live in the same database, and the agent job queue (pg-boss) and LangGraph checkpoints sit alongside. The deepest query in the design is two hops (supplier to capability to evidence), specification matching is a vector search rather than a traversal, and one database is one thing to run on a laptop on stage and one seam for anyone writing ingest in another language.

## Considered options

- **Neo4j**: true traversal and Cypher, but an extra service, no vector matching without plugins, and nobody on the team runs it.
- **SQLite plus a vector file**: no concurrent writers, which a swarm of agents and a live write-back on stage both need.

## Consequences

If adjacency inference ever needs deep traversals, that is a projection built from Postgres, not a migration away from it.

**Note, 2026-09-02, after milestone 2.** The pg-boss queue is deferred. Every model call goes through one
local Ollama, which serialises inference, so a queue would only reorder a line that is already single-file.
The swarm is a resumable script (`bun run swarm [n]`) that skips suppliers whose Detective status is
already `ok` and capabilities already audited; interrupting it and starting again is the whole recovery
story. pg-boss comes back the day two or more model backends run at once.

**Note, 2026-09-03, the explicit graph.** Typed relations between entities (brand distributed, parent
group, certifier, standard, material, process) live in a `relations` edge table in the same Postgres,
each edge with its source and excerpt, written by the Specifier from catalogue pages. Traversal is
recursive SQL; an in-memory projection serves the Advisor if adjacency reasoning ever needs depth. A
graph database stays out of scope at fifteen thousand supplier nodes.
