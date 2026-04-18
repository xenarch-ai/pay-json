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

Supports both v1.0 and v1.1 of the pay.json spec. v1.1 adds optional
per-rule `terms` and `budget_hints` fields.

## License

MIT. See the [spec](https://github.com/xenarch/pay-json/blob/main/spec/pay-json-v1.md) for
the (CC-BY-4.0) specification text itself.
