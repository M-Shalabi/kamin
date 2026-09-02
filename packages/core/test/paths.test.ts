import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir, REPO_ROOT } from "../src/paths";

describe("paths", () => {
  test("REPO_ROOT is the repository root whether or not KAMIN_ROOT is set", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "packages/core/package.json"))).toBe(true);
    expect(dataDir("raw", "tarmeez")).toBe(join(REPO_ROOT, "data/raw/tarmeez"));
  });
});
