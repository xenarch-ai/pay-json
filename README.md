# pay.json

An open standard for machine-readable pricing — like robots.txt but for payments.

pay.json tells AI agents what content costs and how to pay for it. Publishers place a `pay.json` file at their domain root (`/.well-known/pay.json`) describing pricing rules and accepted payment methods.

## Quick Example

```json
{
  "version": "1.2",
  "protocol": "x402",
  "network": "base",
  "asset": "USDC",
  "receiver": "0x1234567890abcdef1234567890abcdef12345678",
  "seller_wallet": "0x1234567890abcdef1234567890abcdef12345678",
  "facilitators": [
    { "name": "payai", "url": "https://facilitator.payai.network", "priority": 1, "spec_version": "v2" },
    { "name": "xpay",  "url": "https://facilitator.xpay.sh",       "priority": 2, "spec_version": "v2" }
  ],
  "rules": [
    { "path": "/blog/*",    "price_usd": "0.003" },
    { "path": "/premium/*", "price_usd": "0.01"  }
  ]
}
```

`facilitators[]` lets the publisher list which x402 facilitators they
accept. Agents try them in order and fall back through the list. No single
intermediary sits in the money path.

## Specification

The full spec lives in [`spec/`](spec/).

## Tools

Validation and generation tools in [`tools/`](tools/).

## License

- Specification: [CC-BY-4.0](spec/LICENSE)
- Code/tools: [MIT](LICENSE)
