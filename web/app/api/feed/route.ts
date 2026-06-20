import { readFeed } from "@/lib/data";
import { isAuthed, unauthorized } from "@/lib/auth";

// Always read the latest feed.json from the shared volume (no caching).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  const feed = await readFeed();
  return Response.json(feed);
}
