import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { whatsappLink } from "@/lib/prop3000";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />

      {/* The one pill-shaped element in the design. */}
      <a
        href={whatsappLink("Hi Prop3000, I'd like a quote.")}
        target="_blank"
        rel="noreferrer"
        className="font-display fixed bottom-5 right-5 z-40 rounded-[40px] bg-whatsapp px-5 py-3 text-[15px] font-bold uppercase tracking-[0.05em] text-whatsapp-foreground shadow-glow transition-transform hover:scale-[1.03]"
      >
        WhatsApp us
      </a>
    </div>
  );
}
