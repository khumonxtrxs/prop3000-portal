import { createFileRoute, Link } from "@tanstack/react-router";
import { Hammer, Home, Wrench, Zap, Layers, PaintRoller, Ruler, Droplets, CheckCircle2 } from "lucide-react";
import renovation from "@/assets/renovation-finish.jpg";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { COMPANY, whatsappLink } from "@/lib/prop3000";

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

const SERVICES = [
  { icon: Hammer, name: "Renovations", items: ["Kitchens & bathrooms", "Extensions", "Full refurbishments"] },
  { icon: Home, name: "Building", items: ["New builds", "Garages & flatlets", "Boundary walls"] },
  { icon: Wrench, name: "Plumbing", items: ["Geyser installs", "Leak detection", "Drain clearing"] },
  { icon: Zap, name: "Electrical", items: ["COC certificates", "DB boards", "Lights & plugs"] },
  { icon: Layers, name: "Paving & tiling", items: ["Driveways & patios", "Screeds", "Floor & wall tiling"] },
  { icon: PaintRoller, name: "Painting", items: ["Interior & exterior", "Roof coating", "Crack repairs"] },
  { icon: Ruler, name: "Cabinetry", items: ["Built-in cupboards", "Kitchen units", "Counter tops"] },
  { icon: Droplets, name: "Waterproofing", items: ["Roof sealing", "Damp proofing", "Gutter work"] },
];

const PROMISES = [
  "Fixed written quote before we lift a tool",
  "One supervisor accountable for your site",
  "Progress photos posted to your portal",
  "Registered plumbers and electricians, COC on completion",
];

function DevelopersPage() {
  return (
    <SiteLayout>
      <section className="relative isolate overflow-hidden">
        <img src={renovation} alt="Completed Prop3000 renovation" className="absolute inset-0 size-full object-cover" />
        <div className="gradient-hero absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-20">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">Prop3000 Developers</span>
          <h1 className="text-display mt-4 max-w-3xl text-5xl text-primary-foreground sm:text-6xl">
            Renovations and builds, run like a proper project
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">
            Send us photos and a description. We price it, plan the route, book the date and keep you updated until
            snag-list sign-off.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/request">Request a quote</Link>
            </Button>
            <Button asChild variant="outlineLight" size="xl">
              <Link to="/book">Book a site visit</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <Reveal>
          <h2 className="text-display text-4xl">What we do</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, index) => (
            <Reveal key={service.name} delay={index * 60}>
              <div className="hover-lift h-full rounded-xl border border-border bg-card p-6 shadow-panel">
                <service.icon className="size-7 text-accent" aria-hidden />
                <h3 className="text-display mt-4 text-2xl">{service.name}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {service.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="surface-blueprint py-20 text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-display text-4xl">Our promise on every site</h2>
            <ul className="mt-6 space-y-4">
              {PROMISES.map((promise) => (
                <li key={promise} className="flex gap-3 text-primary-foreground/85">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                  {promise}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-xl border border-primary-foreground/12 bg-primary-foreground/5 p-8">
              <h3 className="text-display text-3xl">Prefer to talk first?</h3>
              <p className="mt-3 text-primary-foreground/75">
                We still answer the phone. WhatsApp {COMPANY.whatsappDisplay} or call {COMPANY.officeDisplay} and we'll
                capture the details for you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="accent" size="lg">
                  <a href={whatsappLink("Hi Prop3000, I need a renovation quote.")} target="_blank" rel="noreferrer">
                    WhatsApp us
                  </a>
                </Button>
                <Button asChild variant="outlineLight" size="lg">
                  <Link to="/contact">Contact page</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
