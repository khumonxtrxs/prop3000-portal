export const DEMO_PASSWORD = "Prop3000#2026";

export const DEMO_ACCOUNTS = [
  {
    role: "client",
    email: "client@prop3000.demo",
    name: "Thandi Client",
    blurb: "Homeowner / buyer — request a quote, bid on listings, track offers.",
  },
  {
    role: "admin",
    email: "admin@prop3000.demo",
    name: "Office Admin",
    blurb: "Office staff — see every lead, quote and job.",
  },
  {
    role: "agent",
    email: "agent@prop3000.demo",
    name: "Riaan Agent",
    blurb: "Investments agent — publish listings, approve/decline/counter offers.",
  },
  {
    role: "supervisor",
    email: "supervisor@prop3000.demo",
    name: "Sipho Supervisor",
    blurb: "Site foreman — update job progress and upload site photos.",
  },
  {
    role: "owner",
    email: "owner@prop3000.demo",
    name: "Leah's Dad",
    blurb: "Owner / manager — whole-business dashboard and pipeline value.",
  },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
