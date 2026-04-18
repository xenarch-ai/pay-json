"""Tests for the pay.json Python reader."""

import json
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import respx

from pay_json import PayJson, PayJsonInvalid, PayJsonNotFound, Rule
from pay_json.reader import _build_url, _path_matches

EXAMPLES = Path(__file__).resolve().parent.parent.parent.parent / "examples"


def _load(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text())


class TestParseV10:
    def test_basic_example_parses(self):
        doc = PayJson.parse(_load("basic.json"))
        assert doc.version == "1.0"
        assert doc.protocol == "x402"
        assert len(doc.rules) == 3
        assert doc.rules[-1].price_usd == Decimal("0.003")

    def test_missing_required_field_raises(self):
        bad = {"version": "1.0"}
        with pytest.raises(PayJsonInvalid, match="missing required field"):
            PayJson.parse(bad)

    def test_invalid_receiver_address_raises(self):
        doc = _load("basic.json")
        doc["receiver"] = "not-an-address"
        with pytest.raises(PayJsonInvalid, match="invalid address"):
            PayJson.parse(doc)

    def test_invalid_price_raises(self):
        doc = _load("basic.json")
        doc["rules"][0]["price_usd"] = "cheap"
        with pytest.raises(PayJsonInvalid, match="invalid price_usd"):
            PayJson.parse(doc)

    def test_unsupported_version_raises(self):
        doc = _load("basic.json")
        doc["version"] = "2.0"
        with pytest.raises(PayJsonInvalid, match="unsupported version"):
            PayJson.parse(doc)

    def test_empty_rules_raises(self):
        doc = _load("basic.json")
        doc["rules"] = []
        with pytest.raises(PayJsonInvalid, match="non-empty array"):
            PayJson.parse(doc)


class TestParseV11:
    def test_terms_and_budget_hints_parsed(self):
        doc = PayJson.parse(_load("v1.1-with-terms.json"))
        assert doc.version == "1.1"
        inference = doc.rules[0]
        assert inference.terms == {"type": "per_unit", "unit": "1000_tokens"}
        assert inference.budget_hints == {
            "recommended_max_per_call": "0.05",
            "recommended_max_per_session": "1.00",
        }

    def test_v10_file_parses_under_v11_consumer(self):
        """§12 migration: v1.0 files remain valid. Reader supports both."""
        doc = PayJson.parse(_load("basic.json"))
        assert doc.version == "1.0"
        for rule in doc.rules:
            assert rule.terms is None
            assert rule.budget_hints is None

    def test_rule_missing_terms_type_raises(self):
        doc = _load("v1.1-with-terms.json")
        doc["rules"][0]["terms"] = {"unit": "token"}  # missing 'type'
        with pytest.raises(PayJsonInvalid, match="terms must be"):
            PayJson.parse(doc)

    def test_invalid_budget_hint_raises(self):
        doc = _load("v1.1-with-terms.json")
        doc["rules"][0]["budget_hints"]["recommended_max_per_call"] = "free"
        with pytest.raises(PayJsonInvalid, match="recommended_max_per_call"):
            PayJson.parse(doc)


class TestMatchRule:
    def setup_method(self):
        self.doc = PayJson.parse(_load("v1.1-with-terms.json"))

    def test_matches_nested_glob(self):
        rule = self.doc.match_rule("/api/inference/gpt4")
        assert rule is not None
        assert rule.price_usd == Decimal("0.01")

    def test_matches_catch_all(self):
        rule = self.doc.match_rule("/random/unmatched/page")
        assert rule is not None
        assert rule.path == "/**"

    def test_first_match_wins(self):
        rule = self.doc.match_rule("/report/annual")
        assert rule is not None
        assert rule.path == "/report/*"
        assert rule.price_usd == Decimal("0.25")

    def test_single_segment_star_does_not_cross_segments(self):
        assert _path_matches("/blog/*", "/blog/my-post") is True
        assert _path_matches("/blog/*", "/blog/2026/my-post") is False

    def test_double_star_crosses_segments(self):
        assert _path_matches("/data/**", "/data/deep/nested") is True

    def test_question_mark(self):
        assert _path_matches("/v?/data", "/v1/data") is True
        assert _path_matches("/v?/data", "/v10/data") is False


class TestFetch:
    @respx.mock
    def test_fetch_success(self):
        doc = _load("basic.json")
        respx.get("https://example.com/.well-known/pay.json").mock(
            return_value=httpx.Response(200, json=doc)
        )
        result = PayJson.fetch("example.com")
        assert result.version == "1.0"

    @respx.mock
    def test_fetch_404_raises_not_found(self):
        respx.get("https://example.com/.well-known/pay.json").mock(
            return_value=httpx.Response(404)
        )
        with pytest.raises(PayJsonNotFound):
            PayJson.fetch("example.com")

    @respx.mock
    def test_fetch_accepts_full_url(self):
        doc = _load("basic.json")
        respx.get("https://example.com/.well-known/pay.json").mock(
            return_value=httpx.Response(200, json=doc)
        )
        result = PayJson.fetch("https://example.com/some/path")
        assert result.version == "1.0"

    @respx.mock
    def test_fetch_invalid_json_raises(self):
        respx.get("https://example.com/.well-known/pay.json").mock(
            return_value=httpx.Response(200, text="{ not json")
        )
        with pytest.raises(PayJsonInvalid):
            PayJson.fetch("example.com")

    @respx.mock
    def test_fetch_refuses_to_follow_redirects(self):
        """SSRF guard: agent-supplied hostnames must not redirect to internal services."""
        from pay_json import PayJsonError

        respx.get("https://example.com/.well-known/pay.json").mock(
            return_value=httpx.Response(
                302, headers={"location": "http://169.254.169.254/latest/meta-data/"}
            )
        )
        with pytest.raises(PayJsonError, match="refused to follow redirect"):
            PayJson.fetch("example.com")


class TestBuildURL:
    def test_bare_host(self):
        assert _build_url("example.com") == "https://example.com/.well-known/pay.json"

    def test_https_url_strips_path(self):
        assert (
            _build_url("https://example.com/some/page?q=1")
            == "https://example.com/.well-known/pay.json"
        )

    def test_trailing_slash_stripped(self):
        assert _build_url("example.com/") == "https://example.com/.well-known/pay.json"
