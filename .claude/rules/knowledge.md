# Knowledge Files

`.claude/knowledge/` contains service context that is NOT auto-loaded.
Do NOT read all files upfront — read only what your task requires.

## Inventory

| File | Contains | Read when |
|------|----------|-----------|
| `api-endpoints.md` | HTTP routes, gRPC services, Kafka topics | Adding/modifying routes or API calls |
| `data-models.md` | Entity structs, fields, validation, errors | Working with entities or DB models |
| `databases.md` | DB connections, table schemas, migrations | DB queries, migrations, new tables |
| `integrations.md` | External service clients, protocols | Touching external service calls |
| `config.md` | Environment variables, config structs | Adding env vars or config fields |
| `routing.md` | Frontend routes and navigation | Adding/modifying pages or routes |
| `api-services.md` | API service layer documentation | Adding/modifying API service calls |

Additional files may exist (e.g., `flow-engine.md`, `multi-tenancy.md`, `auth-flow.md`).
Run `Glob(".claude/knowledge/*.md")` to discover them.

## Rules

- Read the file(s) relevant to your task BEFORE making changes in that area
- When delegating to sub-agents, tell them WHICH knowledge files to read (not "all")
- After creating new domains, update the relevant knowledge file
