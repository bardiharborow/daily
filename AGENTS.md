# AGENTS.md

## Commands

```bash
npm start          # Run the CLI (loads .env automatically via tsx)
npm test           # Run tests (Vitest)
npm run lint       # Check code with Biome
npm run format     # Fix lint and format issues with Biome
npm run typecheck  # TypeScript type checking (no emit)
```

Run a single test file:
```bash
npm test -- src/tests/plugins/github.test.ts
```

## Architecture

This is a TypeScript CLI tool that generates daily activity reports by aggregating data from multiple services (GitHub, Jira).

**Plugin system** — the core abstraction is the `Plugin` interface in `src/types.ts`. Every plugin implements:
```ts
fetchUpdatesByCategory(since: Date): Promise<UpdatesByCategory>
// where UpdatesByCategory = Map<string, Array<string>>
```

**Data flow:**
1. `src/cli.ts` — validates env vars, instantiates plugins, calculates 24h lookback
2. `src/aggregation.ts` — `fetchUpdates()` runs all plugins in parallel, `mergeUpdates()` combines their `Map<string, string[]>` results, `formatUpdates()` renders to text
3. Plugin results map **category name → list of formatted strings** (e.g., `"Code Review" → ["✅ APPROVED: PR title"]`)

**Plugins** (`src/plugins/`):
- `github.ts` — uses Octokit to find PRs reviewed by the current user within the org; accepts optional mock client for testing
- `jira.ts` — uses a custom HTTPS client for Jira REST API v3; groups issues by parent epic; accepts optional mock client for testing

**Testing** — plugins are designed for dependency injection: constructors accept optional mock API clients, making tests straightforward without real credentials.

## Environment Variables

Required (see `.env.example`):
- `GITHUB_TOKEN`, `GITHUB_ORGANIZATION`
- `JIRA_CLOUD_ID`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
