import { Link } from "@tanstack/react-router";
import { money, prettyStatus } from "@/lib/prop3000";

type ListingCardData = {
  id: string;
  title: string;
  suburb: string | null;
  price: number | null;
  status: string;
  erf_size: string | number | null;
  bedrooms: number | null;
  photo_paths: string[] | null;
};

/** Listing card: 3:2 photo with a brick status flag, suburb, title, navy price and specs. */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const photo = listing.photo_paths?.[0];
  const specs = [
    listing.erf_size ? `${listing.erf_size} m²` : null,
    listing.bedrooms ? `${listing.bedrooms} bed` : null,
  ].filter(Boolean);

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block border border-border bg-card shadow-panel transition-colors hover:border-accent"
    >
      <div className="relative aspect-[3/2] overflow-hidden">
        {photo ? (
          <img src={photo} alt={listing.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="hatch-fill size-full" />
        )}
        <span className="text-label absolute left-0 top-0 bg-brick px-2.5 py-1.5 text-[11px] text-brick-foreground">
          {prettyStatus(listing.status)}
        </span>
      </div>

      <div className="p-5">
        {listing.suburb && <p className="text-label text-[11px] text-ink-subtle">{listing.suburb}</p>}
        <h3 className="text-display mt-1.5 text-[22px] leading-[1.1] text-foreground group-hover:text-primary">
          {listing.title}
        </h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-display text-[26px] font-bold text-primary">{money(listing.price)}</p>
          {specs.length > 0 && <p className="text-sm text-ink-faint">{specs.join(" · ")}</p>}
        </div>
      </div>
    </Link>
  );
}
