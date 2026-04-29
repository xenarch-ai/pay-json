import { describe, it, expect } from "vitest";
import { generate } from "../tools/generate.js";
import { compileValidator } from "../tools/schema.js";

const validate = compileValidator();

describe("generate function", () => {
  const wallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

  it("generates valid pay.json with defaults (no-splitter: receiver === wallet)", () => {
    const result = generate({ wallet });
    expect(validate(result)).toBe(true);
    expect(result.version).toBe("1.2");
    expect(result.protocol).toBe("x402");
    expect(result.network).toBe("base");
    expect(result.asset).toBe("USDC");
    expect(result.seller_wallet).toBe(wallet);
    expect(result.receiver).toBe(wallet);
  });

  it("uses custom price", () => {
    const result = generate({ wallet, price: "0.01" });
    const rules = result.rules as Array<{ path: string; price_usd: string }>;
    expect(rules[0].price_usd).toBe("0.01");
  });

  it("accepts an explicit distinct receiver address", () => {
    const distinctReceiver = "0x1234567890abcdef1234567890abcdef12345678";
    const result = generate({ wallet, receiver: distinctReceiver });
    expect(validate(result)).toBe(true);
    expect(result.receiver).toBe(distinctReceiver);
    expect(result.seller_wallet).toBe(wallet);
  });

  it("includes facilitators array when supplied", () => {
    const result = generate({
      wallet,
      facilitators: [
        { name: "payai", url: "https://facilitator.payai.network", priority: 1, spec_version: "v2" },
        { name: "xpay",  url: "https://facilitator.xpay.sh",       priority: 2, spec_version: "v2" },
      ],
    });
    expect(validate(result)).toBe(true);
    expect(result.facilitators).toEqual([
      { name: "payai", url: "https://facilitator.payai.network", priority: 1, spec_version: "v2" },
      { name: "xpay",  url: "https://facilitator.xpay.sh",       priority: 2, spec_version: "v2" },
    ]);
  });

  it("includes verifier when supplied", () => {
    const result = generate({
      wallet,
      verifier: "https://xenarch.dev/v1/verify",
    });
    expect(validate(result)).toBe(true);
    expect(result.verifier).toBe("https://xenarch.dev/v1/verify");
  });

  it("auto-includes xenarch tools block when provider=xenarch", () => {
    const result = generate({ wallet, provider: "xenarch" });
    expect(validate(result)).toBe(true);
    expect(result.provider).toBe("xenarch");
    expect(result.tools).toBeDefined();
  });

  it("throws on invalid wallet address", () => {
    expect(() => generate({ wallet: "bad-address" })).toThrow();
  });

  it("throws on invalid receiver address", () => {
    expect(() =>
      generate({ wallet, receiver: "bad-address" })
    ).toThrow();
  });
});
