import { describe, expect, test } from "bun:test";
import { CandidatesLoose } from "../src/detective/hunt";

describe("CandidatesLoose", () => {
  test("keeps based_in_saudi as stated, defaults it to true when absent, and drops nameless rows", () => {
    const r = CandidatesLoose.parse({ companies: [
      { name: "Bareq Valves", name_arabic: "بارق", url: "https://bariqgroup.com", city: "Dammam", what: "valves", based_in_saudi: "yes" },
      { name: "New Era Pipes", url: "https://newerapipefittings.com/sa", city: null, what: "exporter", based_in_saudi: false },
      { name: "Old Row", what: "x" },
      { name: "", what: "nameless" },
    ] });
    expect(r.companies.map((c) => [c.name, c.based_in_saudi])).toEqual([["Bareq Valves", true], ["New Era Pipes", false], ["Old Row", true]]);
  });
});
