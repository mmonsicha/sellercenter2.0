---
name: generate-readme
description: Sellsuki README Standard — structure, good/bad examples, and a checklist for creating or updating README.md for any Sellsuki service.
---

# Sellsuki README Standard

This skill defines the README.md standard for all Sellsuki services.
Use it with the `readme-generator` agent or as a reference when writing a README manually.

---

## Required Structure

Every README.md must contain the following sections in this order:

```
1. Project Name
2. Requirements
3. Project Overview
4. Key Features
5. Used By
6. Project Instruction
   6.1 Clone Repository
   6.2 Setup Private Internal Repository (if applicable)
   6.3 Configuration / Setup env
   6.4 Install Dependencies
   6.5 Run Project
7. Project Structure
8. Testing
```

---

## 1. Project Name

State the project/service name with a short one-liner.

```markdown
# sellsuki-central-control-backend

Administrative backend for managing companies, users, and access control
across the Sellsuki ecosystem.
```

---

## 2. Requirements

State the required runtime/language version and tooling.

```markdown
## Requirements

- Golang 1.21+
- Docker & Docker Compose (for local dependencies)
- Make
```

If the project uses a Private Internal Repository:

```markdown
## Private Internal Repository

This project includes modules from a private repository (`gitlab.sellsuki.com/sellsuki/...`).
Configure your shell to access them:

\`\`\`bash

# .zshrc or .bashrc

export GOPROXY=http://go.sellsuki.com,direct
export GONOSUMDB=gitlab.sellsuki.com/\*
\`\`\`

\`\`\`fish

# config.fish

set -gx GOPROXY https://go.sellsuki.com
set -gx GONOSUMDB gitlab.sellsuki.com/\*
\`\`\`
```

---

## 3. Project Overview

Describe the scope and role of the system in the overall architecture.

**Template:**

```markdown
## Project Overview

[Service name] is a [type of service].
It is responsible for [main scope] within the Sellsuki ecosystem,
acting as [role in the system] and [how it connects with other systems].

The service is designed with [Architecture Pattern] to ensure
[key qualities, e.g., scalability, maintainability].
```

### ✅ Good Example

```markdown
## Project Overview

This repository contains the Central Control Backend for Sellsuki.
It serves as the administrative backend responsible for managing central
functionalities such as company management, user access control, and
integration between various Sellsuki services.
The service is designed with Clean Architecture to ensure scalability,
maintainability, and separation of concerns between domain logic,
repositories, and delivery interfaces.
```

### ❌ Bad Example

```markdown
## Project Overview

This is a backend service.
```

**Why it's bad**: No scope, no system role — a new developer has no idea what this service does.

---

## 4. Key Features

A bullet list of main features with short descriptions.

### ✅ Good Example

```markdown
## Key Features

- **Company & Provider Management**: Administrative APIs for managing company data,
  providers, and related configurations.
- **Role-Based Access Control (RBAC)**: Integrates with internal Role & Permission
  services to enforce fine-grained access control.
- **Multi-Interface Support**: Exposes REST endpoints for internal tools and gRPC
  for efficient service-to-service communication.
- **Observability**: OpenTelemetry (Otel) integration for distributed tracing,
  metrics, and centralized logging.
```

### ❌ Bad Example

```markdown
## Key Features

- Company management
- User management
- Authentication
```

**Why it's bad**: No descriptions, no implementation detail, no indication of importance.

---

## 5. Used By

Clarify who uses this service and what domain boundaries exist.

### Template

```markdown
## Used By

**Target Audience / Users:**

- **[User Group 1]**: Description of users
- **[User Group <NUMBER>]**: Description of users

**Domain Boundaries:**
Defines what is handled within this service versus what is delegated to other systems.

| Domain Area | In Scope (This Service)     | Out of Scope (Delegated To)  |
| ----------- | --------------------------- | ---------------------------- |
| [Area 1]    | [What this service handles] | [What other services handle] |
| [Area 2]    | [What this service handles] | [What other services handle] |
| [Area 3]    | [What this service handles] | [What other services handle] |
```

### ✅ Good Example

```markdown
## Used By

**Target Audience / Users:**

- **Internal Admin Teams**: Sellsuki staff managing companies, providers, and user access
- **Partner Businesses**: External companies managing their own profiles and store locations
- **Integration Developers**: Teams building services that consume company/user data

**Domain Boundaries:**
Defines what is handled within this service versus what is delegated to other systems.

| Domain Area   | In Scope (This Service)           | Out of Scope (Delegated To)                    |
| ------------- | --------------------------------- | ---------------------------------------------- |
| Company CRUD  | Create, read, update company data | Payment processing → `sellsuki-pay-backend`    |
| User Identity | User roles, permissions, RBAC     | Authentication/Login → `sellsuki-auth-service` |
| Store Data    | Store locations, configurations   | Order processing → `order-service`             |
```

