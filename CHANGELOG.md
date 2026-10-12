# Changelog

## 0.1.0-rc.1 — 2026-10-12

Initial public pre-release.

- `taskfootprint snapshot` — content-hash workspace baseline
- `taskfootprint check` — interval compare + allow-scope contract
- Offline `index.html` / `changes.json` / `summary.md` report
- Correct interval semantics for pre-existing dirty / untracked files
- Exit codes: `0` pass · `1` incomplete/error · `2` scope violation
