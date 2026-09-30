import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { BedDouble, Bath, Ruler, MapPin as MapPinIcon, Search } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { LazyMap } from "@/components/LazyMap";
import type { MapPin } from "@/components/MapCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPublicListings } from "@/lib/listings.functions";
import { COMPANY, money, prettyStatus } from "@/lib/prop3000";

const listingsQuery = queryOptions({
  queryKey: ["public-listings"],
  queryFn: () => listPublicListings(),
});

export const Route = createFileRoute("/listings/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  head: () => ({
    meta: [
      { title: "Distressed Property For Sale — Prop3000 Investments" },
      {
        name: "description",
        content:
          "Browse Prop3000 Investments' distressed and fixer-upper properties on a map, then submit an offer online. No agent phone calls needed.",
      },
      { property: "og:title", content: "Property listings — Prop3000 Investments" },
      { property: "og:description", content: "Fixer-uppers, incomplete builds and late estates for sale. Bid online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-display text-3xl">Listings are unavailable</h1>
        <p className="mt-3 text-muted-foreground">{error.message}</p>
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">Nothing here.</div>
    </SiteLayout>
  ),
  component: ListingsPage,
});

function ListingsPage() {
  const { data } = useSuspenseQuery(listingsQuery);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const cap = Number(maxPrice.replace(/\D/g, "")) || 0;
    return data.filter((row) => {
      const haystack = `${row.title} ${row.address} ${row.suburb ?? ""} ${row.city ?? ""}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (cap && Number(row.price) > cap) return false;
      return true;
    });
  }, [data, term, maxPrice]);

  const mapped = filtered.filter((row) => row.latitude !== null && row.longitude !== null);
  const pins: MapPin[] = [
    { ...COMPANY.baseCoords, label: "Prop3000 office", kind: "office" },
    ...mapped.map((row) => ({
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      label: `${row.title} — ${money(Number(row.price))}`,
      kind: "listing" as const,
    })),
  ];

  function openPin(index: number) {
    const row = mapped[index - 1];
    if (row) void navigate({ to: "/listings/$id", params: { id: row.id } });
  }


  return (
    <SiteLayout>
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <span className="text-xs font-bold uppercase tracking-widest text-brick">Prop3000 Investments</span>
          <h1 className="text-display mt-3 text-4xl sm:text-5xl">Property listings</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Distressed, half-built and estate properties for sale. Find one on the map, then submit an offer online — an
            agent reviews it and you'll be notified the moment the status changes.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search suburb, town or address"
                className="pl-9"
                maxLength={80}
                aria-label="Search listings"
              />
            </div>
            <Input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max price (R)"
              className="w-40"
              inputMode="numeric"
              aria-label="Maximum price"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {filtered.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              No listings match that search yet.
            </p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2">
              {filtered.map((row) => (
                <li
                  key={row.id}
                  onMouseEnter={() => setFocused(row.id)}
                  onMouseLeave={() => setFocused(null)}
                  className={`hover-lift overflow-hidden rounded-xl border bg-card shadow-panel transition-colors ${
                    focused === row.id ? "border-accent" : "border-border"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-display text-xl leading-tight">{row.title}</h2>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold uppercase">
                        {prettyStatus(row.status)}
                      </span>
                    </div>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brick" />
                      {row.address}
                    </p>
                    <p className="text-display mt-3 text-2xl text-brick">{money(Number(row.price))}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {row.bedrooms ? (
                        <span className="flex items-center gap-1.5">
                          <BedDouble className="size-4" /> {row.bedrooms}
                        </span>
                      ) : null}
                      {row.bathrooms ? (
                        <span className="flex items-center gap-1.5">
                          <Bath className="size-4" /> {row.bathrooms}
                        </span>
                      ) : null}
                      {row.erf_size ? (
                        <span className="flex items-center gap-1.5">
                          <Ruler className="size-4" /> {row.erf_size}
                        </span>
                      ) : null}
                    </div>
                    <Button asChild variant="accent" size="sm" className="mt-4 w-full">
                      <Link to="/listings/$id" params={{ id: row.id }}>
                        View & make an offer
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <LazyMap pins={pins} className="h-[32rem] w-full" zoom={10} onPinClick={openPin} />
            <p className="mt-2 text-xs text-muted-foreground">
              Tap a map pin to open that property. Map data © Mapbox.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
