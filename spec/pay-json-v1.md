# pay.json Specification v1.2

**Status:** Draft
**Date:** 2026-04-23
**License:** [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)

> **v1.2** is a breaking change. The single-string `facilitator` field is
> replaced with a `facilitators[]` array of structured entries (name, url,
> priority, spec_version). A new optional `verifier` field points to an
> independent settlement-verification endpoint. Pre-1.2 files are not
> accepted by this version of the schema.

---

## Abstract

pay.json is a machine-readable file that declares the pricing terms for web
content and services. It allows AI agents to discover what content costs and
how to pay for it — without any prior integration or API key exchange.

Think of it as `robots.txt` for payments: a single static file, placed at a
well-known URL, that any agent can read.

---

## 1. Introduction

AI agents increasingly consume web content — articles, datasets, API
responses, media — on behalf of their users. Publishers need a way to
communicate pricing to these agents that is:

- **Machine-readable** — no scraping or guessing.
- **Zero-code** — a static JSON file, no server-side logic required.
- **Host-agnostic** — works on any web server, CDN, or static host.
- **Protocol-flexible** — supports any payment protocol, starting with x402.
- **Facilitator-agnostic** — publishers list the facilitators they accept,
  agents pick one and fall back through the list. No single intermediary
  is in the money path.

pay.json solves this by giving publishers a declarative way to say: "This
content costs X, pay to address Y, using protocol Z, settled through any of
these facilitators." Agents read the file, evaluate the rules, choose a
facilitator, and pay — all before requesting the protected resource.

---

## 2. File Location

A pay.json file MUST be served at:

```
https://{host}/.well-known/pay.json
```

This follows [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) for
well-known URIs.

Requirements:

- The file MUST be served over HTTPS.
- The file MUST be served with `Content-Type: application/json`.
- The file MUST be publicly accessible (no authentication required).
- The file SHOULD be cacheable. Publishers MAY set `Cache-Control` headers
  to control how frequently agents re-fetch pricing.

---

## 3. Schema

A pay.json file is a JSON object with the following fields:

### 3.1 Top-Level Fields

| Field           | Required | Type     | Description                                                              |
|-----------------|----------|----------|--------------------------------------------------------------------------|
| `version`       | Yes      | string   | Schema version. MUST be `"1.2"`.                                         |
| `protocol`      | Yes      | string   | Payment protocol identifier (e.g. `"x402"`).                             |
| `network`       | Yes      | string   | Blockchain or payment network (e.g. `"base"`, `"ethereum"`).             |
| `asset`         | Yes      | string   | Payment token or currency (e.g. `"USDC"`).                               |
| `receiver`      | Yes      | string   | Address that receives payment. Ethereum address format (`0x` + 40 hex).  |
| `seller_wallet` | Yes      | string   | Publisher's wallet address. Ethereum address format (`0x` + 40 hex).     |
| `rules`         | Yes      | array    | Ordered list of path-to-price rules. See Section 3.2.                    |
| `facilitators`  | No       | array    | Ordered list of accepted facilitators. See Section 3.3.                  |
| `verifier`      | No       | string   | Optional independent verifier endpoint URI. See Section 3.4.             |
| `provider`      | No       | string   | Payment infrastructure provider identifier.                              |
| `contact`       | No       | string   | Publisher contact information (email, URL, or other identifier).         |
| `terms`         | No       | string   | URI pointing to the publisher's terms of service.                        |
| `tools`         | No       | object   | Tooling hints for agents — CLI, SDKs, docs. See Section 3.5.             |

### 3.2 Rule Objects

The `rules` array MUST contain at least one rule object. Each rule object has
the following fields:

| Field          | Required | Type   | Description                                                               |
|----------------|----------|--------|---------------------------------------------------------------------------|
| `path`         | Yes      | string | Glob pattern matching URL paths (e.g. `"/blog/*"`, `"/**"`).             |
| `price_usd`    | Yes      | string | Price in US dollars, expressed as a decimal string (e.g. `"0.003"`).     |
| `terms`        | No       | object | What the price buys. See Section 3.6.                                    |
| `budget_hints` | No       | object | Suggested agent spending caps. See Section 3.7.                          |

