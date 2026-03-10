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

## Reference

See `../Information/design/pay-json-spec.md` for design rationale.
