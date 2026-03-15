import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function loadSchema(): Record<string, unknown> {
  const schemaPath = resolve(__dirname, "../spec/pay-json-v1.schema.json");
  return JSON.parse(readFileSync(schemaPath, "utf-8"));
}

let _cachedValidator: ValidateFunction | undefined;

export function compileValidator(): ValidateFunction {
  if (_cachedValidator) return _cachedValidator;

  const schema = loadSchema();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv2020 as any)({ allErrors: true });
  (addFormats as any)(ajv);
  _cachedValidator = ajv.compile(schema) as ValidateFunction;
  return _cachedValidator;
}
