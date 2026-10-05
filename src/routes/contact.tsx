import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
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

type ContactCell = {
  label: string;
  value: string;
  note?: string;
  href?: string;
  external?: boolean;
};

function ContactPage() {
  const cells: ContactCell[] = [
    {
      label: "WhatsApp",
      value: COMPANY.whatsappDisplay,
      href: whatsappLink("Hi Prop3000!"),
      external: true,
      note: "Fastest route to a human",
    },
    {
      label: "Office",
      value: COMPANY.officeDisplay,
      href: `tel:${COMPANY.office.replace(/\s/g, "")}`,
      note: COMPANY.officeHours,
    },
    {
      label: "Email",
      value: COMPANY.email,
      href: `mailto:${COMPANY.email}`,
      note: "We reply within one working day",
    },
    {
      label: "Area",
      value: COMPANY.base.split(",")[0] ?? COMPANY.base,
      note: COMPANY.serviceArea,
    },
    {
      label: "Divisions",
      value: "Developers · Investments",
      note: "Renovations and cash property purchases",
    },
  ];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-16">
        <h1 className="text-display text-5xl uppercase text-foreground">Contact {COMPANY.name}</h1>

        <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] overflow-hidden border border-border bg-card">
          {cells.map((cell) => (
            <div key={cell.label} className="-mb-px -mr-px border-b border-r border-border p-6">
              <dt className="text-label text-[11px] text-ink-subtle">{cell.label}</dt>
              <dd className="font-display mt-2 break-words text-[26px] font-bold leading-tight text-foreground">
                {cell.href ? (
                  <a
                    href={cell.href}
                    target={cell.external ? "_blank" : undefined}
                    rel={cell.external ? "noreferrer" : undefined}
                    className="underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {cell.value}
                  </a>
                ) : (
                  cell.value
                )}
              </dd>
              {cell.note && <dd className="mt-2 text-sm text-muted-foreground">{cell.note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </SiteLayout>
  );
}