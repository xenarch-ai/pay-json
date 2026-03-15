import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { validate } from "../tools/validate.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

describe("validate function", () => {
  it("returns valid for a correct pay.json", () => {
    const filePath = resolve(__dirname, "../examples/basic.json");
    const result = validate(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid for a bad file", () => {
    const tmp = mkdtempSync(resolve(tmpdir(), "payjson-"));
    const badFile = resolve(tmp, "bad.json");
    writeFileSync(badFile, JSON.stringify({ version: "1.0" }));
    const result = validate(badFile);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    rmSync(tmp, { recursive: true });
  });

  it("returns error for non-existent file", () => {
    const result = validate("/nonexistent/pay.json");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Cannot read file");
  });

  it("returns error for invalid JSON", () => {
    const tmp = mkdtempSync(resolve(tmpdir(), "payjson-"));
    const badFile = resolve(tmp, "notjson.json");
    writeFileSync(badFile, "{ this is not json }");
    const result = validate(badFile);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid JSON");
    rmSync(tmp, { recursive: true });
  });

  it("warns when wildcard rule shadows later rules", () => {
    const tmp = mkdtempSync(resolve(tmpdir(), "payjson-"));
    const file = resolve(tmp, "shadowed.json");
    writeFileSync(
      file,
      JSON.stringify({
        version: "1.0",
        protocol: "x402",
        network: "base",
        asset: "USDC",
        receiver: "0x1234567890abcdef1234567890abcdef12345678",
        seller_wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        rules: [
          { path: "/*", price_usd: "0.003" },
          { path: "/blog/*", price_usd: "0.01" },
        ],
      })
    );
    const result = validate(file);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("wildcard");
    rmSync(tmp, { recursive: true });
  });

  it("no warnings when wildcard is last", () => {
    const filePath = resolve(__dirname, "../examples/basic.json");
    const result = validate(filePath);
    expect(result.warnings).toHaveLength(0);
  });
});
