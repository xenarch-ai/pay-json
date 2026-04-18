# pay.json Specification v1.1

**Status:** Draft
**Date:** 2026-04-18
**License:** [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)

> **v1.1** adds two optional, per-rule fields — `terms` and `budget_hints` — to
> help agents reason about *what* they are paying for and *how much* a
> publisher considers reasonable. v1.0 files remain valid under v1.1; all new
> fields are optional and additive. See §12 for migration notes.

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

pay.json solves this by giving publishers a declarative way to say: "This
content costs X, pay to address Y, using protocol Z." Agents read the file,
evaluate the rules, and decide whether to pay — all before requesting the
protected resource.

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
| `version`       | Yes      | string   | Schema version. MUST be `"1.0"` or `"1.1"`.                              |
| `protocol`      | Yes      | string   | Payment protocol identifier (e.g. `"x402"`).                            |
| `network`       | Yes      | string   | Blockchain or payment network (e.g. `"base"`, `"ethereum"`).            |
| `asset`         | Yes      | string   | Payment token or currency (e.g. `"USDC"`).                              |
| `receiver`      | Yes      | string   | Address that receives payment. Ethereum address format (`0x` + 40 hex). |
| `seller_wallet` | Yes      | string   | Publisher's wallet address. Ethereum address format (`0x` + 40 hex).    |
| `rules`         | Yes      | array    | Ordered list of path-to-price rules. See Section 3.2.                   |
| `provider`      | No       | string   | Payment infrastructure provider identifier.                              |
| `facilitator`   | No       | string   | URI of a facilitator or verification endpoint.                           |
| `contact`       | No       | string   | Publisher contact information (email, URL, or other identifier).         |
| `terms`         | No       | string   | URI pointing to the publisher's terms of service.                        |
| `tools`         | No       | object   | Tooling hints for agents — CLI, SDKs, docs. See Section 3.3.            |

### 3.2 Rule Objects

The `rules` array MUST contain at least one rule object. Each rule object has
the following fields:

| Field          | Required | Type   | Description                                                               |
|----------------|----------|--------|---------------------------------------------------------------------------|
| `path`         | Yes      | string | Glob pattern matching URL paths (e.g. `"/blog/*"`, `"/**"`).             |
| `price_usd`    | Yes      | string | Price in US dollars, expressed as a decimal string (e.g. `"0.003"`).     |
| `terms`        | No       | object | (v1.1) What the price buys. See Section 3.4.                             |
| `budget_hints` | No       | object | (v1.1) Suggested agent spending caps. See Section 3.5.                   |

The `price_usd` field is a string rather than a number to avoid
floating-point precision issues. It MUST match the pattern `^\d+(\.\d+)?$`
(one or more digits, optionally followed by a decimal point and more digits).

### 3.3 Tools Object

The optional `tools` field helps agents discover how to make payments
programmatically. It contains pointers to CLI commands, SDK packages, and
documentation — so an agent reading pay.json can immediately learn what to
install and run.

| Field  | Type   | Description                                                        |
|--------|--------|--------------------------------------------------------------------|
| `cli`  | object | Command-line tool. Contains `install` (shell command) and `usage` (example invocation). |
| `sdk`  | object | SDK packages keyed by registry name (e.g. `"npm"`, `"pypi"`). Values are package names. |
| `docs` | string | URI pointing to integration documentation.                         |

All sub-fields are optional. Publishers MAY include any combination.

Example:

```json
"tools": {
  "cli": {
    "install": "npm install -g xenarch",
    "usage": "xenarch pay <url>"
  },
  "sdk": {
    "npm": "xenarch",
    "pypi": "xenarch"
  },
  "docs": "https://xenarch.com/docs"
}
```

### 3.4 Terms Object (v1.1)

The optional `terms` field on a rule describes what a single payment unit
actually buys. It helps agents reason about the offer before committing to
a price that they can otherwise only guess about.

