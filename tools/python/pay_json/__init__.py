"""pay-json Python reader.

Parses pay.json documents per the v1.0 and v1.1 specification. See
https://github.com/xenarch/pay-json/blob/main/spec/pay-json-v1.md.
"""

from .reader import (
    PayJson,
    PayJsonError,
    PayJsonNotFound,
    PayJsonInvalid,
    Rule,
)

__all__ = [
    "PayJson",
    "PayJsonError",
    "PayJsonNotFound",
    "PayJsonInvalid",
    "Rule",
]

__version__ = "1.1.0"
