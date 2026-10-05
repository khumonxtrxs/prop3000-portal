import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPublicDocument, queryPublicDocuments } from "@/integrations/firebase/rest";
import { sortRows } from "@/lib/sort";
import type { Tables } from "@/lib/db-types";

/** Every listing status the public may see. Drafts are hidden by the rules and never asked for. */
const PUBLIC_STATUSES = ["published", "under_offer", "sold"];

const LIST_COLUMNS = [
  "id",
  "reference",
  "title",
  "address",
  "suburb",
  "city",
  "latitude",
  "longitude",
  "property_type",
  "condition",
  "bedrooms",
  "bathrooms",
  "erf_size",
  "price",
  "description",
  "photo_paths",
  "status",
  "agent_name",
  "created_at",
] as const satisfies ReadonlyArray<keyof Tables<"listings">>;

type PublicListing = Pick<Tables<"listings">, (typeof LIST_COLUMNS)[number]>;

/** Keeps only the public columns, so agent phone and email never reach the page source. */
function publicColumns(row: Tables<"listings">): PublicListing {
  return Object.fromEntries(LIST_COLUMNS.map((column) => [column, row[column] ?? null])) as PublicListing;
}

/** Public: all published Prop3000 Investments listings for the map/list page. */
export const listPublicListings = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await queryPublicDocuments<Tables<"listings">>("listings", "status", PUBLIC_STATUSES);
  return sortRows(rows.map(publicColumns), "created_at");
});

/** Public: a single listing by id (agent contact details are NOT exposed here). */
export const getPublicListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const row = await getPublicDocument<Tables<"listings">>("listings", data.id);
    return row && PUBLIC_STATUSES.includes(row.status) ? publicColumns(row) : null;
  });
