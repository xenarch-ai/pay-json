#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileValidator } from "./schema.js";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const useColor = !process.env.NO_COLOR && process.stdout.isTTY === true;

const red = (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s);
const yellow = (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s);

export function validate(filePath: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // Read and parse file
  let data: Record<string, unknown>;
  try {
    const content = readFileSync(filePath, "utf-8");
    data = JSON.parse(content);
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? `Invalid JSON: ${err.message}`
        : `Cannot read file: ${(err as Error).message}`;
    result.valid = false;
    result.errors.push(message);
    return result;
  }

  // Validate against schema
  const validateFn = compileValidator();
  const valid = validateFn(data);

  if (!valid && validateFn.errors) {
    result.valid = false;
    for (const err of validateFn.errors) {
      const path = err.instancePath || "/";
      result.errors.push(`${path}: ${err.message}`);
    }
  }

  // Lint: warn if wildcard /* appears before more specific rules
  if (Array.isArray(data.rules)) {
    let wildcardIndex = -1;
    let wildcardPath = "";
    for (let i = 0; i < data.rules.length; i++) {
      const rule = data.rules[i] as { path?: string };
      if (rule.path === "/*" || rule.path === "/**") {
        wildcardIndex = i;
        wildcardPath = rule.path;
      } else if (wildcardIndex >= 0 && wildcardIndex < i) {
        result.warnings.push(
          `Rule order: wildcard "${wildcardPath}" at index ${wildcardIndex} shadows rule "${rule.path}" at index ${i}. ` +
            `Consider moving "${wildcardPath}" to the end.`
        );
      }
    }
  }

  return result;
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const jsonOutput = args.includes("--json");
  const files = args.filter((a) => !a.startsWith("--"));

  if (files.length === 0) {
    console.error("Usage: pay-json-validate <file> [--quiet] [--json]");
    process.exit(1);
  }

  const filePath = resolve(files[0]);
  const result = validate(filePath);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  }

  if (result.valid) {
    if (!quiet) {
      console.log(green("✓ Valid pay.json"));
    }
    for (const warning of result.warnings) {
      console.log(yellow(`⚠ ${warning}`));
    }
    process.exit(0);
  } else {
    if (!quiet) {
      console.log(red("✗ Invalid pay.json"));
    }
    for (const error of result.errors) {
      console.error(red(`  ${error}`));
    }
    for (const warning of result.warnings) {
      console.log(yellow(`⚠ ${warning}`));
    }
    process.exit(1);
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
  main();
}
