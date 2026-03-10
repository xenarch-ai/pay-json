# pay.json

An open standard for machine-readable pricing — like robots.txt but for payments.

pay.json tells AI agents what content costs and how to pay for it. Publishers place a `pay.json` file at their domain root (`/.well-known/pay.json`) describing pricing rules and accepted payment methods.

## Quick Example

```json
{
  "version": "1.0",
  "publisher": "example.com",
  "default": {
    "price": 0.001,
    "currency": "USD",
    "methods": ["x402"]
  }
}
```

## Specification

The full spec lives in [`spec/`](spec/).

## Tools

Validation and generation tools in [`tools/`](tools/).

## License

- Specification: [CC-BY-4.0](spec/LICENSE)
- Code/tools: [MIT](LICENSE)
