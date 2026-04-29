"""pay-json Python reader.

Parses pay.json documents per the v1.2 specification. See
https://github.com/xenarch-ai/pay-json/blob/main/spec/pay-json-v1.md.
"""

from .reader import (
    Facilitator,
    PayJson,
    PayJsonError,
    PayJsonInvalid,
    PayJsonNotFound,
    Rule,
)

__all__ = [
    "Facilitator",
    "PayJson",
    "PayJsonError",
    "PayJsonNotFound",
    "PayJsonInvalid",
    "Rule",
]

__version__ = "1.2.0"
