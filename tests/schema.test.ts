import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileValidator } from "../tools/schema.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const examplesDir = resolve(__dirname, "../examples");

const validate = compileValidator();

describe("pay-json-v1 schema", () => {
  // All example files should validate
  const examples = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

  it.each(examples)("example %s validates against schema", (filename) => {
    const content = JSON.parse(
      readFileSync(resolve(examplesDir, filename), "utf-8")
    );
    const valid = validate(content);
    if (!valid) {
      console.error(validate.errors);
    }
    expect(valid).toBe(true);
  });

  const requiredFields = ["version", "protocol", "network", "asset", "receiver", "seller_wallet", "rules"];
  it.each(requiredFields)("rejects missing required field: %s", (field) => {
    const data: Record<string, unknown> = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "0.003" }],
    };
    delete data[field];
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid wallet address format", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0xinvalid",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "0.003" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid seller_wallet format", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "not-an-address",
      rules: [{ path: "/**", price_usd: "0.003" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects invalid price_usd format", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "$0.003" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects empty rules array", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [],
    };
    expect(validate(data)).toBe(false);
  });

  it("allows extra unknown fields (extensible)", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "0.003" }],
      custom_field: "allowed",
    };
    expect(validate(data)).toBe(true);
  });

  it("rejects invalid version", () => {
    const data = {
      version: "2.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "0.003" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects rule missing path field", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ price_usd: "0.003" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects rule missing price_usd field", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("rejects negative price_usd", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "-0.01" }],
    };
    expect(validate(data)).toBe(false);
  });

  it("allows extra fields in rule objects (extensible)", () => {
    const data = {
      version: "1.0",
      protocol: "x402",
      network: "base",
      asset: "USDC",
      receiver: "0x1234567890abcdef1234567890abcdef12345678",
      seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      rules: [{ path: "/**", price_usd: "0.003", description: "catch-all" }],
    };
    expect(validate(data)).toBe(true);
  });
});
