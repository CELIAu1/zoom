import { z } from "zod";
import type { Snapshot } from "./types";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function settings() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ApiError(
      "Waka is not accepting accounts yet. The operator needs to connect authentication and the database.",
      503,
    );
  if (!/^https:\/\/[^/]+$/.test(url))
    throw new ApiError("Authentication configuration is invalid.", 503);
  return { url, key };
}
export function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(e: unknown) {
  return response(
    {
      error:
        e instanceof ApiError
          ? e.message
          : "We couldn’t complete this request. Please try again.",
    },
    e instanceof ApiError ? e.status : 500,
  );
}
export async function body(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    throw new ApiError("This request must come from Waka.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("JSON is required.", 415);
  const raw = await req.text();
  if (raw.length > 16000) throw new ApiError("Request too large.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid request.", 400);
  }
}
export async function upstream<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const { url, key } = settings();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(
      "Account service is unavailable. Please try again.",
      503,
    );
  }
  const value = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const raw = String(
      value.msg || value.error_description || value.message || "",
    );
    const message = path.startsWith("/auth/")
      ? res.status === 429
        ? "Too many attempts. Please wait before trying again."
        : /confirm/i.test(raw)
          ? "Confirm your email before logging in."
          : path.includes("signup")
            ? "We couldn’t create this account. Check the details or try logging in."
            : "The email, password or verification code was not accepted."
      : value.code === "P0001"
        ? raw
        : value.code === "23505"
          ? "This request already exists or a driver has taken another trip. Refresh and try again."
          : res.status === 401
            ? "Please log in again."
            : "Couldn’t save the change. Check your details and try again.";
    throw new ApiError(
      message,
      res.status === 401
        ? 401
        : res.status === 429
          ? 429
          : res.status >= 500
            ? 503
            : 400,
    );
  }
  return value as T;
}
type Tokens = { access_token: string; refresh_token: string };
function readCookie(req: Request, key: string) {
  const v = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(key + "="))
    ?.slice(key.length + 1);
  return v && /^[A-Za-z0-9._~-]+$/.test(v) ? v : undefined;
}
export function cookieTokens(res: Response, req: Request, tokens?: Tokens) {
  for (const [name, value] of [
    ["waka_access", tokens?.access_token],
    ["waka_refresh", tokens?.refresh_token],
  ])
    res.headers.append(
      "Set-Cookie",
      `${name}=${value || ""}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${value ? 60 * 60 * 24 * 30 : 0}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
    );
  return res;
}
export async function session(req: Request) {
  let access = readCookie(req, "waka_access");
  const refresh = readCookie(req, "waka_refresh");
  let tokens: Tokens | undefined;
  if (!access && !refresh)
    throw new ApiError("Please log in to continue.", 401);
  const renew = async () => {
    if (!refresh) throw new ApiError("Please log in again.", 401);
    try {
      tokens = await upstream<Tokens>(
        "/auth/v1/token?grant_type=refresh_token",
        { method: "POST", body: JSON.stringify({ refresh_token: refresh }) },
      );
      access = tokens!.access_token;
    } catch {
      throw new ApiError("Your session expired. Please log in again.", 401);
    }
  };
  if (!access) await renew();
  return {
    async rpc(name: string, data: unknown) {
      try {
        return await upstream<Snapshot & { error?: string }>(
          `/rest/v1/rpc/${name}`,
          { method: "POST", body: JSON.stringify(data) },
          access,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await renew();
          return upstream<Snapshot & { error?: string }>(
            `/rest/v1/rpc/${name}`,
            { method: "POST", body: JSON.stringify(data) },
            access,
          );
        }
        throw e;
      }
    },
    finish(res: Response) {
      return tokens ? cookieTokens(res, req, tokens) : res;
    },
    get access() {
      return access!;
    },
  };
}
const bounded = z.string().trim().min(1).max(240);
const uuid = z.string().uuid();
const fare = z.number().int().min(10000).max(50000000);
const booking = z.object({ booking_id: uuid });
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    data: z.object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().regex(/^\+?[0-9 ()-]{7,30}$/),
      city: z.enum(["Abuja", "Lagos"]),
      business_name: z.string().max(120),
    }),
  }),
  z.object({
    action: z.literal("application"),
    data: z.object({
      vehicle: bounded,
      plate: bounded,
      color: bounded,
      license_reference: bounded,
    }),
  }),
  z.object({
    action: z.literal("review_driver"),
    data: z.object({
      driver_id: uuid,
      status: z.enum(["approved", "rejected", "suspended"]),
      note: z.string().trim().min(10).max(1000),
    }),
  }),
  z.object({
    action: z.literal("availability"),
    data: z.object({ online: z.boolean() }),
  }),
  z.object({
    action: z.literal("location"),
    data: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
  z.object({
    action: z.literal("save_place"),
    data: z.object({
      label: z.string().trim().min(1).max(40),
      address: bounded,
    }),
  }),
  z.object({ action: z.literal("delete_place"), data: z.object({ id: uuid }) }),
  z.object({
    action: z.literal("support"),
    data: z.object({
      booking_id: uuid.optional(),
      message: z.string().trim().min(10).max(3000),
    }),
  }),
  z.object({
    action: z.literal("resolve_ticket"),
    data: z.object({ id: uuid }),
  }),
  z.object({
    action: z.literal("create_booking"),
    data: z.object({
      service: z.enum(["ride", "delivery"]),
      pickup: bounded.min(3),
      destination: bounded.min(3),
      fare,
      recipient: z.string().max(100),
      recipient_phone: z.string().max(30),
      parcel: z.string().max(500),
      instructions: z.string().max(1000),
      pickup_lat: z.number().min(-90).max(90).nullable().optional(),
      pickup_lng: z.number().min(-180).max(180).nullable().optional(),
      destination_lat: z.number().min(-90).max(90).nullable().optional(),
      destination_lng: z.number().min(-180).max(180).nullable().optional(),
    }),
  }),
  z.object({
    action: z.literal("offer"),
    data: booking.extend({
      amount: fare,
      eta: z.number().int().min(1).max(120),
    }),
  }),
  z.object({
    action: z.literal("counter"),
    data: booking.extend({ offer_id: uuid, amount: fare }),
  }),
  z.object({
    action: z.literal("accept"),
    data: booking.extend({ offer_id: uuid }),
  }),
  z.object({
    action: z.literal("decline"),
    data: booking.extend({ offer_id: uuid }),
  }),
  z.object({
    action: z.literal("cancel"),
    data: booking.extend({ reason: z.string().trim().min(3).max(500) }),
  }),
  z.object({ action: z.literal("arrive"), data: booking }),
  z.object({
    action: z.literal("start"),
    data: booking.extend({ pin: z.string().regex(/^\d{4}$/) }),
  }),
  z.object({
    action: z.literal("complete"),
    data: booking.extend({ proof: z.string().max(1000).optional() }),
  }),
  z.object({ action: z.literal("cash_received"), data: booking }),
  z.object({
    action: z.literal("rate"),
    data: booking.extend({ rating: z.number().int().min(1).max(5) }),
  }),
]);
