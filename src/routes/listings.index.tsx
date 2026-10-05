import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { LazyMap } from "@/components/LazyMap";
import type { MapPin } from "@/components/MapCanvas";
import { StatusBadge } from "@/components/StatusBadge";
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
        <p className="mt-3 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
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

const PRICE_BANDS = [
  { value: "any", label: "Any price", test: () => true },
  { value: "under700", label: "Under R700 000", test: (p: number) => p < 700_000 },
  { value: "700to1m", label: "R700 000 – R1m", test: (p: number) => p >= 700_000 && p <= 1_000_000 },
  { value: "over1m", label: "Over R1m", test: (p: number) => p > 1_000_000 },
] as const;

const TYPES = [
  { value: "any", label: "Any type" },
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "vacant_land", label: "Vacant land" },
  { value: "incomplete_build", label: "Incomplete build" },
] as const;

const SELECT_CLASS =
  "h-12 rounded-sm border border-input bg-card px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Pin label: "R890k" or "R1.25m". */
function shortPrice(price: number) {
  return price >= 1_000_000 ? `R${(price / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `R${Math.round(price / 1000)}k`;
}

function ListingsPage() {
  const { data } = useSuspenseQuery(listingsQuery);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [band, setBand] = useState<string>("any");
  const [type, setType] = useState<string>("any");
  const [focused, setFocused] = useState<string | null>(null);

  // Client-side filtering over the already-fetched set; it drives the map and the list together.
  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const priceTest = PRICE_BANDS.find((b) => b.value === band)?.test ?? (() => true);
    return data.filter((row) => {
      const haystack = `${row.address} ${row.suburb ?? ""} ${row.city ?? ""} ${row.title}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (!priceTest(Number(row.price))) return false;
      if (type !== "any" && row.property_type !== type) return false;
      return true;
    });
  }, [data, term, band, type]);

  const mapped = filtered.filter((row) => row.latitude !== null && row.longitude !== null);
  const pins: MapPin[] = [
    { ...COMPANY.baseCoords, label: "Prop3000 office", kind: "office" },
    ...mapped.map((row) => ({
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      label: `Open ${row.title}, ${money(Number(row.price))}`,
      text: shortPrice(Number(row.price)),
      active: focused === row.id,
      kind: "listing" as const,
    })),
  ];

  function openPin(index: number) {
    const row = mapped[index - 1];
    if (row) void navigate({ to: "/listings/$id", params: { id: row.id } });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-label text-[12px] text-ink-subtle">Prop3000 Investments</p>
            <h1 className="text-display mt-3 text-5xl uppercase text-foreground sm:text-6xl">
              {filtered.length} propert{filtered.length === 1 ? "y" : "ies"} for sale
            </h1>
          </div>
          <div className="flex flex-wrap gap-2" role="search" aria-label="Filter listings">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Suburb, address or postal code"
              className="h-12 w-72 max-w-full bg-card"
              maxLength={80}
              aria-label="Search by suburb, address or postal code"
            />
            <select value={band} onChange={(e) => setBand(e.target.value)} className={SELECT_CLASS} aria-label="Price band">
              {PRICE_BANDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT_CLASS} aria-label="Property type">
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(430px,1fr)_minmax(0,1fr)]">
          <div className="relative lg:sticky lg:top-6">
            <p className="text-label pointer-events-none absolute left-3 top-3 z-10 rounded-sm bg-primary px-3 py-2 text-[11px] text-primary-foreground">
              Click a pin to open the listing
            </p>
            <LazyMap pins={pins} className="h-[min(72vh,640px)] w-full" zoom={10} onPinClick={openPin} />
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              No listings match those filters yet.
            </p>
          ) : (
            <ul className="space-y-4" aria-live="polite">
              {filtered.map((row) => {
                const price = Number(row.price);
                const facts = [
                  prettyStatus(row.property_type),
                  row.erf_size ? `${row.erf_size} stand` : null,
                  row.bedrooms !== null ? `${row.bedrooms} bed` : null,
                  row.bathrooms !== null ? `${row.bathrooms} bath` : null,
                ].filter(Boolean);
                return (
                  <li
                    key={row.id}
                    onMouseEnter={() => setFocused(row.id)}
                    onMouseLeave={() => setFocused(null)}
                    onFocus={() => setFocused(row.id)}
                    onBlur={() => setFocused(null)}
                    className={`grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] overflow-hidden rounded-sm border bg-card transition-colors ${
                      focused === row.id ? "border-accent" : "border-border"
                    }`}
                  >
                    <div className="hatch-fill" aria-hidden="true" />
                    <div className="min-w-0 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-label text-[12px] text-ink-subtle">{row.suburb ?? row.city ?? "Cape Town"}</p>
                        <StatusBadge status={row.status} />
                      </div>
                      <h2 className="font-display mt-1 text-2xl font-bold uppercase leading-tight text-foreground">
                        {row.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <p className="font-display text-4xl font-bold leading-none text-primary">{money(price)}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outlineNavy" className="font-display font-bold uppercase tracking-wide">
                            <Link to="/listings/$id" params={{ id: row.id }}>
                              View
                            </Link>
                          </Button>
                          <Button asChild variant="accent" className="font-display font-bold uppercase tracking-wide">
                            <Link to="/listings/$id" params={{ id: row.id }} search={{ offer: Math.round(price * 0.92) }}>
                              Make an offer
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}