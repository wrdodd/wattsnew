import { readReactions, setReaction } from "@/lib/data";
import type { Reaction } from "@/lib/types";
import { sessionUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();
  return Response.json(await readReactions(user));
}

export async function POST(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; reaction?: unknown }
    | null;

  if (!body || typeof body.id !== "string") {
    return Response.json({ error: "id (string) required" }, { status: 400 });
  }
  const r = body.reaction;
  if (r !== "up" && r !== "down" && r !== null) {
    return Response.json({ error: "reaction must be 'up', 'down', or null" }, { status: 400 });
  }

  const reactions = await setReaction(user, body.id, r as Reaction | null);
  return Response.json(reactions);
}