### ❌ Bad Example

```markdown
## Used By

This service is used by internal teams and external partners.
```

**Why it's bad**: No specific user groups, no domain boundaries — unclear what this service actually owns vs. what other systems provide.

---

## 6. Project Instruction

### 6.1 Clone Repository

```markdown
## Project Instruction

### 1. Clone Repository

\`\`\`bash
git clone git@gitlab.sellsuki.com:sellsuki/share/backend/<repo-name>.git
cd <repo-name>
\`\`\`
```

---

### 6.2 Setup Private Internal Repository (if applicable)

If the project uses internal Sellsuki modules from `gitlab.sellsuki.com`, include this step after Clone Repository. Skip if there are no private dependencies.

```markdown
### 2. Setup Private Internal Repository

Export the following to your shell before installing:

\`\`\`bash

# .zshrc or .bashrc

export GOPROXY=http://go.sellsuki.com,direct
export GONOSUMDB=gitlab.sellsuki.com/\*
\`\`\`

\`\`\`fish

# config.fish

set -gx GOPROXY https://go.sellsuki.com
set -gx GONOSUMDB gitlab.sellsuki.com/\*
\`\`\`
```

---

### 6.3 Configuration — Correct Table Format

The table must always have exactly 3 columns: **Variable**, **Default**, **Description**.

### ✅ Good Example

```markdown
### 3. Configuration

Create a `.env` file (you can copy from `.env.example`):

| Variable                    | Default                                                        | Description                              |
| --------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| APP_NAME                    | sellsuki-central-control-backend                               | Service identifier in logs and traces    |
| APP_VERSION                 | v0.0.0                                                         | Version exposed via telemetry endpoints  |
| ENVIRONMENT                 | development                                                    | Tag applied to metrics and tracing spans |
| PORT                        | 8080                                                           | HTTP listen address                      |
| GRPC_PORT                   | 50051                                                          | gRPC listen address                      |
| DEBUG_LOG                   | true                                                           | Enable human-readable logging            |
| POSTGRES_URI                | postgres://postgres:postgres@localhost:5432/db?sslmode=disable | PostgreSQL connection string             |
| OTEL_GRPC_ENDPOINT          | localhost:4317                                                 | OpenTelemetry collector gRPC endpoint    |
| ROLE_PERMISSION_GRPC_SERVER | localhost:9999                                                 | Role & Permission service gRPC endpoint  |
```

### ❌ Bad Example

```markdown
### 3. Configuration

Copy .env.example to .env and fill in the values.
```

**Why it's bad**: No variable list — a new developer must hunt for `.env.example`, which may not exist in the repo.

---

### 6.4 Install Dependencies

```markdown
### 4. Install Dependencies

\`\`\`bash
go mod tidy
\`\`\`
```

---

### 6.5 Run Project

```markdown
### 5. Run Project

Start dependencies:

\`\`\`bash
docker-compose up -d
\`\`\`

Run the service:

\`\`\`bash
make run

# or

go run cmd/generics_server/main.go
\`\`\`
```

---

## 7. Project Structure

Must include:

1. The architecture pattern used
2. The actual folder tree with annotations
3. Explanation of each folder/file's responsibility

### ✅ Good Example

```markdown
## Project Structure

The project uses **Clean Architecture** with clear separation of concerns
between domain logic, application rules, interface adapters, and data access.

\`\`\`
.
├── Dockerfile # Build Docker image
├── Makefile # Dev shortcuts (run, test, build, lint)
├── docker-compose.yml # Local dependencies (Postgres, Redis, Ory Keto)
├── cmd/
│ ├── generics_server/
│ │ └── main.go # Entry point — wires all layers, starts HTTP + gRPC servers
│ └── generate_fiber_interface/
│ └── main.go # Code gen tool — generates Fiber handlers from OpenAPI spec
├── deployment/
│ ├── values-base.yml # Base Helm chart values
│ └── values-\*.yml # Per-environment overrides (dev, staging, prod)
├── src/
│ ├── entity/ # Domain layer — business rules, no external dependencies
│ │ └── company/
│ │ ├── company.go # Company entity and validation rules
│ │ └── company_test.go # Unit tests for business rules
│ ├── use_case/ # Application layer — orchestrates entities and repositories
│ │ ├── use_case.go # Wire all use cases (dependency injection)
│ │ ├── repository/
│ │ │ └── repository.go # Repository interfaces (ports for dependency inversion)
│ │ └── company/
│ │ ├── create.go # Create company use case
│ │ └── create_test.go # Unit test with mock repository
│ ├── interface/ # Interface adapters — translate HTTP/gRPC ↔ use cases
│ │ ├── fiber/ # Fiber HTTP handlers
│ │ └── grpc/ # gRPC server implementations
│ └── repository/ # Infrastructure layer — concrete data access
│ └── company/
│ ├── postgres_sql.go # PostgreSQL implementation
│ └── postgres_model.go # DB model and mapping helpers
└── test/
└── case_01/ # Integration test: full company creation flow with real DB
\`\`\`

**Layer Responsibilities:**

- `entity/` — Core domain logic and business rules. Must have no dependency on other layers.
- `use_case/` — Application business rules. Depends only on entity and repository interfaces.
- `interface/` — Converts external requests (HTTP, gRPC) into use case inputs and outputs.
- `repository/` — Implements repository interfaces using real infrastructure (PostgreSQL, etc.).
```

