import {
  ApiError,
  failure,
  response,
  session,
} from "../../../lib/product/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const s = await session(req);
    await s.rpc("waka_snapshot", {});
    const key = process.env.MAPBOX_ACCESS_TOKEN;
    if (!key) return s.finish(response({ places: [], manual: true }));
    const query = new URL(req.url).searchParams.get("q")?.trim();
    if (!query || query.length < 3 || query.length > 150)
      throw new ApiError("Enter an address.");
    const params = new URLSearchParams({
      q: query,
      country: "ng",
      limit: "5",
      permanent: "true",
      access_token: key,
    });
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok)
      throw new ApiError(
        "Address search is unavailable. Enter the full address manually.",
        503,
      );
    const data = (await res.json()) as {
      features: {
        properties: {
          full_address?: string;
          name?: string;
          coordinates?: { latitude: number; longitude: number };
        };
      }[];
    };
    return s.finish(
      response({
        places: (data.features || []).map(
          (f: {
            properties: {
              full_address?: string;
              name?: string;
              coordinates?: { latitude: number; longitude: number };
            };
          }) => ({
            label: f.properties.full_address || f.properties.name,
            lat: f.properties.coordinates?.latitude,
            lng: f.properties.coordinates?.longitude,
          }),
        ),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
