import { describe, it, expect } from "vitest";
import { generate } from "../tools/generate.js";
import { compileValidator } from "../tools/schema.js";

const validate = compileValidator();

describe("generate function", () => {
  const wallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  const receiver = "0x1234567890abcdef1234567890abcdef12345678";

  it("generates valid pay.json with defaults", () => {
    const result = generate({ wallet, receiver });
    expect(validate(result)).toBe(true);
    expect(result.version).toBe("1.0");
    expect(result.protocol).toBe("x402");
    expect(result.network).toBe("base");
    expect(result.asset).toBe("USDC");
    expect(result.seller_wallet).toBe(wallet);
    expect(result.receiver).toBe(receiver);
  });

  it("uses custom price", () => {
    const result = generate({ wallet, receiver, price: "0.01" });
    const rules = result.rules as Array<{ path: string; price_usd: string }>;
    expect(rules[0].price_usd).toBe("0.01");
  });

  it("includes all specified options", () => {
    const result = generate({
      wallet,
      receiver,
      price: "0.05",
      protocol: "x402",
      network: "ethereum",
      asset: "DAI",
      facilitator: "https://example.com/verify",
    });
    expect(validate(result)).toBe(true);
    expect(result.network).toBe("ethereum");
    expect(result.asset).toBe("DAI");
    expect(result.facilitator).toBe("https://example.com/verify");
  });

  it("throws on invalid wallet address", () => {
    expect(() =>
      generate({ wallet: "bad-address", receiver })
    ).toThrow();
  });

  it("throws on invalid receiver address", () => {
    expect(() =>
      generate({ wallet, receiver: "bad-address" })
    ).toThrow();
  });
});