| Field      | Required | Type   | Description                                                          |
|------------|----------|--------|----------------------------------------------------------------------|
| `type`     | Yes      | string | Billing model: `"per_use"`, `"per_minute"`, `"per_request"`, `"subscription"`, or `"per_unit"`. |
| `unit`     | No       | string | Free-form unit label for `per_unit` pricing (e.g. `"1000_tokens"`, `"image"`, `"api_call"`). |
| `quantity` | No       | number | Quantity included per payment when relevant (e.g. 5 minutes of access for `per_minute` with `quantity: 5`). |

Consumers MUST tolerate unknown `type` values by treating the rule as
`per_use`. This keeps future additions (e.g. `"per_token"`) backward compatible.

Example:

```json
{
  "path": "/api/inference/*",
  "price_usd": "0.01",
  "terms": { "type": "per_unit", "unit": "1000_tokens" }
}
```

### 3.5 Budget Hints Object (v1.1)

The optional `budget_hints` field lets publishers communicate *recommended*
agent spending limits for a rule. Hints are advisory — agents remain in full
control of their own budget policy — but they give agents a sensible default
when none has been set by the user.

| Field                           | Required | Type   | Description                                                 |
|---------------------------------|----------|--------|-------------------------------------------------------------|
| `recommended_max_per_call`      | No       | string | Suggested per-call cap in USD as a decimal string.          |
| `recommended_max_per_session`   | No       | string | Suggested per-session cap in USD as a decimal string.       |

Both fields, when present, MUST match the same `^\d+(\.\d+)?$` pattern as
`price_usd`.

Agents SHOULD treat hints as the *lower* of (hint, agent's own configured
cap). A hint cannot override a stricter agent-side limit.

Example:

```json
{
  "path": "/report/*",
  "price_usd": "0.25",
  "budget_hints": {
    "recommended_max_per_call": "0.25",
    "recommended_max_per_session": "2.50"
  }
}
```

### 3.6 Address Format

Both `receiver` and `seller_wallet` MUST be valid Ethereum addresses: the
prefix `0x` followed by exactly 40 hexadecimal characters (case-insensitive).
The regex pattern is `^0x[0-9a-fA-F]{40}$`.

These two addresses serve different purposes:

- **`receiver`** is the contract or address where payment transactions are
  sent. This may be a smart contract that handles splitting, escrow, or
  verification.
- **`seller_wallet`** is the publisher's own wallet address — the ultimate
  beneficiary of the payment.

In the simplest case, both fields may contain the same address.

### 3.7 Example

