"use client";
export function ColdMiss({ supplierId }: { supplierId: string }) {
  return <p className="text-sm" style={{ color: "var(--muted)" }}>Live investigation for {supplierId} arrives in Task 6.</p>;
}
