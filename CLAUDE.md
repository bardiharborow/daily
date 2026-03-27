# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build    # Compile TypeScript to dist/
npm run lint     # Lint with Biome
npm run test     # Run tests with Vitest
npx vitest run src/tests/jira.test.ts  # Run a single test file
```

## Architecture

This is a **daily updates aggregator**: it fetches activity from external services and prints a summary of what the user did in the past 24 hours.

### Core abstractions

- **`src/types.ts`** — shared `Updates` type (`Map<string, string[]>`, category name → formatted lines) and `Plugin` interface (`fetchUpdates(since: string): Promise<Updates>`).
- **`src/merge.ts`** — `mergeUpdates(maps: Updates[]): Updates` — pure function that merges plugin results by concatenating arrays under the same key.
- **`src/index.ts`** — reads env vars, registers plugins in `enabled_plugins`, orchestrates them in parallel via `fetchUpdates`, and prints the result.

### Plugin pattern (`src/plugins/`)

Each plugin is a class implementing `Plugin`. The constructor takes auth credentials plus an optional injected client (for testing — see below). Plugins are registered in `enabled_plugins` in `src/index.ts`.

**`GitHub`** (`src/plugins/github.ts`):
- Category: `"Code Review"`. Format: `<emoji> <title> (#<number>)` where emoji is `✅` / `❌` / `💬`.
- Searches for PRs reviewed by the authenticated user within the org, then fetches each PR's review list and takes the user's latest review state.
- `owner`/`repo` are parsed from `repository_url` (`.split("/")`, last two segments).

**`Jira`** (`src/plugins/jira.ts`):
- Category: `"Jira Transitions"` (`[KEY] Summary (ToStatus)`).
- Calls `myself()` once to resolve `accountId`, then runs `fetchTransitions` and `fetchCommentedIssues` in parallel.
- Transitions use `expand=changelog` on the search call to avoid N+1 requests. Filters changelog items to `field === "status"` entries by the authenticated user within the time window.
- Uses `node:https` directly (no HTTP library dependency). `RealJiraClient` wraps `get`/`post` with Basic Auth (`Buffer.from(email:token).toString("base64")`). The ISO 8601 `since` timestamp is converted to JQL format (`"YYYY-MM-DD HH:mm"`) inside `RealJiraClient`.

### Testability pattern

Each plugin defines a narrow `*Like` interface (e.g. `OctokitLike`, `JiraClientLike`) covering only the methods it calls. The constructor accepts an optional pre-built instance of that interface, which tests inject as a stub built with `vi.fn()`. Production code passes no third argument, so the real client is constructed from credentials as normal.

### Required environment variables

| Variable        | Plugin                                       |
|-----------------|----------------------------------------------|
| `GITHUB_TOKEN`        | GitHub                                       |
| `GITHUB_ORGANIZATION` | GitHub                                       |
| `JIRA_BASE_URL` | Jira (e.g. `https://mycompany.atlassian.net`) |
| `JIRA_EMAIL`    | Jira                                         |
| `JIRA_API_TOKEN`| Jira                                         |

All are read at startup in `src/index.ts` with an early `throw` if any are missing.

## Tooling

- **Biome** for linting and formatting (replaces ESLint + Prettier). Config in `biome.json`; double quotes, 2-space indent.
- **TypeScript** targets ES2024, outputs CommonJS to `dist/`. Config in `tsconfig.json`, strict mode on.
- **Vitest** for tests; test files live in `src/tests/` and must match `src/tests/**/*.test.ts` (configured in `vitest.config.ts`).
