import { describe, expect, test } from "bun:test";
import { mapPlant } from "../src/tarmeez/map";
import plant from "./fixtures/tarmeez-plant-41699.json";
import type { PlantDetail } from "../src/tarmeez/client";

describe("mapPlant", () => {
  const mapped = mapPlant(plant as PlantDetail);

  test("maps the supplier with the CR number as join key", () => {
    expect(mapped.supplier.id).toBe("tarmeez:41699");
    expect(mapped.supplier.cr_number).toBe("2055024776");
    expect(mapped.supplier.region_en).toBe("Eastern Region");
    expect(mapped.supplier.city_ar).toBe("الجبيل");
    expect(mapped.supplier.investment_type).toBe("Mutual Investment");
    expect(mapped.supplier.website).toBeNull();
    expect(mapped.supplier.in_tarmeez).toBe(true);
  });

  test("strips the leading tariff code from product titles and derives hs6", () => {
    expect(mapped.products).toHaveLength(1);
    expect(mapped.products[0]).toMatchObject({ tariff_code: "848100000000", hs6: "848100", title_en: "Taps- cocks- valves and similar appliances for pipes", title_ar: "حنفيات وصنابير وصمامات" });
  });

  test("collapses duplicate tariff lines into one capability with declared_lines", () => {
    expect(mapped.capabilities).toHaveLength(1);
    expect(mapped.capabilities[0]).toMatchObject({ supplier_id: "tarmeez:41699", tariff_code: "848100000000", class: "manufacturer", verdict: "pending", declared_amount: 150, declared_unit: "Ton" });
    expect(mapped.capabilities[0]!.declared_lines).toEqual([{ amount: 150, unit: "Ton" }, { amount: 200, unit: "Piece" }]);
  });

  test("writes one tier-2 evidence per capability pointing at the API record", () => {
    expect(mapped.evidence).toHaveLength(1);
    expect(mapped.evidence[0]).toMatchObject({ tier: 2, source_type: "tarmeez_plant", source_url: "https://psnr.mim.gov.sa/CatalogApi/api/v1/factories/plants/41699" });
    expect(mapped.evidence[0]!.excerpt).toContain("150 Ton");
  });

  test("blank strings become null", () => {
    const m = mapPlant({ ...(plant as PlantDetail), WebSiteUrl: "  ", Email: "" });
    expect(m.supplier.website).toBeNull();
    expect(m.supplier.email).toBeNull();
  });
});
