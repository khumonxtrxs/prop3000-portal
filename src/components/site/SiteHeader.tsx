import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import logo from "@/assets/prop3000-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY, whatsappLink } from "@/lib/prop3000";

const NAV = [
  { to: "/developers", label: "Developers" },
  { to: "/investments", label: "Investments" },
  { to: "/listings", label: "Listings" },
  { to: "/request", label: "Request" },
  { to: "/sell", label: "Sell" },
  { to: "/book", label: "Book" },
  { to: "/contact", label: "Contact" },
] as const;

/** Sticky white header: logo left, uppercase nav centre, WhatsApp and sign-in right. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-primary bg-card shadow-panel">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <Link to="/" className="flex shrink-0 items-center" aria-label="Prop3000 home">
          <img src={logo} alt="Prop3000 Developers logo" className="h-[52px] w-auto" width={122} height={52} />
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center gap-x-6 gap-y-1 md:order-none md:w-auto md:flex-1 md:justify-center">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="font-display border-b-[3px] border-transparent pb-1 text-base font-semibold uppercase text-[#3B4658] transition-colors hover:text-accent"
              activeProps={{ className: "border-accent text-primary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="whatsapp" size="sm" className="hidden sm:inline-flex">
            <a href={whatsappLink("Hi Prop3000, I'd like to chat about a project.")} target="_blank" rel="noreferrer">
              WhatsApp {COMPANY.whatsappDisplay}
            </a>
          </Button>

          {session ? (
            <>
              <Button asChild variant="outlineNavy" size="sm" className="hidden md:inline-flex">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4" />
                  Portal
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                className="hidden md:inline-flex"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="outlineNavy" size="sm" className="hidden md:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}

          <button
            className="p-2 text-primary md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-border bg-card px-5 pb-4 md:hidden">
          <div className="grid gap-2 pt-3">
            <Button asChild variant="accent">
              <Link to="/request" onClick={() => setOpen(false)}>
                Request a quote
              </Link>
            </Button>
            <Button asChild variant="brick">
              <Link to="/sell" onClick={() => setOpen(false)}>
                Sell for cash
              </Link>
            </Button>
            {session ? (
              <>
                <Button asChild variant="outlineNavy">
                  <Link to="/dashboard" onClick={() => setOpen(false)}>
                    Open portal
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button asChild variant="outlineNavy">
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
