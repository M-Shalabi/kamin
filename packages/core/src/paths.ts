import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fromModule(): string {
  try {
    return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  } catch {
    return process.cwd();
  }
}

export const REPO_ROOT: string = process.env.KAMIN_ROOT ? resolve(process.env.KAMIN_ROOT) : fromModule();
export const dataDir = (...parts: string[]): string => join(REPO_ROOT, "data", ...parts);
