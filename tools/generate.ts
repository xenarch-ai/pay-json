#!/usr/bin/env node

import { writeFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { compileValidator } from "./schema.js";

interface GenerateOptions {
  wallet: string;
  receiver: string;
  price?: string;
  protocol?: string;
  network?: string;
  asset?: string;
  facilitator?: string;
  provider?: string;
  output?: string;
}

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

export function generate(options: GenerateOptions): Record<string, unknown> {
  if (!WALLET_RE.test(options.wallet)) {
    throw new Error(`Invalid wallet address: ${options.wallet}`);
  }
  if (!WALLET_RE.test(options.receiver)) {
    throw new Error(`Invalid receiver address: ${options.receiver}`);
  }

  const payJson: Record<string, unknown> = {
    version: "1.0",
    protocol: options.protocol ?? "x402",
    network: options.network ?? "base",
    asset: options.asset ?? "USDC",
    receiver: options.receiver,
    seller_wallet: options.wallet,
    rules: [
      { path: "/**", price_usd: options.price ?? "0.003" },
    ],
  };

  if (options.facilitator) {
    payJson.facilitator = options.facilitator;
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

  const receiver = await rl.question("Receiver/splitter contract address (0x...): ");
  if (!WALLET_RE.test(receiver)) {
    rl.close();
    throw new Error(`Invalid receiver address: ${receiver}`);
  }

  const price = (await rl.question("Default price in USD (0.003): ")) || "0.003";
  rl.close();

  return { wallet, receiver, price };
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  let options: GenerateOptions;

  if (!parsed.wallet || !parsed.receiver) {
    if (process.stdin.isTTY) {
      options = await interactive();
    } else {
      console.error(
        "Usage: pay-json-generate --wallet <address> --receiver <address> [options]\n\n" +
          "Options:\n" +
          "  --wallet <address>       Publisher wallet (required)\n" +
          "  --receiver <address>     Splitter contract address (required)\n" +
          "  --price <usd>            Default price (default: 0.003)\n" +
          "  --protocol <proto>       Payment protocol (default: x402)\n" +
          "  --network <net>          Network (default: base)\n" +
          "  --asset <asset>          Asset (default: USDC)\n" +
          "  --facilitator <url>      Facilitator URL (optional)\n" +
          "  --provider <name>        Provider name (optional, auto-includes tools for known providers)\n" +
          "  --output <file>          Output file (default: stdout)"
      );
      process.exit(1);
    }
  } else {
    if (!WALLET_RE.test(parsed.wallet)) {
      console.error(`Invalid wallet address: ${parsed.wallet}`);
      process.exit(1);
    }
    if (!WALLET_RE.test(parsed.receiver)) {
      console.error(`Invalid receiver address: ${parsed.receiver}`);
      process.exit(1);
    }

    options = {
      wallet: parsed.wallet,
      receiver: parsed.receiver,
      price: parsed.price,
      protocol: parsed.protocol,
      network: parsed.network,
      asset: parsed.asset,
      facilitator: parsed.facilitator,
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