The `price_usd` field is a string rather than a number to avoid
floating-point precision issues. It MUST match the pattern `^\d+(\.\d+)?$`
(one or more digits, optionally followed by a decimal point and more digits).

### 3.3 Facilitators Array

The optional `facilitators` field is an ordered array of facilitator entries
the publisher is willing to settle through. Each entry has:

| Field          | Required | Type    | Description                                                       |
|----------------|----------|---------|-------------------------------------------------------------------|
| `name`         | Yes      | string  | Short identifier (e.g. `"payai"`, `"xpay"`, `"ultravioleta"`).    |
| `url`          | Yes      | string  | Facilitator base URL.                                             |
| `priority`     | No       | integer | Lower numbers preferred. Equal priorities MAY be load-balanced.   |
| `spec_version` | No       | string  | x402 spec version this facilitator implements: `"v1"` or `"v2"`.  |

Agents SHOULD attempt facilitators in array order (or by `priority` if
present) and fall back through the list on failure.

When `facilitators` is absent or empty, agents SHOULD fall back to a
built-in default stack. The Xenarch reference SDK defaults to
`[payai, xpay, ultravioleta, x402.rs]`. Coinbase is configurable but never
default.

`spec_version` matters because the V1 retry header is `X-PAYMENT` and the
V2 retry header is `PAYMENT-SIGNATURE` — agents that hardcode one will
silently fail against the other. When omitted, agents SHOULD probe the
facilitator's 402 response to detect the version.

Example:

```json
"facilitators": [
  { "name": "payai", "url": "https://facilitator.payai.network", "priority": 1, "spec_version": "v2" },
  { "name": "xpay",  "url": "https://facilitator.xpay.sh",       "priority": 2, "spec_version": "v2" },
  { "name": "ultravioleta", "url": "https://x402.ultravioleta.dev", "priority": 3, "spec_version": "v2" }
]
```

### 3.4 Verifier Field

The optional `verifier` field is a URL where agents MAY query to verify
settlement independently of the facilitator that performed it. This is the
hook used by the Xenarch commercial layer to issue signed Ed25519 receipts
that prove a settlement on behalf of a publisher.

The verifier is decoupled from facilitators on purpose: a publisher MAY
accept settlement through any of N facilitators while delegating receipt
issuance to a single trusted verifier.

When omitted, agents SHOULD treat settlement as confirmed by the
facilitator's `X-PAYMENT-RESPONSE` (V1) or `PAYMENT-RESPONSE` (V2) header
and an on-chain transaction hash.

### 3.5 Tools Object

The optional `tools` field helps agents discover how to make payments
programmatically. It contains pointers to CLI commands, SDK packages, and
documentation.

| Field  | Type   | Description                                                        |
|--------|--------|--------------------------------------------------------------------|
| `cli`  | object | Command-line tool. Contains `install` (shell command) and `usage` (example invocation). |
| `sdk`  | object | SDK packages keyed by registry name (e.g. `"npm"`, `"pypi"`). Values are package names. |
| `docs` | string | URI pointing to integration documentation.                         |

All sub-fields are optional.

### 3.6 Terms Object

The optional `terms` field on a rule describes what a single payment unit
actually buys.

| Field      | Required | Type   | Description                                                          |
|------------|----------|--------|----------------------------------------------------------------------|
| `type`     | Yes      | string | Billing model: `"per_use"`, `"per_minute"`, `"per_request"`, `"subscription"`, or `"per_unit"`. |
| `unit`     | No       | string | Free-form unit label for `per_unit` pricing (e.g. `"1000_tokens"`, `"image"`, `"api_call"`). |
| `quantity` | No       | number | Quantity included per payment when relevant. |

Consumers MUST tolerate unknown `type` values by treating the rule as
`per_use`.

### 3.7 Budget Hints Object

The optional `budget_hints` field lets publishers communicate *recommended*
agent spending limits for a rule. Hints are advisory.

