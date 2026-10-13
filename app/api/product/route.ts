import {
  ApiError,
  body,
  commandSchema,
  failure,
  response,
  session,
  settings,
} from "../../../lib/product/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    settings();
    const s = await session(req);
    return s.finish(response(await s.rpc("waka_snapshot", {})));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const input = commandSchema.safeParse(await body(req));
    if (!input.success)
      throw new ApiError("Please check the form details and try again.");
    const s = await session(req);
    const result = await s.rpc("waka_command", input.data);
    return s.finish(response(result, result.error ? 400 : 200));
  } catch (e) {
    return failure(e);
  }
}
