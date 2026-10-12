# Competitors & differentiation

One-pass check before first public push (2026-10-12).

| Project | License | Borrowable idea | Independent boundary |
|---------|---------|-----------------|----------------------|
| [agent-scope-guard](https://github.com/manuelsampedro1/agent-scope-guard) | MIT | Allowlist over changed paths; CI exit codes | Consumes diffs/path lists — **no before/after content-hash interval** |
| [patchwitness](https://github.com/pangxueyuan2-creator/patchwitness) | Apache-2.0 | Offline evidence pack mindset | Git HEAD / process checks — not dirty-interval fingerprinting |
| [agent-guardrails](https://github.com/logi-cmd/agent-guardrails) | MIT | Explicit task scope language | Merge-time agent helpers — different job |
| [difftastic](https://github.com/Wilfred/difftastic) | MIT | Structured diff UX inspiration | Syntax-aware file diff, not agent interval auditor |
| [pre-commit](https://github.com/pre-commit/pre-commit) | MIT | Hook-oriented gates | Framework, not agent footprint reports |
| [gitleaks](https://github.com/gitleaks/gitleaks) | MIT | Secret scanning discipline | Secrets only — complementary, not a substitute |
| Codex / Claude Code | Apache-2.0 / proprietary UX | Market evidence of under-reported change sets | TaskFootprint does not fork or wrap these agents |

## Synthetic gap test

Fixture pattern (see `npm test` interval suite):

1. Pre-dirty `README.md` before snapshot
2. Agent modifies `src/**` and adds `docs/**`
3. Allow only `src/**` + `tests/**`

Expected TaskFootprint behavior:

- Pre-dirty README **not** listed if unchanged after baseline
- `docs/**` → outside scope → exit `2`
- `src/**` → within scope

Diff-from-HEAD tools typically cannot express (1) without an explicit baseline.

**Launch decision:** differentiation holds → Public repo authorized.