| Field                           | Required | Type   | Description                                                 |
|---------------------------------|----------|--------|-------------------------------------------------------------|
| `recommended_max_per_call`      | No       | string | Suggested per-call cap in USD as a decimal string.          |
| `recommended_max_per_session`   | No       | string | Suggested per-session cap in USD as a decimal string.       |

Both fields, when present, MUST match the same `^\d+(\.\d+)?$` pattern as
`price_usd`.

Agents SHOULD treat hints as the *lower* of (hint, agent's own configured
cap). A hint cannot override a stricter agent-side limit.

### 3.8 Address Format

Both `receiver` and `seller_wallet` MUST be valid Ethereum addresses: the
prefix `0x` followed by exactly 40 hexadecimal characters (case-insensitive).
The regex pattern is `^0x[0-9a-fA-F]{40}$`.

In a no-splitter architecture (the default starting in v1.2) `receiver` and
`seller_wallet` SHOULD be the same address — the publisher's own wallet.
Two distinct addresses are still permitted for publishers who route through
their own splitter or escrow contract.

### 3.9 Example

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
  "contact": "billing@example.com",
  "terms": "https://example.com/terms",
  "rules": [
    { "path": "/api/premium/*", "price_usd": "0.05" },
    { "path": "/blog/*", "price_usd": "0.003" },
    { "path": "/data/**", "price_usd": "0.01" },
    { "path": "/*", "price_usd": "0.001" }
  ]
}
```

---

## 4. Rule Matching

Rules are evaluated **top-to-bottom**. The first rule whose `path` pattern
matches the requested URL path wins. Subsequent rules are not considered.

### 4.1 Glob Syntax

Path patterns use glob syntax:

| Pattern   | Meaning                                          |
|-----------|--------------------------------------------------|
| `*`       | Matches any sequence of characters within a single path segment (no `/`). |
| `**`      | Matches any sequence of characters across path segments (including `/`).  |
| `?`       | Matches exactly one character.                   |

Examples:

| Pattern          | Matches                              | Does Not Match         |
|------------------|--------------------------------------|------------------------|
| `/blog/*`        | `/blog/my-post`, `/blog/123`         | `/blog/2024/my-post`   |
| `/blog/**`       | `/blog/my-post`, `/blog/2024/my-post`| `/articles/post`       |
| `/api/v?/data`   | `/api/v1/data`, `/api/v2/data`       | `/api/v10/data`        |
| `/*`             | `/about`, `/pricing`                 | `/blog/my-post`        |
| `/**`            | Everything                           | —                      |

### 4.2 Ordering Recommendation

Publishers SHOULD order rules from most specific to least specific. A
wildcard catch-all rule (`/*` or `/**`) SHOULD appear last.

### 4.3 No Match Behavior

If no rule matches the requested path, the content is considered **free**.
Agents SHOULD NOT attempt payment for unmatched paths.

---

## 5. Meta Tag Alternative

Publishers who cannot place files in the `/.well-known/` directory MAY
declare pricing using an HTML meta tag:

```html
<meta name="x402"
      content="price=0.003&wallet=0xSELLER&network=base&protocol=x402">
```

The `content` attribute is a URL-encoded query string with the following
parameters:

| Parameter  | Required | Description                                           |
|------------|----------|-------------------------------------------------------|
| `price`    | Yes      | Price in USD as a decimal string.                     |
| `wallet`   | Yes      | Publisher's wallet address (Ethereum format).         |
| `network`  | Yes      | Blockchain network identifier.                        |
| `protocol` | Yes      | Payment protocol identifier.                          |

### 5.1 Limitations

The meta tag approach is less expressive than pay.json:

- **No path-based rules.** The meta tag applies a single price to the page
  it appears on.
- **No facilitator list.** Agents fall back to their default stack.
- **Requires HTML.** It cannot be used for non-HTML resources.

For these reasons, pay.json is the preferred mechanism.

---

## 6. Discovery Priority

When an agent encounters a resource, it SHOULD discover pricing in the
following order of precedence:

1. **pay.json** (`/.well-known/pay.json`) — the most authoritative source.
2. **Meta tag** (`<meta name="x402" ...>`) — fallback for HTML responses.
3. **HTTP 402 response** — terms in headers or body.

Agents MUST NOT combine pricing information from multiple sources. The
highest-priority source that provides a match is definitive.

---

## 7. Backwards Compatibility

The absence of a pay.json file means: the site does not charge AI agents
for content access. This standard is entirely opt-in.

- No pay.json file = content is free to agents.
- A pay.json file with no matching rule for a given path = that path is free.
- A pay.json file with `price_usd` of `"0"` or `"0.00"` = explicitly free.

v1.2 does **not** accept pre-1.2 documents. Publishers who currently serve
v1.0 or v1.1 files MUST update to v1.2 before agents that target this spec
will pay them.

---

## 8. Security Considerations

### 8.1 Transport Security

pay.json MUST be served over HTTPS. Agents MUST reject pay.json files served
over plain HTTP.

### 8.2 Address Verification

Agents SHOULD verify that the `receiver` and `seller_wallet` addresses are
plausible before sending payment. At minimum:

- Validate the address format (checksum-valid Ethereum address).
- If a `verifier` endpoint is provided, agents MAY query it after settlement
  to confirm the on-chain transaction.

Agents MAY maintain allowlists or reputation data for known receiver
addresses.

### 8.3 Facilitator Selection

Agents SHOULD NOT trust the `facilitators` list blindly. A malicious
publisher could list a facilitator that colludes with them. Agents SHOULD
maintain their own allow/deny list of facilitators and intersect it with the
publisher's list.

### 8.4 Price Bounds

Agents SHOULD enforce their own maximum price thresholds.

### 8.5 Rate Limiting

Publishers SHOULD apply rate limiting to the `/.well-known/pay.json`
endpoint. Standard HTTP caching headers reduce unnecessary re-fetching.

---

## 9. Extensibility

### 9.1 Unknown Fields

Consumers MUST ignore any fields they do not recognize, both at the
top level and within rule and facilitator objects.

### 9.2 Versioning

The `version` field indicates which version of this specification the file
conforms to. Future versions will increment the version number.

### 9.3 Future Directions

Areas under consideration for future versions include:

- **Multi-protocol support** — declaring multiple payment protocols per rule.
- **Dynamic pricing** — time-based or demand-based price adjustments.
- **Access tiers** — different content quality levels at different prices.
- **Bulk pricing** — discounts for high-volume agent consumers.
- **Signed manifests** — cryptographic proof of publisher intent.

---

## 10. IANA Considerations

This specification registers the well-known URI suffix `pay.json` in
accordance with [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615).

| Field            | Value                          |
|------------------|--------------------------------|
| URI suffix       | `pay.json`                     |
| Change controller| pay.json community             |
| Reference        | This specification             |

---

## 11. Changelog

### v1.2 — 2026-04-23

- **Breaking:** Removed the single-string `facilitator` field.
- **Breaking:** `version` enum is now `"1.2"` only. Pre-1.2 documents are no
  longer accepted by validators conforming to this revision.
- Added `facilitators[]` array of `{name, url, priority?, spec_version?}`.
- Added optional top-level `verifier` field.
- Updated default architecture guidance: `receiver` and `seller_wallet`
  SHOULD be the same address (no-splitter default).
- Carried forward `terms` and `budget_hints` per-rule fields from v1.1.

### v1.1 — 2026-04-18 *(superseded)*

- Added optional per-rule `terms` and `budget_hints` objects.

### v1.0 — 2026-03-15 *(superseded)*

- Initial published version.

---

## 12. References

- [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) — Well-Known URIs
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231) — HTTP/1.1 Semantics
- [EIP-55](https://eips.ethereum.org/EIPS/eip-55) — Ethereum Mixed-case
  checksum address encoding
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) —
  Machine-readable schema for pay.json validation

---

## License

This specification is licensed under
[Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/).
