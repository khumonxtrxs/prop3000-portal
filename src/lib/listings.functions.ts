import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { COLLECTIONS } from "@/integrations/firebase/config";
import {
  decodeFirestoreDocument,
  getFirestoreDocument,
  runFirestoreQuery,
} from "@/integrations/firebase/rest";

type PublicListing = {
  reference: string;
  title: string;
  address: string;
  suburb: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  condition: string;
  bedrooms: number | null;
  bathrooms: number | null;
  erf_size: string | null;
  price: number;
  description: string | null;
  photo_paths: string[];
  status: string;
  agent_name: string | null;
  created_at: string;
};

/** Public: all published Prop3000 Investments listings for the map/list page. */
export const listPublicListings = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await runFirestoreQuery({
      structuredQuery: {
        from: [
          {
            collectionId: COLLECTIONS.listings,
          },
        ],

        where: {
          fieldFilter: {
            field: {
              fieldPath: "status",
            },
            op: "NOT_EQUAL",
            value: {
              stringValue: "draft",
            },
          },
        },

        orderBy: [
          {
            field: {
              fieldPath: "status",
            },
            direction: "ASCENDING",
          },
          {
            field: {
              fieldPath: "created_at",
            },
            direction: "DESCENDING",
          },
        ],
      },
    });

    return rows
      .filter((row) => row.document)
      .map((row) =>
        decodeFirestoreDocument<PublicListing>(row.document!),
      );
  },
);

/** Public: a single published listing by id. */
export const getPublicListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const listing = await getFirestoreDocument<PublicListing>(
      COLLECTIONS.listings,
      data.id,
    );

    if (!listing) {
      return null;
    }

    if (listing.status === "draft") {
      return null;
    }

    return listing;
  });
