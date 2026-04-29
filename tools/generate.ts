#!/usr/bin/env node

import { writeFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { compileValidator } from "./schema.js";

interface FacilitatorEntry {
  name: string;
  url: string;
  priority?: number;
  spec_version?: "v1" | "v2";
}

interface GenerateOptions {
  wallet: string;
  receiver?: string;
  price?: string;
  protocol?: string;
  network?: string;
  asset?: string;
  facilitators?: FacilitatorEntry[];
  verifier?: string;
  provider?: string;
  output?: string;
}

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

const DEFAULT_FACILITATORS: FacilitatorEntry[] = [
  { name: "payai",        url: "https://facilitator.payai.network", priority: 1, spec_version: "v2" },
  { name: "xpay",         url: "https://facilitator.xpay.sh",       priority: 2, spec_version: "v2" },
  { name: "ultravioleta", url: "https://x402.ultravioleta.dev",     priority: 3, spec_version: "v2" },
];

export function generate(options: GenerateOptions): Record<string, unknown> {
  if (!WALLET_RE.test(options.wallet)) {
    throw new Error(`Invalid wallet address: ${options.wallet}`);
  }
  // No-splitter default: receiver === seller_wallet. Callers MAY pass a
  // distinct receiver (e.g. their own escrow contract) explicitly.
  const receiver = options.receiver ?? options.wallet;
  if (!WALLET_RE.test(receiver)) {
    throw new Error(`Invalid receiver address: ${receiver}`);
  }

  const payJson: Record<string, unknown> = {
    version: "1.2",
    protocol: options.protocol ?? "x402",
    network: options.network ?? "base",
    asset: options.asset ?? "USDC",
    receiver,
    seller_wallet: options.wallet,
    rules: [
      { path: "/**", price_usd: options.price ?? "0.003" },
    ],
  };

  if (options.facilitators && options.facilitators.length > 0) {
    payJson.facilitators = options.facilitators;
  }

  if (options.verifier) {
    payJson.verifier = options.verifier;
  }

  if (options.provider) {
    payJson.provider = options.provider;

    // Auto-include tools for known providers.
    if (options.provider === "xenarch") {
      payJson.tools = {
        cli: {
          install: "npm install -g xenarch",
          usage: "xenarch pay <url>",
        },
        sdk: {
          npm: "xenarch",
          pypi: "xenarch",
        },
        docs: "https://xenarch.com/docs",
      };
    }
  }

  // Validate against schema
  const validateFn = compileValidator();
  const valid = validateFn(payJson);

  if (!valid && validateFn.errors) {
    const messages = validateFn.errors.map(
      (e) => `${e.instancePath || "/"}: ${e.message}`
    );
    throw new Error(`Generated pay.json is invalid:\n  ${messages.join("\n  ")}`);
  }

  return payJson;
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--") && i + 1 < args.length) {
      const key = arg.slice(2);
      result[key] = args[++i];
    }
  }
  return result;
}

// Parse a comma-separated list of "name=url" pairs (optionally
// "name=url@v1" / "@v2" to set spec_version) into FacilitatorEntry[].
function parseFacilitators(raw: string): FacilitatorEntry[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, idx) => {
      const eq = entry.indexOf("=");
      if (eq < 1) {
        throw new Error(
          `Invalid --facilitators entry "${entry}" — expected "name=url[@v1|@v2]"`
        );
      }
      const name = entry.slice(0, eq);
      let url = entry.slice(eq + 1);
      let spec_version: "v1" | "v2" | undefined;
      const at = url.lastIndexOf("@");
      if (at > 0 && (url.endsWith("@v1") || url.endsWith("@v2"))) {
        spec_version = url.endsWith("@v2") ? "v2" : "v1";
        url = url.slice(0, at);
      }
      const out: FacilitatorEntry = { name, url, priority: idx + 1 };
      if (spec_version) out.spec_version = spec_version;
      return out;
    });
}

async function interactive(): Promise<GenerateOptions> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const wallet = await rl.question("Publisher wallet address (0x...): ");
  if (!WALLET_RE.test(wallet)) {
    rl.close();
    throw new Error(`Invalid wallet address: ${wallet}`);
  }

  const price = (await rl.question("Default price in USD (0.003): ")) || "0.003";
  rl.close();

  return { wallet, price };
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  let options: GenerateOptions;

  if (!parsed.wallet) {
    if (process.stdin.isTTY) {
      options = await interactive();
    } else {
      console.error(
        "Usage: pay-json-generate --wallet <address> [options]\n\n" +
          "Options:\n" +
          "  --wallet <address>       Publisher wallet (required, also used as receiver by default)\n" +
          "  --receiver <address>     Override receiver (default: same as --wallet, no-splitter)\n" +
          "  --price <usd>            Default price (default: 0.003)\n" +
          "  --protocol <proto>       Payment protocol (default: x402)\n" +
          "  --network <net>          Network (default: base)\n" +
          "  --asset <asset>          Asset (default: USDC)\n" +
          "  --facilitators <list>    Comma-separated facilitator entries: name=url[@v1|@v2]\n" +
          "                           (e.g. payai=https://facilitator.payai.network@v2,xpay=https://facilitator.xpay.sh@v2)\n" +
          "  --verifier <url>         Optional independent verifier endpoint URL\n" +
          "  --provider <name>        Provider name (optional, auto-includes tools for xenarch)\n" +
          "  --output <file>          Output file (default: stdout)"
      );
      process.exit(1);
    }
  } else {
    if (!WALLET_RE.test(parsed.wallet)) {
      console.error(`Invalid wallet address: ${parsed.wallet}`);
      process.exit(1);
    }
    if (parsed.receiver && !WALLET_RE.test(parsed.receiver)) {
      console.error(`Invalid receiver address: ${parsed.receiver}`);
      process.exit(1);
    }

    let facilitators: FacilitatorEntry[] | undefined;
    if (parsed.facilitators) {
      try {
        facilitators = parseFacilitators(parsed.facilitators);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    }

    options = {
      wallet: parsed.wallet,
      receiver: parsed.receiver,
      price: parsed.price,
      protocol: parsed.protocol,
      network: parsed.network,
      asset: parsed.asset,
      facilitators,
      verifier: parsed.verifier,
      provider: parsed.provider,
      output: parsed.output,
    };
  }

  const payJson = generate(options);
  const json = JSON.stringify(payJson, null, 2) + "\n";

  if (options.output) {
    writeFileSync(resolve(options.output), json, "utf-8");
    console.error(`Written to ${options.output}`);
  } else {
    process.stdout.write(json);
  }
}

// Run CLI if invoked directly
const isMain = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
