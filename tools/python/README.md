# pay-json (Python)

Python reader for the [pay.json](https://github.com/xenarch/pay-json)
standard. Fetches a site's `/.well-known/pay.json`, validates structure,
and resolves the price rule for a given URL path.

## Install

```bash
pip install pay-json
```

## Usage

```python
from pay_json import PayJson

# Fetch and parse a host's pay.json
doc = PayJson.fetch("example.com")

# Resolve a rule for a given path
rule = doc.match_rule("/api/inference/foo")
if rule:
    print(rule.price_usd)   # Decimal("0.01")
    print(rule.terms)       # {"type": "per_unit", "unit": "1000_tokens"}
```

Targets pay.json v1.2 (the current spec). v1.2 introduces a
`facilitators[]` array (multi-facilitator failover), an optional
`verifier` endpoint, and drops the pre-1.2 single-string `facilitator`
field. Pre-1.2 documents are not accepted.

## License

MIT. See the [spec](https://github.com/xenarch/pay-json/blob/main/spec/pay-json-v1.md) for
the (CC-BY-4.0) specification text itself.
