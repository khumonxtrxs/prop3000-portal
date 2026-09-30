import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { RouteFinder } from "@/components/site/RouteFinder";
import { Button } from "@/components/ui/button";
import { COMPANY, whatsappLink } from "@/lib/prop3000";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Prop3000 — WhatsApp, Phone & Site Directions" },
      {
        name: "description",
        content: "Reach Prop3000 on WhatsApp 081 253 4300, by phone or email, and plot the driving route from our office to your property.",
      },
      { property: "og:title", content: "Contact Prop3000" },
      { property: "og:description", content: "WhatsApp, call or email us — and see the best route to your property." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-16">
        <h1 className="text-display text-4xl">Talk to Prop3000</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          WhatsApp is still the fastest way to reach us — but everything you send through the site lands in the portal
          where nothing gets lost.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href={whatsappLink("Hi Prop3000!")}
            target="_blank"
            rel="noreferrer"
            className="hover-lift rounded-xl border border-border bg-card p-6 shadow-panel"
          >
            <MessageCircle className="size-6 text-success" />
            <h2 className="text-display mt-3 text-2xl">WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">{COMPANY.whatsappDisplay}</p>
          </a>
          <a href={`tel:${COMPANY.office.replace(/\s/g, "")}`} className="hover-lift rounded-xl border border-border bg-card p-6 shadow-panel">
            <Phone className="size-6 text-accent" />
            <h2 className="text-display mt-3 text-2xl">Office</h2>
            <p className="mt-1 text-sm text-muted-foreground">{COMPANY.officeDisplay}</p>
          </a>
          <a href={`mailto:${COMPANY.email}`} className="hover-lift rounded-xl border border-border bg-card p-6 shadow-panel">
            <Mail className="size-6 text-accent" />
            <h2 className="text-display mt-3 text-2xl">Email</h2>
            <p className="mt-1 text-sm break-all text-muted-foreground">{COMPANY.email}</p>
          </a>
          <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
            <MapPin className="size-6 text-brick" />
            <h2 className="text-display mt-3 text-2xl">Based in</h2>
            <p className="mt-1 text-sm text-muted-foreground">{COMPANY.base}</p>
          </div>
        </div>

        <div className="mt-14 rounded-xl border border-border bg-card p-6 shadow-panel">
          <RouteFinder />
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg">
            <a href={whatsappLink("Hi Prop3000, I'd like a quote.")} target="_blank" rel="noreferrer">
              Message us on WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
