import { readReactions, setReaction } from "@/lib/data";
import type { Reaction } from "@/lib/types";
import { isAuthed, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json(await readReactions());
}

export async function POST(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; reaction?: unknown }
    | null;

  if (!body || typeof body.id !== "string") {
    return Response.json({ error: "id (string) required" }, { status: 400 });
  }
  const r = body.reaction;
  if (r !== "up" && r !== "down" && r !== null) {
    return Response.json(
      { error: "reaction must be 'up', 'down', or null" },
      { status: 400 },
    );
  }

  const reactions = await setReaction(body.id, r as Reaction | null);
  return Response.json(reactions);
}
