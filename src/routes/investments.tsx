import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Clock3, FileCheck2, Hammer, HousePlus, ShieldCheck } from "lucide-react";
import distressed from "@/assets/distressed-property.jpg";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { COMPANY, whatsappLink } from "@/lib/prop3000";

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

const WE_BUY = [
  { icon: Hammer, title: "Fixer-uppers", copy: "Damaged, gutted or badly neglected homes — we take them as they are." },
  { icon: HousePlus, title: "Incomplete builds", copy: "Half-built houses and stalled projects with no funding left." },
  { icon: FileCheck2, title: "Late estates", copy: "Inherited property where the family needs a clean, quick exit." },
  { icon: Clock3, title: "Urgent sales", copy: "Relocation, arrears or divorce — when time matters more than price." },
];

const STEPS = [
  { title: "Submit the property", copy: "Address, condition and a few photos. Takes about three minutes." },
  { title: "We review & book a viewing", copy: "Office checks the area, comps and access, then books a slot with you." },
  { title: "Cash offer", copy: "A written, no-obligation offer — usually within seven days of the viewing." },
  { title: "Transfer", copy: "Accept and our conveyancer handles transfer. No agent commission." },
];

function InvestmentsPage() {
  return (
    <SiteLayout>
      <section className="relative isolate overflow-hidden">
        <img
          src={distressed}
          alt="Distressed property considered for a Prop3000 cash purchase"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="gradient-hero absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-20">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">Prop3000 Investments</span>
          <h1 className="text-display mt-4 max-w-3xl text-5xl text-primary-foreground sm:text-6xl">
            We buy distressed property fast, for cash
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">
            No agents. No repairs. No waiting on someone else's bond approval. Sell as-is and move on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="brick" size="xl">
              <Link to="/sell">Submit my property</Link>
            </Button>
            <Button asChild variant="outlineLight" size="xl">
              <Link to="/book">Book a viewing</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <Reveal>
          <h2 className="text-display text-4xl">What we buy</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WE_BUY.map((item, index) => (
            <Reveal key={item.title} delay={index * 70}>
              <div className="hover-lift h-full rounded-xl border border-border bg-card p-6 shadow-panel">
                <item.icon className="size-7 text-brick" aria-hidden />
                <h3 className="text-display mt-4 text-2xl">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal>
            <h2 className="text-display text-4xl">How a cash sale works</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 90}>
                <div className="relative h-full rounded-xl border border-border bg-card p-6 shadow-panel">
                  <span className="text-display absolute -top-4 left-6 flex size-10 items-center justify-center rounded-full bg-brick text-lg text-brick-foreground">
                    {index + 1}
                  </span>
                  <h3 className="text-display mt-4 text-2xl">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <Reveal>
          <div className="surface-blueprint rounded-2xl px-8 py-14 text-center text-primary-foreground">
            <div className="flex justify-center gap-4 text-accent">
              <Banknote className="size-9" aria-hidden />
              <ShieldCheck className="size-9" aria-hidden />
            </div>
            <h2 className="text-display mt-4 text-4xl">No obligation, no commission</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/75">
              Submit the property and see the number. If it doesn't work for you, walk away — nothing owed. WhatsApp{" "}
              {COMPANY.whatsappDisplay} if you'd rather chat it through.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="brick" size="xl">
                <Link to="/sell">Get my cash offer</Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl">
                <a href={whatsappLink("Hi Prop3000, I want to sell a property for cash.")} target="_blank" rel="noreferrer">
                  WhatsApp us
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
