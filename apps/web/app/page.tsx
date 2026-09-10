import { redirect } from "next/navigation";

/* The front door.
 *
 * Suppliers is what a visitor should land on: it is the map itself, and it is
 * the screen that answers the first question anyone asks. The gap ledger lives
 * at /orders, alongside the pooled order it drills into.
 *
 * A redirect rather than a copy of the suppliers page, so there is exactly one
 * implementation of that screen and one URL that owns it. */
export default function Page() {
  redirect("/suppliers");
}
