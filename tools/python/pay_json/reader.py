"""Core pay.json reader.

Fetch a host's `/.well-known/pay.json`, validate its structure against the
pay.json v1.0 / v1.1 schema, and resolve pricing rules for a URL path.
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

import httpx

SUPPORTED_VERSIONS = {"1.0", "1.1"}
_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_PRICE_RE = re.compile(r"^\d+(\.\d+)?$")
_REQUIRED_FIELDS = (
    "version",
    "protocol",
    "network",
    "asset",
    "receiver",
    "seller_wallet",
    "rules",
)


class PayJsonError(Exception):
    """Base error for pay.json operations."""


class PayJsonNotFound(PayJsonError):
    """The host does not serve a pay.json file."""


class PayJsonInvalid(PayJsonError):
    """The fetched document is not a valid pay.json."""


@dataclass(frozen=True)
class Rule:
    path: str
    price_usd: Decimal
    terms: dict[str, Any] | None = None
    budget_hints: dict[str, Any] | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PayJson:
    version: str
    protocol: str
    network: str
    asset: str
    receiver: str
    seller_wallet: str
    rules: tuple[Rule, ...]
    facilitator: str | None = None
    provider: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def fetch(cls, host: str, *, timeout: float = 5.0) -> "PayJson":
        """Fetch and parse a host's pay.json.

        `host` may be a bare hostname (`example.com`) or an https URL. Raises
        `PayJsonNotFound` on 404, `PayJsonInvalid` on malformed content, and
        the underlying httpx error on transport failure.

        Redirects are NOT followed: `host` is often agent-controlled input, so
        following redirects could be steered to internal services (SSRF).
        Publishers must serve `/.well-known/pay.json` directly per spec §2.
        """
        url = _build_url(host)
        try:
            resp = httpx.get(url, timeout=timeout, follow_redirects=False)
        except httpx.HTTPError as exc:
            raise PayJsonError(f"fetch failed: {exc}") from exc

        if resp.status_code == 404:
            raise PayJsonNotFound(f"no pay.json at {url}")
        if resp.status_code in (301, 302, 303, 307, 308):
            raise PayJsonError(
                f"refused to follow redirect from {url} to {resp.headers.get('location', '?')}"
            )
        if resp.status_code >= 400:
            raise PayJsonError(f"fetch failed: HTTP {resp.status_code}")

        try:
            data = resp.json()
        except ValueError as exc:
            raise PayJsonInvalid(f"not valid JSON: {exc}") from exc

        return cls.parse(data)

    @classmethod
    def parse(cls, data: Any) -> "PayJson":
        """Parse an already-decoded pay.json document."""
        if not isinstance(data, dict):
            raise PayJsonInvalid("document must be a JSON object")

        for f in _REQUIRED_FIELDS:
            if f not in data:
                raise PayJsonInvalid(f"missing required field: {f}")

        version = data["version"]
        if version not in SUPPORTED_VERSIONS:
            raise PayJsonInvalid(
                f"unsupported version {version!r} (supported: {sorted(SUPPORTED_VERSIONS)})"
            )

        for addr_field in ("receiver", "seller_wallet"):
            if not _ADDRESS_RE.match(data[addr_field]):
                raise PayJsonInvalid(f"invalid address in {addr_field}")

        raw_rules = data["rules"]
        if not isinstance(raw_rules, list) or not raw_rules:
            raise PayJsonInvalid("rules must be a non-empty array")

        rules = tuple(_parse_rule(r) for r in raw_rules)

        return cls(
            version=version,
            protocol=data["protocol"],
            network=data["network"],
            asset=data["asset"],
            receiver=data["receiver"],
            seller_wallet=data["seller_wallet"],
            rules=rules,
            facilitator=data.get("facilitator"),
            provider=data.get("provider"),
            raw=data,
        )

    def match_rule(self, path: str) -> Rule | None:
        """Return the first matching rule for a URL path, or None.

        Ordering is top-to-bottom per spec §4. `**` matches across segments;
        `*` matches within a single segment.
        """
        for rule in self.rules:
            if _path_matches(rule.path, path):
                return rule
        return None


def _build_url(host: str) -> str:
    if host.startswith(("http://", "https://")):
        parsed = urlparse(host)
        base = f"{parsed.scheme}://{parsed.netloc}"
    else:
        base = f"https://{host.strip('/')}"
    return f"{base}/.well-known/pay.json"


def _parse_rule(raw: Any) -> Rule:
    if not isinstance(raw, dict):
        raise PayJsonInvalid("rule must be an object")
    for f in ("path", "price_usd"):
        if f not in raw:
            raise PayJsonInvalid(f"rule missing required field: {f}")
    if not _PRICE_RE.match(raw["price_usd"]):
        raise PayJsonInvalid(f"invalid price_usd: {raw['price_usd']!r}")

    terms = raw.get("terms")
    if terms is not None:
        if not isinstance(terms, dict) or "type" not in terms:
            raise PayJsonInvalid("terms must be an object with a 'type' field")

    budget_hints = raw.get("budget_hints")
    if budget_hints is not None:
        if not isinstance(budget_hints, dict):
            raise PayJsonInvalid("budget_hints must be an object")
        for hint_field in ("recommended_max_per_call", "recommended_max_per_session"):
            val = budget_hints.get(hint_field)
            if val is not None and not _PRICE_RE.match(val):
                raise PayJsonInvalid(f"invalid {hint_field}: {val!r}")

    return Rule(
        path=raw["path"],
        price_usd=Decimal(raw["price_usd"]),
        terms=terms,
        budget_hints=budget_hints,
        raw=raw,
    )


def _path_matches(pattern: str, path: str) -> bool:
    # ** = cross-segment wildcard; * = single-segment wildcard.
    # fnmatch treats * as cross-segment, so we translate manually.
    if "**" in pattern:
        return fnmatch.fnmatchcase(path, pattern.replace("**", "*"))
    regex = _glob_to_regex(pattern)
    return re.fullmatch(regex, path) is not None


def _glob_to_regex(pattern: str) -> str:
    out: list[str] = []
    for ch in pattern:
        if ch == "*":
            out.append("[^/]*")
        elif ch == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(ch))
    return "".join(out)
