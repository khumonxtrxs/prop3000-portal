import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_TYPES, TIME_SLOTS } from "@/lib/prop3000";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Site Visit, Viewing or Start Date — Prop3000" },
      {
        name: "description",
        content: "Pick a date and time for your Prop3000 site visit, renovation start, property viewing or office consultation.",
      },
      { property: "og:title", content: "Book a date with Prop3000" },
      { property: "og:description", content: "Site visits, renovation start dates and cash-sale viewings — booked online." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    booking_type: "site_visit",
    scheduled_date: "",
    scheduled_time: "09:00",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.scheduled_date) {
      toast.error("Choose a date for your booking.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        booking_type: form.booking_type,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        notes: form.notes.trim() || null,
      })
      .select("reference")
      .single();
    setBusy(false);
    if (error) {
      console.error(error);
      toast.error("We couldn't book that slot. Please try again.");
      return;
    }
    setReference(data.reference);
    toast.success("Booking requested");
  }

  if (reference) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="text-display mt-4 text-4xl">Booking requested</h1>
          <p className="mt-3 text-muted-foreground">
            Reference <strong className="text-foreground">{reference}</strong>. The office will confirm your slot by
            phone or WhatsApp.
          </p>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
          <CalendarCheck className="size-4" /> Booking diary
        </span>
        <h1 className="text-display mt-3 text-4xl">Book a date</h1>
        <p className="mt-3 text-muted-foreground">
          Site visits, renovation start dates, cash-sale viewings and office consultations.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-6 rounded-xl border border-border bg-card p-6 shadow-panel">
          <div className="space-y-2">
            <Label htmlFor="b_type">What are we booking?</Label>
            <select
              id="b_type"
              value={form.booking_type}
              onChange={(e) => set("booking_type", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {BOOKING_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b_date">Date</Label>
              <Input id="b_date" type="date" min={today} required value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b_time">Time</Label>
              <select
                id="b_time"
                value={form.scheduled_time}
                onChange={(e) => set("scheduled_time", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b_name">Full name</Label>
              <Input id="b_name" required maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b_phone">Mobile number</Label>
              <Input id="b_phone" required maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="b_email">Email</Label>
            <Input id="b_email" type="email" required maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="b_address">Address we're visiting</Label>
            <Input id="b_address" maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="b_notes">Notes for the team</Label>
            <Textarea id="b_notes" rows={3} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Request this slot
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}
