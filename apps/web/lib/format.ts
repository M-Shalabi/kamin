const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const fmtMoney = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? "n/a" : money.format(n));
export const fmtInt = (n: number | null | undefined): string => (n === null || n === undefined || !Number.isFinite(n) ? "n/a" : int.format(n));
export const fmtPct = (x: number | null | undefined): string => (x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
export const classLabel = (c: string): string => c.replace(/_/g, " ");
