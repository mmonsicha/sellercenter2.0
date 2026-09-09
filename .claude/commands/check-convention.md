Check that the code conforms to **this project's own conventions** — before committing or pushing,
or just to review. This command is project-agnostic: it discovers the project's language, tooling,
and rules at runtime instead of assuming any specific stack. It does NOT judge from docs alone — it
**reads the project's actual code** to understand the real patterns, then reviews the branch's
changes for consistency, conformance, and code smells. Report findings first, then ASK whether to
fix. Never auto-fix without approval.

Scope: $ARGUMENTS

- If `$ARGUMENTS` is a path (file or dir) → review only that path.
- If `$ARGUMENTS` is empty → review the **current branch's changes** vs its base. Resolve scope with:
  - `git status --short` (uncommitted)
  - base: `git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null`
  - `git diff --stat <base>...HEAD` and `git diff <base>...HEAD` (committed on this branch)
  - If no base resolves, review `git status` + recent commits and say so.
  - If there are no changes at all, say so and ask whether to review the whole repo instead.
- If this isn't a git repo, require a path in `$ARGUMENTS` (or default to the current directory).

**Stay inside the branch scope.** Review only files changed on this branch (or the given path).
You may *read* anything in the repo to understand context, but findings and fixes apply only to
in-scope files. Out-of-scope issues may be *mentioned*, never fixed unless the user asks.

---

## Step 0 — Discover the project (don't assume a stack)

Figure out what "conforming" means *here*. Look for, and read whatever exists:

**Project-defined rules / docs** (highest authority):
- `CLAUDE.md`, `AGENTS.md`, `agents.md`, `CONTRIBUTING.md`, `STYLE*.md`, `ARCHITECTURE.md`
- `.claude/rules/*`, `.claude/skills/*`, `.cursor/rules/*`, `.github/` guidelines, `docs/` conventions

**Language & toolchain** (detect from manifests present): `go.mod`, `package.json` (read its `scripts`),
`pyproject.toml`/`setup.cfg`, `Cargo.toml`, `pom.xml`/`build.gradle`, etc. Note linter/formatter
configs (`.editorconfig`, `.eslintrc*`, `.prettierrc*`, `.golangci.yml`, `ruff.toml`, `.rubocop.yml`)
— these are the enforced rules; honor them over preference.

**Build/test entry points**: prefer the project's own wrappers — `Makefile`, `Taskfile`, `justfile`,
`package.json` scripts, `tox`. Run those rather than guessing raw commands.

If the repo defines no rules at all, fall back to accepted idioms for the detected language and say
explicitly that you're using defaults because none were found.

---

## Step 1 — Read the actual code (this is the core of the check)

Docs tell you the intended rules; the **code** tells you the real, lived conventions. Do both.

1. **Read every in-scope changed file in full** (not just the diff hunks) — you need the whole file
   to judge structure, naming, and smells, not isolated lines.
2. **Read the neighbours.** For each changed file, open 2–3 pre-existing peers of the same kind
   (same directory / same suffix / same layer / same role) and the modules it imports or is imported
   by. This is how you learn the de-facto pattern when nothing is written down. "Do the neighbours
   do it this way?" is the strongest signal of what's idiomatic in this codebase.
3. **Build a mental model of the change as a whole** — what the branch is trying to do, which layers
   it touches, how the pieces fit together — so you can judge the change holistically, not file by
   file in isolation.

For larger branches, consider delegating parallel reads to sub-agents (one per layer/area), each
told which rules/peers to read, then synthesize. Keep each reader focused on its slice.

Review what you read through three lenses:

- **Consistency** — does the new code match the surrounding code's structure, naming, file layout,
  error/logging style, and idioms? Flag anything that looks foreign next to its peers, and any
  internal inconsistency within the branch itself (e.g. two new files solving the same thing two
  different ways).
- **Conformance** — does it follow the project's documented rules from Step 0 (layering/boundaries,
  required patterns, generated-file rules, test/coverage expectations)?
- **Code smell** — general quality issues regardless of project rules: dead/duplicated code, overly
  long functions, deep nesting, unclear names, swallowed errors, leftover debug prints/TODOs,
  commented-out code, magic values, missing edge-case handling, copy-paste drift.

---

## Step 2 — Mechanical checks (objective, language-appropriate)

Run the checks that apply to the detected stack, preferring project wrappers. Examples — adapt to
what's actually configured:

| Concern | Go | JS/TS | Python | Rust |
|---|---|---|---|---|
| Format | `gofmt -l <scope>` | `prettier --check` | `black --check` / `ruff format --check` | `cargo fmt --check` |
| Lint | `go vet ./...` | `eslint` | `ruff check` / `flake8` | `cargo clippy` |
| Types | (compiler) | `tsc --noEmit` | `mypy` | (compiler) |
| Build | `go build ./...` | build script | — | `cargo build` |
| Tests | project test target | test script | `pytest` | `cargo test` |

Only run what the project supports. Record each failure with file + cause. If a check can't run
(missing deps / no network), mark it "skipped" rather than guessing.

---

## Step 3 — Report (always show this; fix nothing yet)

Open with a 2–3 sentence read of the branch as a whole (what it does, overall health), then the
findings grouped by severity — concrete and actionable: `file:line`, the issue, the rule/peer it
breaks (cite the source doc/config or the sibling file), and the suggested fix.

```
## Convention check — <scope>

Branch: <what the change does, overall impression>
Detected: <language(s)/stack> · rules from: <docs/configs found, or "defaults (none found)">
Mechanical: format <n> · lint <n> · types <ok/fail/skip> · build <ok/fail/skip> · tests <ok/fail/skip>

CRITICAL (n)   layer/boundary violations, won't-compile/build, hand-edited generated files, secrets
WARNING  (n)   inconsistency with peers, deviations from documented rules, real code smells
SUGGESTION (n) idiomatic / clean-code improvements

[for each]  <file:line> — <what's wrong> — <rule/peer source> — <fix>

Out-of-scope (mentioned, will NOT fix unless asked): <...>

Verdict: PASS / NEEDS WORK
```

If everything passes, say so plainly and stop — nothing to ask.

---

## Step 4 — Ask before fixing

If there are fixable findings, use `AskUserQuestion` to ask how to proceed. Offer options like:
- **Fix all** — apply every fix in scope
- **Critical + warnings only** — skip suggestions
- **Formatting/lint only** — just the mechanical auto-fixes
- **Let me pick** — list findings and let the user choose
- **Don't fix** — review-only, leave as-is

Do not edit anything until the user answers.

---

## Step 5 — Apply approved fixes & re-verify

- Fix only what was approved, only in scope, the minimal diff that conforms to the project's pattern.
- Prefer matching an existing peer over inventing a new shape.
- Never hand-edit generated files — if a generated artifact is wrong, re-run its generator.
- Re-run the relevant mechanical checks and report before/after. State plainly if anything still fails.
