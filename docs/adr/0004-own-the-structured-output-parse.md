# Own the structured-output parse instead of trusting provider JSON mode

Agents need typed output from whichever model a role runs on, and the first role runs on a local Qwen 3.5 9B through Ollama. We found on 2026-09-02 that this Ollama build does not enforce a JSON schema grammar for that model: with `format` set to the schema the model still invents field names, and with the library's default `withStructuredOutput` path the run dies on an empty or malformed object. We chose to own the loop in `packages/core/src/models/structured.ts`: the strict zod schema is shown to the model as a tool, the reply is taken from the tool call or from JSON in the text, validated against a lenient schema that coerces what small models actually produce (missing nullable keys, numeric strings, free-text enums, an object where an array was asked for), and retried once with the validation issues fed back.

## Considered options

- **`withStructuredOutput` with the `jsonSchema` method**: depends on grammar enforcement that is absent here.
- **`withStructuredOutput` with the `functionCalling` method**: the model sees the schema, but the parser rejects any deviation, and a 9B model deviates on one line in five.

## Consequences

The strict schema stays the contract for the database and the UI; only parsing is lenient. When a role moves to Claude or OpenAI the same helper works unchanged, because every wired provider supports tool binding.
