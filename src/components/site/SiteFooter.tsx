import { Link } from "@tanstack/react-router";
import { COMPANY, whatsappLink } from "@/lib/prop3000";

const PAGES = [
  { to: "/developers", label: "Developers" },
  { to: "/investments", label: "Investments" },
  { to: "/listings", label: "Listings" },
  { to: "/request", label: "Request" },
  { to: "/sell", label: "Sell" },
  { to: "/book", label: "Book" },
  { to: "/contact", label: "Contact" },
] as const;

const PORTAL = [
  { to: "/auth", label: "Sign in" },
  { to: "/request", label: "Request a quote" },
  { to: "/sell", label: "Sell for cash" },
] as const;

/** Small footer labels use on-navy-muted: on-navy-label fails WCAG AA contrast at 11–12px on deep navy. */
function ColumnHeading({ children }: { children: string }) {
    return <h2 className="text-label text-[11px] text-on-navy-muted">{children}</h2>;
}

/** Deep-navy footer: wordmark and blurb, page links, contact details, portal links. */
export function SiteFooter() {
  return (
    <footer className="bg-primary-deep text-on-navy">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr]">
        <div>
          <p className="font-display text-3xl font-bold uppercase text-primary-foreground">
            Prop<span className="text-accent">3000</span>
          </p>
          <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-on-navy-muted">
            Developers &amp; Investments. Renovation, building and fast cash property purchases across the Cape
            Peninsula.
          </p>
        </div>

        <div>
          <ColumnHeading>Pages</ColumnHeading>
          <ul className="mt-4 space-y-2">
            {PAGES.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="font-display text-base font-semibold uppercase text-primary-foreground transition-colors hover:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ColumnHeading>Contact</ColumnHeading>
          <ul className="mt-4 space-y-2 text-sm text-on-navy-muted">
            <li>
              <a
                href={whatsappLink("Hi Prop3000, I have a question.")}
                target="_blank"
                rel="noreferrer"
                className="font-display text-xl font-bold text-whatsapp transition-colors hover:brightness-110"
              >
                {COMPANY.whatsappDisplay}
              </a>
            </li>
            <li>
              <a href={`tel:${COMPANY.office.replace(/\s/g, "")}`} className="hover:text-accent">
                Office {COMPANY.officeDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${COMPANY.email}`} className="hover:text-accent">
                {COMPANY.email}
              </a>
            </li>
            <li>{COMPANY.officeHours}</li>
          </ul>
        </div>

        <div>
          <ColumnHeading>Portal</ColumnHeading>
          <ul className="mt-4 space-y-2">
            {PORTAL.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="font-display text-base font-semibold uppercase text-primary-foreground transition-colors hover:text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-hairline">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2 px-5 py-4 text-xs text-on-navy-muted">
          <span>© {new Date().getFullYear()} Prop3000 · Cape Town</span>
          <span>Portal by Blueprint Developers · INSY7315</span>
        </div>
      </div>
    </footer>
  );
}