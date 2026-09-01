import { z } from "zod";

export const MATERIALS = ["stainless_steel", "carbon_steel", "cast_iron", "ductile_iron", "brass", "bronze", "copper", "aluminium", "pvc", "pvdf", "pp", "hdpe", "other"] as const;
export const CONNECTIONS = ["flanged", "threaded", "butt_weld", "socket_weld", "wafer", "lug", "grooved", "push_fit", "other"] as const;
export const FAMILIES = ["valve", "pump", "fitting", "flange", "other"] as const;

export const NormalizedSpec = z.object({
  object_class: z.string().describe("The generic English name of the object, for example 'ball valve', 'gate valve', 'centrifugal pump', 'butt weld elbow', 'blind flange'"),
  object_family: z.enum(FAMILIES),
  size_inch: z.number().nullable().describe("Nominal size in inches if stated or derivable"),
  size_dn: z.number().nullable().describe("Nominal size as DN if stated"),
  pressure_bar: z.number().nullable().describe("Pressure rating in bar if stated as bar, PN or psi"),
  pressure_class: z.string().nullable().describe("ANSI/ASME class token such as '150' or '300' if stated"),
  material: z.enum(MATERIALS).nullable(),
  material_grade: z.string().nullable().describe("Grade such as '316', '316L', '304', 'A105', 'WCB'"),
  connection: z.enum(CONNECTIONS).nullable(),
  standard: z.string().nullable().describe("A named standard such as 'ASTM A403', 'BS 5163', 'API 600'"),
  quantity: z.number().nullable(),
  quantity_unit: z.string().nullable(),
  extra_attrs: z.array(z.object({ key: z.string(), value: z.string() })).describe("Anything else stated: flow, head, power, voltage, seat material, operator, schedule, face type"),
  english_description: z.string().describe("One clean English line describing the object with its key attributes"),
  source_language: z.enum(["ar", "en", "mixed"]),
});
export type NormalizedSpecT = z.infer<typeof NormalizedSpec>;

export const HsChoice = z.object({
  hs6: z.string().regex(/^\d{6}$/),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type HsChoiceT = z.infer<typeof HsChoice>;
