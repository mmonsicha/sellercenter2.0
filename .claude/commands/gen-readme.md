Generate README.md following the Sellsuki README Standard.

Launch the **readme-generator** agent to perform a complete 3-phase workflow:

**Phase 1: GATHER** — Read the entire codebase and write findings to `.readme-memo.md`
- Project identity (module name, Go version, clone URL from `git remote -v`)
- Environment variables (extract all `os.Getenv`, `viper.Get`, `process.env` usage)
- Architecture & folder structure (actual tree with `ls -la` and `find`)
- Test commands and setup requirements (from Makefile, package.json, test files)
- Key features & external dependencies
- Private repository configuration

**Phase 2: WRITE** — Synthesize findings into a complete `README.md` following the standard

**Phase 3: CLEANUP** — Delete `.readme-memo.md`

---

## Agent Reference

- **Agent:** `readme-generator` (README generation specialist for Sellsuki services)
- **Skill:** `.claude/skills/gen-readme.md` (Sellsuki README Standard with structure, examples, and checklist)
- **Tools:** Read, Write, Edit, Bash, Grep, Glob

---

## After Completion

Verify the generated `README.md` contains all required sections:

- [ ] Project name matches repo/module name
- [ ] Requirements state correct runtime version
- [ ] Project Overview explains scope + system role
- [ ] Key Features derived from actual code
- [ ] Clone URL is correct
- [ ] All environment variables listed
- [ ] Project Structure reflects actual codebase
- [ ] Test commands documented (unit, integration, coverage, benchmark)
