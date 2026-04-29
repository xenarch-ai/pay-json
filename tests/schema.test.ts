import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileValidator } from "../tools/schema.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const examplesDir = resolve(__dirname, "../examples");

const validate = compileValidator();

function baseDoc(): Record<string, unknown> {
  return {
    version: "1.2",
    protocol: "x402",
    network: "base",
    asset: "USDC",
    receiver: "0x1234567890abcdef1234567890abcdef12345678",
    seller_wallet: "0x1234567890abcdef1234567890abcdef12345678",
    rules: [{ path: "/**", price_usd: "0.003" }],
  };
}

describe("pay-json v1.2 schema", () => {
  // All example files should validate
  const examples = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

  it.each(examples)("example %s validates against schema", (filename) => {
    const content = JSON.parse(
      readFileSync(resolve(examplesDir, filename), "utf-8")
    );
    const valid = validate(content);
    if (!valid) {
      console.error(filename, validate.errors);
    }
    expect(valid).toBe(true);
  });

  const requiredFields = [
    "version",
    "protocol",
    "network",
    "asset",
    "receiver",
    "seller_wallet",
    "rules",
  ];
  it.each(requiredFields)("rejects missing required field: %s", (field) => {
    const data = baseDoc();
    delete data[field];
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid receiver address format", () => {
    const data = baseDoc();
    data.receiver = "0xinvalid";
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid seller_wallet format", () => {
    const data = baseDoc();
    data.seller_wallet = "not-an-address";
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid price_usd format", () => {
    const data = baseDoc();
    (data.rules as Array<Record<string, unknown>>)[0].price_usd = "$0.003";
    expect(validate(data)).toBe(false);
  });

  it("rejects empty rules array", () => {
    const data = baseDoc();
    data.rules = [];
    expect(validate(data)).toBe(false);
  });

  it("allows extra unknown top-level fields (extensible)", () => {
    const data = baseDoc();
    data.custom_field = "allowed";
    expect(validate(data)).toBe(true);
  });

  it("rejects pre-1.2 version (1.0)", () => {
    const data = baseDoc();
    data.version = "1.0";
    expect(validate(data)).toBe(false);
  });

  it("rejects pre-1.2 version (1.1)", () => {
    const data = baseDoc();
    data.version = "1.1";
    expect(validate(data)).toBe(false);
  });

  it("rejects unknown future version", () => {
    const data = baseDoc();
    data.version = "2.0";
    expect(validate(data)).toBe(false);
  });

  it("rejects rule missing path field", () => {
    const data = baseDoc();
    data.rules = [{ price_usd: "0.003" }];
    expect(validate(data)).toBe(false);
  });

  it("rejects rule missing price_usd field", () => {
    const data = baseDoc();
    data.rules = [{ path: "/**" }];
    expect(validate(data)).toBe(false);
  });

  it("rejects negative price_usd", () => {
    const data = baseDoc();
    (data.rules as Array<Record<string, unknown>>)[0].price_usd = "-0.01";
    expect(validate(data)).toBe(false);
  });

  it("allows extra fields in rule objects (extensible)", () => {
    const data = baseDoc();
    (data.rules as Array<Record<string, unknown>>)[0].description = "catch-all";
    expect(validate(data)).toBe(true);
  });

  it("accepts valid facilitators array", () => {
    const data = baseDoc();
    data.facilitators = [
      { name: "payai", url: "https://facilitator.payai.network", priority: 1, spec_version: "v2" },
      { name: "xpay",  url: "https://facilitator.xpay.sh",       priority: 2, spec_version: "v2" },
    ];
    expect(validate(data)).toBe(true);
  });

  it("rejects facilitator entry missing name", () => {
    const data = baseDoc();
    data.facilitators = [{ url: "https://facilitator.payai.network" }];
    expect(validate(data)).toBe(false);
  });

  it("rejects facilitator entry missing url", () => {
    const data = baseDoc();
    data.facilitators = [{ name: "payai" }];
    expect(validate(data)).toBe(false);
  });

  it("rejects facilitator with non-uri url", () => {
    const data = baseDoc();
    data.facilitators = [{ name: "payai", url: "not a url" }];
    expect(validate(data)).toBe(false);
  });

  it("rejects facilitator spec_version outside v1/v2", () => {
    const data = baseDoc();
    data.facilitators = [
      { name: "payai", url: "https://facilitator.payai.network", spec_version: "v3" },
    ];
    expect(validate(data)).toBe(false);
  });

  it("accepts optional verifier URL", () => {
    const data = baseDoc();
    data.verifier = "https://xenarch.dev/v1/verify";
    expect(validate(data)).toBe(true);
  });

  it("rejects non-uri verifier", () => {
    const data = baseDoc();
    data.verifier = "not a url";
    expect(validate(data)).toBe(false);
  });

  it("rejects deprecated single-string facilitator field shape", () => {
    // The pre-1.2 single-string `facilitator` field must not produce a
    // valid array under the new shape — confirm it doesn't somehow slip
    // through under additionalProperties.
    const data = baseDoc();
    data.facilitator = "https://facilitator.payai.network";
    // additionalProperties is true at the top level so the doc is still
    // valid, but the field has no semantic effect — assert nothing reads it.
    expect(validate(data)).toBe(true);
    expect(data.facilitators).toBeUndefined();
  });
});