```json
{
  "version": "1.0",
  "protocol": "x402",
  "network": "base",
  "asset": "USDC",
  "receiver": "0x1234567890abcdef1234567890abcdef12345678",
  "seller_wallet": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "facilitator": "https://example.com/verify",
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

Publishers who cannot place files in the `/.well-known/` directory (e.g. on
hosted platforms with restricted file system access) MAY declare pricing
using an HTML meta tag:

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
- **Requires HTML.** It cannot be used for non-HTML resources (APIs, raw
  files, media).
- **Per-page overhead.** Each page must include its own meta tag.

For these reasons, pay.json is the preferred mechanism. The meta tag is
provided as a fallback for constrained environments.

---

## 6. Discovery Priority

When an agent encounters a resource, it SHOULD discover pricing in the
following order of precedence:

1. **pay.json** (`/.well-known/pay.json`) — the most authoritative source.
   If a valid pay.json file exists and contains a matching rule, use it.

2. **Meta tag** (`<meta name="x402" ...>`) — if no pay.json is found or no
   rule matches, check the HTML response for a pricing meta tag.

3. **HTTP 402 response** — if the server returns a `402 Payment Required`
   status with payment details in headers or body, use those terms.

If none of these sources provide pricing information, the agent SHOULD treat
the content as free.

Agents MUST NOT combine pricing information from multiple sources. The
highest-priority source that provides a match is definitive.

---

## 7. Backwards Compatibility

The absence of a pay.json file carries a clear semantic meaning: the site
does not charge AI agents for content access. This standard is entirely
opt-in.

- No pay.json file = content is free to agents.
- A pay.json file with no matching rule for a given path = that path is free.
- A pay.json file with `price_usd` of `"0"` or `"0.00"` = explicitly free
  (the publisher has considered pricing and chosen not to charge).

Publishers can adopt pay.json incrementally. Adding the file does not break
any existing agent behavior — agents that do not understand pay.json will
simply ignore it.

---

## 8. Security Considerations

### 8.1 Transport Security

pay.json MUST be served over HTTPS. Agents MUST reject pay.json files served
over plain HTTP, as an attacker could modify payment addresses in transit.

### 8.2 Address Verification

Agents SHOULD verify that the `receiver` and `seller_wallet` addresses are
plausible before sending payment. At minimum:

- Validate the address format (checksum-valid Ethereum address).
- If a `facilitator` endpoint is provided, verify the payment terms with
  the facilitator before transacting.

Agents MAY maintain allowlists or reputation data for known receiver
addresses.

### 8.3 Price Bounds

Agents SHOULD enforce their own maximum price thresholds. A pay.json file
can claim any price. Agents MUST NOT blindly pay amounts that exceed the
agent's configured spending limits or the protocol's maximum transaction
size.

### 8.4 Rate Limiting

Publishers SHOULD apply rate limiting to the `/.well-known/pay.json`
endpoint to prevent abuse. Standard HTTP caching headers (`Cache-Control`,
`ETag`, `Last-Modified`) reduce unnecessary re-fetching.

### 8.5 File Integrity

Publishers MAY provide a cryptographic hash or signature alongside their
pay.json file to allow agents to verify integrity. This specification does
not mandate a specific mechanism; future versions may define one.

---

## 9. Extensibility

### 9.1 Unknown Fields

Consumers MUST ignore any fields they do not recognize, both at the
top level and within rule objects. This allows publishers to include
additional metadata without breaking existing agent implementations.

The JSON schema sets `additionalProperties: true` at both the top level
and within rule objects to support forward compatibility.

### 9.2 Versioning

The `version` field indicates which version of this specification the file
conforms to. Future versions will increment the version number (e.g.
`"1.1"`, `"2.0"`).

Agents that encounter an unrecognized version SHOULD attempt to parse the
file using the most recent version they support, falling back gracefully if
parsing fails.

### 9.3 Future Directions

Areas under consideration for future versions include:

- **Multi-protocol support** — declaring multiple payment options per rule.
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

### v1.1 — 2026-04-18

- Added optional per-rule `terms` object (Section 3.4) for billing-model disclosure.
- Added optional per-rule `budget_hints` object (Section 3.5) for advisory spending caps.
- `version` enum now accepts `"1.0"` or `"1.1"`.
- All v1.0 files remain valid under v1.1. No breaking changes.

### v1.0 — 2026-03-15

- Initial published version.

---

## 12. Migration from v1.0

v1.1 is a superset of v1.0:

- A v1.0 file is a valid v1.1 file. No changes required.
- A v1.0 consumer reading a v1.1 file will safely ignore `terms` and
  `budget_hints` under §9.1 (Unknown Fields).
- A v1.1 consumer reading a v1.0 file MUST treat missing `terms` as
  `{type: "per_use"}` and missing `budget_hints` as absent.

Publishers who set `version: "1.1"` SHOULD populate at least one of the new
fields on at least one rule — otherwise there is no reason to bump the
version.

---

## 13. References

- [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) — Well-Known URIs
- [RFC 7231](https://www.rfc-editor.org/rfc/rfc7231) — HTTP/1.1 Semantics
  (defines 402 Payment Required)
- [EIP-55](https://eips.ethereum.org/EIPS/eip-55) — Ethereum Mixed-case
  checksum address encoding
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) —
  Machine-readable schema for pay.json validation

---

## License

This specification is licensed under
[Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this specification for any purpose, including
commercial use, provided you give appropriate credit.
