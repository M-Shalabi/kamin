import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const g = globalThis as unknown as { __kaminSql?: ReturnType<typeof postgres> };
export const sql = g.__kaminSql ?? (g.__kaminSql = postgres(url, { max: 8, onnotice: () => {} }));
