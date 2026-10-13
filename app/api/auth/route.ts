import { z } from "zod";
import {
  ApiError,
  body,
  cookieTokens,
  failure,
  response,
  session,
  upstream,
} from "../../../lib/product/server";
export const dynamic = "force-dynamic";
const email = z.string().trim().email().max(254);
const password = z.string().min(12).max(128);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("login"),
    email,
    password: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("signup"),
    email,
    password,
    name: z.string().trim().min(2).max(100),
    role: z.enum(["customer", "driver", "merchant"]),
    phone: z.string().regex(/^\+?[0-9 ()-]{7,30}$/),
    business_name: z.string().max(120).default(""),
  }),
  z.object({
    action: z.literal("verify"),
    email,
    token: z.string().regex(/^\d{6,10}$/),
    type: z.enum(["signup", "recovery"]),
  }),
  z.object({ action: z.literal("recover"), email }),
  z.object({ action: z.literal("resend"), email }),
  z.object({ action: z.literal("password"), password }),
  z.object({ action: z.literal("logout") }),
]);
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success)
      throw new ApiError(
        parsed.error.issues.some((x) => x.path.includes("password"))
          ? "Use a password with 12–128 characters."
          : "Please check your email and account details.",
      );
    const v = parsed.data;
    if (v.action === "logout") {
      try {
        const s = await session(req);
        await upstream("/auth/v1/logout", { method: "POST" }, s.access);
      } catch {
        /* Always remove this device’s cookies. */
      }
      return cookieTokens(response({ ok: true }), req);
    }
    if (v.action === "recover" || v.action === "resend") {
      await upstream(
        v.action === "recover" ? "/auth/v1/recover" : "/auth/v1/resend",
        {
          method: "POST",
          body: JSON.stringify({
            email: v.email,
            ...(v.action === "resend" ? { type: "signup" } : {}),
          }),
        },
      );
      return response({
        message:
          "If this email is eligible, a verification email has been sent.",
      });
    }
    if (v.action === "password") {
      const s = await session(req);
      await s.rpc("waka_snapshot", {});
      await upstream(
        "/auth/v1/user",
        { method: "PUT", body: JSON.stringify({ password: v.password }) },
        s.access,
      );
      return s.finish(response({ message: "Password updated." }));
    }
    let result;
    if (v.action === "signup")
      result = await upstream("/auth/v1/signup", {
        method: "POST",
        body: JSON.stringify({
          email: v.email,
          password: v.password,
          data: {
            name: v.name,
            role: v.role,
            phone: v.phone,
            business_name: v.business_name,
          },
        }),
      });
    else if (v.action === "login")
      result = await upstream("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email: v.email, password: v.password }),
      });
    else
      result = await upstream("/auth/v1/verify", {
        method: "POST",
        body: JSON.stringify({ email: v.email, token: v.token, type: v.type }),
      });
    if (
      typeof result.access_token === "string" &&
      typeof result.refresh_token === "string"
    )
      return cookieTokens(response({ ok: true }), req, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
    return response({
      verify: true,
      message: "Check your email to confirm your account, then log in.",
    });
  } catch (e) {
    return failure(e);
  }
}
