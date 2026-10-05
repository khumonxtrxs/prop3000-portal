/** Emulator ports. Must match firebase.json. 8080 is the Vite dev server, so Firestore uses 8081. */
export const FIREBASE_EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8081,
  storage: 9199,
  ui: 4000,
} as const;

/** Firestore collection names. One per Supabase table — see docs/firebase-migration.md. */
export const COLLECTIONS = {
  profiles: "profiles",
  userRoles: "user_roles",
  serviceTypes: "service_types",
  serviceRequests: "service_requests",
  propertySubmissions: "property_submissions",
  jobs: "jobs",
  quotes: "quotes",
  bookings: "bookings",
  listings: "listings",
  offers: "offers",
  notifications: "notifications",
} as const;

/** Subcollections, nested under their parent document. */
export const SUBCOLLECTIONS = {
  jobStatusHistory: "status_history",
  jobPhotos: "photos",
  offerEvents: "events",
} as const;

/** Storage folders, replacing the Supabase buckets of the same names. */
export const STORAGE_FOLDERS = {
  leadPhotos: "lead-photos",
  jobPhotos: "job-photos",
} as const;
