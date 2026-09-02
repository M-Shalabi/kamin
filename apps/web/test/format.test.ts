import { describe, expect, test } from "bun:test";
import { fmtInt, fmtMoney, fmtPct } from "../lib/format";

describe("format", () => {
  test("money, integers and percentages", () => {
    expect(fmtMoney(1234567.8)).toBe("$1,234,568");
    expect(fmtInt(4000.4)).toBe("4,000");
    expect(fmtPct(0.4567)).toBe("45.7%");
    expect(fmtMoney(null)).toBe("n/a");
  });
});
