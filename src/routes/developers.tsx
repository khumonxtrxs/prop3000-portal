import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PhotoFrame } from "@/components/site/PhotoFrame";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Prop3000 Developers — Renovations, Building, Plumbing & Electrical" },
      {
        name: "description",
        content:
          "Renovations, new builds, plumbing, electrical, paving, tiling, waterproofing and cabinetry from one supervised team in Cape Town. Request a quote online.",
      },
      { property: "og:title", content: "Prop3000 Developers — Every trade under one roof" },
      {
        property: "og:description",
        content: "Quoted properly, supervised on site, tracked in the portal. Request a renovation quote with photos.",
      },
    ],
  }),
  component: DevelopersPage,
});

/** The 13 trades, in the order of the client's screenshot 02. */
const SERVICES = [
  "Renovations",
  "Building",
  "Scheming",
  "Plastering",
  "Plumbing",
  "Electrical",
  "Electrical gates",
  "Gate motors",
  "Paving",
  "Painting",
  "Waterproofing",
  "Cabinet making",
  "Built-in cupboards",
];

function DevelopersPage() {
  return (
    <SiteLayout>
      <section className="bg-primary-deep">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <p className="text-label text-[12px] text-accent">Prop3000 Developers</p>
          <h1 className="text-display mt-4 text-5xl uppercase text-on-navy sm:text-6xl">Our services</h1>
          <p className="text-tagline mt-3">Building your future</p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 lg:grid-cols-2">
          <div>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
              {SERVICES.map((service) => (
                <li
                  key={service}
                  className="font-display rounded-sm border border-border border-l-4 border-l-accent bg-card px-6 py-5 text-xl font-bold uppercase leading-tight text-foreground"
                >
                  {service}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-primary px-8 py-6">
              <h2 className="text-display text-3xl uppercase text-on-navy">Not on the list? Send it anyway.</h2>
              <Button asChild variant="accent" size="lg" className="font-display font-bold uppercase tracking-wide">
                <Link to="/request">Request a quote</Link>
              </Button>
            </div>
          </div>

          {/* Three overlapping, rotated white-framed photos, the same pattern as the home page */}
          <div className="relative mx-auto hidden h-[640px] w-full max-w-[600px] lg:block">
            <PhotoFrame
              alt="Prop3000 artisan at work on a renovation"
              caption="Artisan at work"
              className="absolute right-0 top-0 h-[290px] w-[78%] rotate-2"
            />
            <PhotoFrame
              alt="Prop3000 electrician installing new wiring"
              caption="Electrical work"
              className="absolute left-0 top-[210px] h-[240px] w-[64%] -rotate-3"
            />
            <PhotoFrame
              alt="Prop3000 team installing paving and a gate"
              caption="Paving / gate install"
              className="absolute bottom-0 right-0 h-[230px] w-[64%] rotate-1"
            />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}