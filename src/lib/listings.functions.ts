import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const LIST_COLUMNS =
  "id, reference, title, address, suburb, city, latitude, longitude, property_type, condition, bedrooms, bathrooms, erf_size, price, description, photo_paths, status, agent_name, created_at";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Public: all published Prop3000 Investments listings for the map/list page. */
export const listPublicListings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("listings")
    .select(LIST_COLUMNS)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Public: a single listing by id (agent contact details are NOT exposed here). */
export const getPublicListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient()
      .from("listings")
      .select(LIST_COLUMNS)
      .eq("id", data.id)
      .neq("status", "draft")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
