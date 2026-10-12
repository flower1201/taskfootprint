# Contributing

Thanks for interest in TaskFootprint.

## Development

Requires Node.js `^22.12.0 || ^24.0.0`.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run demo
```

Optional Playwright e2e (after `npx playwright install chromium`):

```bash
npm run test:e2e
```

## Guidelines

- Keep the tool **local-first** and **offline by default**
- Prefer argv-array `git` invocations (no shell concatenation)
- Do not add LLM / MCP / cloud dependencies for P0 features
- Add a ground-truth fixture test for any new interval or scope behavior
- Do not commit real user sessions, secrets, or absolute machine paths

## Scope of PRs

Small, focused PRs are easiest to review: bug fixes, Windows path edge cases, clearer reports, or documentation accuracy.
