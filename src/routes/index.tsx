import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import heroSite from "@/assets/hero-site.jpg";
import distressed from "@/assets/distressed-property.jpg";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { PhotoFrame } from "@/components/site/PhotoFrame";
import { ListingCard } from "@/components/site/ListingCard";
import { listPublicListings } from "@/lib/listings.functions";
import { whatsappLink } from "@/lib/prop3000";

const listingsQuery = queryOptions({
  queryKey: ["public-listings"],
  queryFn: () => listPublicListings(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  head: () => ({
    meta: [
      { title: "Prop3000 — Renovations, Building & Fast Cash Property Sales" },
      {
        name: "description",
        content:
          "Prop3000 Developers renovates, builds, plumbs and wires. Prop3000 Investments buys distressed property fast for cash. Get a quote or book a site visit online.",
      },
      { property: "og:title", content: "Prop3000 — Building Your Future" },
      {
        property: "og:description",
        content: "Renovation quotes, cash property offers and live job tracking — all in one portal.",
      },
    ],
  }),
  component: Index,
});

const PROMISES = ["No agent fees", "Fast turnaround", "Serious cash buyers"] as const;

function Index() {
  const { data: listings } = useSuspenseQuery(listingsQuery);
  const featured = listings.slice(0, 3);

  return (
    <SiteLayout>
      {/* 1. Hero on deep navy */}
      <section className="bg-primary-deep">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-up">
            <span className="text-label inline-block bg-brick px-3 py-1.5 text-[12px] text-brick-foreground">
              Cape Town · Since 2016
            </span>

            <h1 className="text-display mt-6 text-[clamp(42px,6.6vw,84px)] leading-[0.94] text-primary-foreground">
              We build it, fix it <span className="text-accent">— or buy it for cash.</span>
            </h1>

            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-on-navy">
              Two divisions, one portal. Request a renovation quote and track the job to completion, or browse
              distressed property listings and put an offer in front of an agent — no phone calls, no WhatsApp queue.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="xl">
                <Link to="/request">Request a quote</Link>
              </Button>
              <Button asChild variant="brick" size="xl">
                <Link to="/sell">Sell for cash</Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <Link to="/listings">Browse listings</Link>
              </Button>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
              {PROMISES.map((promise) => (
                <li key={promise} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-success">
                    <Check className="size-3.5 text-success-foreground" strokeWidth={3} />
                  </span>
                  <span className="text-label text-[13px] text-primary-foreground">{promise}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Two overlapping, rotated white-framed photos */}
          <div className="relative mx-auto hidden h-[420px] w-full max-w-[560px] lg:block">
            <PhotoFrame
              src={heroSite}
              alt="Prop3000 building team on a residential renovation site"
              className="absolute left-0 top-0 h-[260px] w-[74%] -rotate-3"
            />
            <PhotoFrame
              src={distressed}
              alt="Distressed property bought for cash by Prop3000 Investments"
              className="absolute bottom-0 right-0 h-[240px] w-[68%] rotate-3"
            />
          </div>
        </div>
      </section>

      {/* 2. The two divisions */}
      <section className="grid md:grid-cols-2">
        <Reveal className="border-b-[6px] border-primary bg-card px-5 py-14 md:px-10">
          <div className="ml-auto max-w-[520px] md:mr-6">
            <p className="text-label text-[12px] text-ink-subtle">Prop3000 Developers</p>
            <h2 className="text-display mt-3 text-[clamp(28px,3.4vw,40px)] text-foreground">Building your future</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Renovations, building, plastering, plumbing, electrical, gate motors, paving, painting, waterproofing and
              cabinet making. Every approved job gets a site supervisor and photo progress updates.
            </p>
            <Button asChild variant="outlineNavy" className="mt-7">
              <Link to="/developers">Our services</Link>
            </Button>
          </div>
        </Reveal>

        <Reveal className="border-b-[6px] border-brick bg-primary px-5 py-14 md:px-10">
          <div className="max-w-[520px] md:ml-6">
            <p className="text-label text-[12px] text-accent">Prop3000 Investments</p>
            <h2 className="text-display mt-3 text-[clamp(28px,3.4vw,40px)] text-primary-foreground">
              We buy properties fast for cash
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-on-navy">
              Fixer-uppers, distressed properties, vacant plots, incomplete builds and late estate properties. No agent
              fees, no repairs on your side, no delays and no hassles.
            </p>
            <Button asChild variant="accent" className="mt-7">
              <Link to="/sell">Get a cash offer</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* 3. Published listings */}
      <section className="mx-auto max-w-[1240px] px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-display text-[clamp(28px,3.4vw,40px)] text-foreground">Published listings</h2>
          <Link
            to="/listings"
            className="text-label flex items-center gap-2 border-b-2 border-accent pb-1 text-[13px] text-foreground transition-colors hover:text-accent"
          >
            All {listings.length} on the map <ArrowRight className="size-4" />
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="mt-7 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <p className="mt-7 text-muted-foreground">No listings are published right now. Check back soon.</p>
        )}
      </section>

      {/* 4. Cash sale call to action */}
      <section className="bg-brick">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-5 py-11">
          <div>
            <h2 className="text-display text-[clamp(26px,3.2vw,38px)] text-brick-foreground">
              Need a quick cash sale?
            </h2>
            <p className="mt-1 font-semibold text-brick-foreground/90">
              No delays. No hassles. Serious cash buyers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-card text-brick hover:bg-card/90">
              <Link to="/sell">Submit my property</Link>
            </Button>
            <Button asChild variant="whatsapp" size="lg">
              <a
                href={whatsappLink("Hi Prop3000, I'd like a cash offer on my property.")}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp us today
              </a>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
