import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PhotoFrame } from "@/components/site/PhotoFrame";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Prop3000 Investments — Fast Cash Offers for Distressed Property" },
      {
        name: "description",
        content:
          "We buy distressed, damaged, half-built and inherited property for cash. No agents, no repairs, no bond delays. Submit your property for a fast offer.",
      },
      { property: "og:title", content: "Prop3000 Investments — We buy property for cash" },
      {
        property: "og:description",
        content: "Fixer-uppers, late estates, incomplete builds. Submit the details and get a cash offer in about 7 days.",
      },
    ],
  }),
  component: InvestmentsPage,
});

const SPECIALISE_IN = [
  "Fixer-uppers",
  "Distressed properties",
  "Vacant plots & land",
  "Incomplete building projects",
  "Late estate properties",
];

const PROMISES = ["No agent fees", "Fast turnaround", "Serious cash buyers"];

const STEPS = [
  { title: "Submit the property", copy: "Address, type, condition and a few photos — two minutes on your phone." },
  { title: "We view it", copy: "A viewing is booked in the diary, usually within three working days." },
  { title: "Cash offer", copy: "A written offer based on the property as it stands. No repairs required." },
  { title: "You decide", copy: "Accept and our attorney handles transfer, or walk away. No commission either way." },
];

function InvestmentsPage() {
  return (
    <SiteLayout>
      <section className="bg-brick">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-display text-5xl uppercase text-on-navy sm:text-7xl">
            Need a <span className="text-highlight">quick cash sale?</span>
          </h1>
        </div>
      </section>

      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="text-display text-4xl uppercase text-on-navy sm:text-6xl">
            We buy properties <span className="text-highlight">fast</span> for cash!
          </h2>
          <p className="font-display mt-2 text-2xl font-bold text-on-navy">No delays. No hassles.</p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-display text-4xl uppercase text-primary">We specialise in:</h2>
            <ul className="mt-6 space-y-1">
              {SPECIALISE_IN.map((item) => (
                <li
                  key={item}
                  className="font-display flex items-center gap-3 bg-primary px-6 py-4 text-2xl font-bold uppercase text-on-navy"
                >
                  <Check className="size-5 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <ul className="mt-8">
              {PROMISES.map((promise) => (
                <li
                  key={promise}
                  className="font-display flex items-center gap-4 border-b border-divider py-4 text-3xl font-bold uppercase text-foreground"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="size-5" aria-hidden="true" />
                  </span>
                  {promise}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="brick" size="xl" className="font-display font-bold uppercase tracking-wide">
                <Link to="/sell">Get my cash offer</Link>
              </Button>
              <Button asChild variant="outlineNavy" size="xl" className="font-display font-bold uppercase tracking-wide">
                <Link to="/book">Book a viewing</Link>
              </Button>
            </div>
          </div>

          <div>
            {/* Two overlapping, rotated white-framed photos, the same pattern as the home page */}
            <div className="relative mx-auto hidden h-[420px] w-full max-w-[600px] lg:block">
              <PhotoFrame
                alt="Distressed house bought for cash by Prop3000 Investments"
                caption="Distressed house"
                className="absolute right-0 top-0 h-[260px] w-[80%] rotate-1"
              />
              <PhotoFrame
                alt="Vacant plot bought for cash by Prop3000 Investments"
                caption="Vacant plot"
                className="absolute bottom-0 left-0 h-[220px] w-[62%] -rotate-2"
              />
            </div>

            <div className="mx-auto mt-6 max-w-[600px] rounded-sm border border-border border-t-4 border-t-accent bg-card p-7 shadow-panel">
              <h2 className="text-display text-3xl uppercase text-foreground">How a cash sale works</h2>
              <ol className="mt-5 space-y-5">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="font-display flex size-9 shrink-0 items-center justify-center bg-primary text-lg font-bold text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-bold uppercase leading-tight text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-muted-foreground">{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}