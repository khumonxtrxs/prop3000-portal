export const COMPANY = {
  name: "Prop3000",
  tagline: "Building Your Future",
  whatsapp: "27812534300",
  whatsappDisplay: "081 253 4300",
  office: "021 705 1867",
  officeDisplay: "021 705 1867",
  email: "info@prop3000.co.za",
  base: "Cape Town, South Africa",
  officeHours: "Mon–Fri 08:00–17:00, Sat 08:00–13:00",
  serviceArea: "Northern & Southern suburbs, Cape Flats, Helderberg",
  baseCoords: { lat: -34.0351, lng: 18.4839 },
};

export function whatsappLink(message: string) {
  return `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent(message)}`;
}

export const BUDGET_RANGES = [
  "Under R25 000",
  "R25 000 – R75 000",
  "R75 000 – R150 000",
  "R150 000 – R500 000",
  "R500 000+",
  "Not sure yet",
];

export const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "flat", label: "Flat / Apartment" },
  { value: "vacant_land", label: "Vacant plot or land" },
  { value: "incomplete_build", label: "Incomplete building project" },
  { value: "estate_property", label: "Late estate property" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
] as const;

export const CONDITIONS = [
  { value: "good", label: "Good — liveable" },
  { value: "fair", label: "Fair — needs work" },
  { value: "poor", label: "Poor — major repairs" },
  { value: "derelict", label: "Derelict / unsafe" },
] as const;

export const BOOKING_TYPES = [
  { value: "site_visit", label: "Site visit & measure-up" },
  { value: "renovation_start", label: "Renovation start date" },
  { value: "property_viewing", label: "Property viewing (cash sale)" },
  { value: "consultation", label: "Office consultation" },
] as const;

export const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export const JOB_STATUSES = [
  { value: "quoted", label: "Quoted" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const LEAD_STATUSES = ["new", "contacted", "quoted", "approved", "converted", "declined"] as const;
export const PROPERTY_STATUSES = [
  "new",
  "reviewing",
  "viewing_booked",
  "offer_made",
  "accepted",
  "declined",
  "purchased",
] as const;

export function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function prettyStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
