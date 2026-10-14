export type Role = "customer" | "driver" | "merchant" | "admin";
export type Profile = {
  id: string;
  role: Role;
  name: string;
  phone: string;
  city: string;
  business_name: string;
};
export type Driver = {
  id: string;
  name?: string;
  phone?: string;
  city?: string;
  status: "incomplete" | "pending" | "approved" | "rejected" | "suspended";
  vehicle: string;
  plate: string;
  color: string;
  license_reference: string;
  online: boolean;
  review_note: string;
};
export type Offer = {
  id: string;
  driver_id: string;
  driver_name: string;
  vehicle: string;
  plate: string;
  color: string;
  amount: number;
  eta_minutes: number;
  round: number;
  turn: "customer" | "driver";
  status: string;
  expires_at: string;
  rating: number | null;
  trips: number;
};
export type Booking = {
  id: string;
  customer_id: string;
  driver_id: string | null;
  service: "ride" | "delivery";
  city: string;
  pickup: string;
  destination: string;
  initial_fare: number;
  agreed_fare: number | null;
  status:
    | "searching"
    | "assigned"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled";
  payment_status: "unpaid" | "cash_received";
  tip: number;
  commission_bps: number;
  rating: number | null;
  recipient: string;
  recipient_phone: string;
  parcel: string;
  instructions: string;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  pickup_pin?: string;
  driver_name?: string;
  driver_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  driver_vehicle?: string;
  driver_plate?: string;
  delivery_proof?: string;
  driver_location?: { lat: number; lng: number; at: string } | null;
  offers: Offer[];
  events: { kind: string; at: string; detail: Record<string, string> }[];
};
export type Job = Pick<
  Booking,
  | "id"
  | "service"
  | "city"
  | "pickup"
  | "destination"
  | "initial_fare"
  | "created_at"
  | "expires_at"
>;
export type Ticket = {
  id: string;
  user_id: string;
  message: string;
  status: string;
  created_at: string;
  booking_id: string | null;
};
export type Snapshot = {
  profile: Profile;
  driver: Driver | null;
  bookings: Booking[];
  jobs: Job[];
  saved_places: { id: string; label: string; address: string }[];
  tickets: Ticket[];
  applications: Driver[];
  support_queue: Ticket[];
  server_time: string;
};
export const money = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const active = (b: Booking) =>
  !["completed", "cancelled"].includes(b.status);
export const statusLabel = (s: string) =>
  ({
    searching: "Finding your driver",
    assigned: "Driver on the way",
    arrived: "Your driver has arrived",
    in_progress: "Journey in progress",
    completed: "You’ve arrived",
    cancelled: "Cancelled",
  })[s] || s;
