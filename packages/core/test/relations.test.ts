import { describe, expect, test } from "bun:test";
import { RelationsLoose, canonRelation } from "../src/graph/relations";

describe("canonRelation", () => {
  test("maps free-text predicates to the seven the graph knows, normalises the object, drops junk", () => {
    expect(canonRelation({ predicate: "authorised distributor of", object: "Armstrong Pumps" })).toEqual({ predicate: "distributes_brand", object: "Armstrong Pumps" });
    expect(canonRelation({ predicate: "subsidiary of", object: "Alkhorayef Group" })).toEqual({ predicate: "part_of_group", object: "Alkhorayef Group" });
    expect(canonRelation({ predicate: "ISO certified by", object: "TÜV" })).toEqual({ predicate: "certified_by", object: "TÜV" });
    expect(canonRelation({ predicate: "complies with", object: "api 608" })).toEqual({ predicate: "meets_standard", object: "API 608" });
    expect(canonRelation({ predicate: "made of", object: "Stainless steel 316" })).toEqual({ predicate: "makes_with_material", object: "stainless steel 316" });
    expect(canonRelation({ predicate: "sells", object: "valves" })).toBeNull();
    expect(canonRelation({ predicate: "meets_standard", object: "" })).toBeNull();
  });
});

describe("RelationsLoose", () => {
  test("tolerates a JSON string, missing evidence and prose predicates", () => {
    const r = RelationsLoose.parse('[{"predicate": "distributor of", "object": "Grundfos", "url": "https://x/y", "excerpt": "authorised Grundfos distributor"}, {"predicate": "meets standard", "object": "ASME B16.5"}, {"predicate": "sells", "object": "pumps"}]');
    expect(r).toEqual([
      { predicate: "distributes_brand", object: "Grundfos", url: "https://x/y", excerpt: "authorised Grundfos distributor" },
      { predicate: "meets_standard", object: "ASME B16.5", url: null, excerpt: null },
    ]);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("mergeRelations", () => {
  test("upserts typed edges with their evidence and links a group to a supplier on the map when the name matches", async () => {
    const { sql } = await import("../src/db/client");
    const { migrate } = await import("../src/db/migrate");
    const { mergeRelations, relationsOf } = await import("../src/graph/relations");
    await migrate(sql);
    await sql`delete from suppliers where id in ('test:rel1', 'test:rel2')`;
    await sql`insert into suppliers (id, name_en, source, in_tarmeez) values ('test:rel1', 'Sana Engineering', 'test', true), ('test:rel2', 'Alkhorayef Group', 'test', true)`;
    const [run] = await sql<{ id: string }[]>`insert into runs (role, input_ref, model) values ('specifier', 'test:rel1', 'm') returning id`;
    const n = await mergeRelations(sql, "test:rel1", [
      { predicate: "distributes_brand", object: "Armstrong", url: "https://saudisana.com/armstrong", excerpt: "authorised distributor of Armstrong pumps" },
      { predicate: "part_of_group", object: "Alkhorayef Group", url: null, excerpt: null },
      { predicate: "distributes_brand", object: "Armstrong", url: "https://saudisana.com/armstrong", excerpt: "again" },
    ], run!.id);
    expect(n).toBe(2);
    const rels = await relationsOf(sql, "test:rel1");
    expect(rels.map((r) => [r.predicate, r.object, r.object_id])).toEqual([["distributes_brand", "Armstrong", null], ["part_of_group", "Alkhorayef Group", "test:rel2"]]);
    await sql`delete from suppliers where id in ('test:rel1', 'test:rel2')`;
  });
});