### ❌ Bad Example

```markdown
## Project Structure

- src/ - source code
- cmd/ - main files
- test/ - tests
```

**Why it's bad**: No architecture pattern, no actual tree, no annotations — completely unhelpful.

---

## 8. Testing

### ✅ Good Example

```markdown
## Testing

All test files (`./src/**/*_test.go`) are unit test files.
They must **not** rely on external resources (databases, networks)
and must reside in the same package as the file under test.

### Characteristics of Good Test Cases

A comprehensive suite covers both positive and negative scenarios:

- **Positive**: Expected behavior — e.g., successfully creating a company returns HTTP 201
- **Negative**: Invalid scenarios — e.g., duplicate company name returns HTTP 409 with error message

### Testing Priority

1. **Entity Tests** — Highest priority. Validate domain rules without any mocks.
2. **Use Case Tests** — Critical. Inject mock repositories to isolate business logic.
3. **Repository Tests** — Validate SQL queries, data mapping, and error handling.
4. **Interface Adapter Tests** — Validate request parsing and response formatting.

### Test Commands

**Unit Test**
\`\`\`bash
make unit-test

# or

go test -v ./src/...
\`\`\`

**Coverage Report (with HTML)**
\`\`\`bash
make coverage-test-html
\`\`\`

**Benchmark**
\`\`\`bash
make benchmark-test
\`\`\`

**Integration Test** (requires Docker)

**Setup** — Read `./test/*/main_test.go` for any required configuration overrides and document them before the commands. For example:

> At `test/case_01/main_test.go`, set `TestPostgresUri` to match the database configured in docker-compose.

\`\`\`bash
docker-compose up -d
make integration-test

# or

go test -v ./test/... -p 1
\`\`\`
```

### ❌ Bad Example

```markdown
## Testing

Run `go test ./...`
```

**Why it's bad**: No setup instructions per test type, no coverage target, no description of what good tests look like.

---

## Anti-Patterns

| Anti-Pattern                                         | Impact                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| Writing guessed information without reading the code | Incorrect setup instructions mislead developers             |
| Omitting some environment variables                  | New developers cannot run the service without knowing why   |
| Writing a generic Project Structure                  | Not useful, gives no picture of the architecture            |
| Using placeholder text like `[TODO]`                 | README is incomplete and unusable                           |
| Skipping the Testing section                         | New developers don't know how to run tests                  |
| Hardcoding an incorrect clone URL                    | Developers cannot clone the repo                            |
| Creating multiple README files                       | Creates confusion — only one `README.md` at root is allowed |
| Not stating the architecture pattern                 | Developers don't know where to add new code                 |

---

## Output Checklist

Verify every item before delivering the README:

- [ ] Project name matches the actual repo/module name
- [ ] Requirements state the correct runtime version
- [ ] Project Overview clearly explains scope + role (not just "this is a backend")
- [ ] Key Features are complete and derived from the actual code
- [ ] Used By section identifies target audiences and domain boundaries
- [ ] Clone URL is correct (verified with `git remote -v`)
- [ ] All environment variables used in the codebase are listed
- [ ] env table has all 3 columns: Variable, Default, Description
- [ ] Private repo setup instructions are correct (if applicable)
- [ ] docker-compose instructions are correct (if applicable)
- [ ] Install Dependencies step is documented (e.g., `go mod tidy`, `npm install`)
- [ ] Project Structure tree reflects the actual codebase
- [ ] Architecture pattern is stated
- [ ] Every folder/file in the tree has an annotation
- [ ] Layer responsibilities are explained
- [ ] Test commands come from the actual Makefile or package.json
- [ ] All test types are listed (unit, integration, coverage, benchmark)
- [ ] Integration Test includes Setup steps (if config changes are required before running)
- [ ] No placeholder text or guessed information
