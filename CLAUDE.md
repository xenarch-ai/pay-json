# pay-json

pay.json is an open standard for machine-readable pricing — like robots.txt but for payments. It tells AI agents what content costs and how to pay.

**This is an open standard, NOT a Xenarch product.** Keep all spec language vendor-neutral.

## Structure

```
spec/       — pay.json specification (CC-BY-4.0 licensed)
tools/      — Validation and generation tools (MIT licensed)
examples/   — Example pay.json files
```

## Commands

- Validate: `npm run validate -- path/to/pay.json`
- Build tools: `npm run build`
- Test: `npm test`

## Guidelines

- Spec text must be vendor-neutral — no Xenarch branding
- Tools can reference Xenarch as one implementation
- Keep backwards compatibility when updating spec

## Workflow

See root `../CLAUDE.md` for branching, PR, and commit conventions.

## First Run Check

On first interaction with a contributor, verify git hooks are set up by checking `git config core.hooksPath`. If it doesn't return `.githooks`, tell the contributor:

> "This project requires git hooks for commit message enforcement. Can I run `git config core.hooksPath .githooks` to enable them?"

Do not proceed with any code changes until hooks are confirmed active.

## Reference

See `../Information/design/pay-json-spec.md` for design rationale.

## Dev workflow & prod deploy baton

Follow the canonical workspace workflow in `../Information/workflow.md` (Retasc issue → claim → worktree → PR → deploy → validate on prod → merge-commit, never squash).

**Parallel sessions:** before any `kamal deploy` of platform or dashboard, claim the per-service deploy baton in Retasc issue **XEN-524** (via its append-only CLAIM/RELEASE comment log) and merge `main` into your branch first — one session validates on a given prod service at a time. See `../Information/workflow.md` → "Parallel sessions — prod deploy baton".
