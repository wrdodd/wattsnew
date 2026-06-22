import { sessionUser, unauthorized } from "@/lib/auth";
import { getUser } from "@/lib/users";
import { loadCuratorConfig } from "@/lib/curator/config";
import { curate } from "@/lib/curator/curate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Admin-only on-demand curation trigger (for testing). POST { category } to run
 * a single category now, or no body to run them all. Returns the run summary.
 */
export async function POST(request: Request) {
  const user = sessionUser(request);
  if (!user) return unauthorized();
  const rec = await getUser(user);
  if (rec?.role !== "admin") {
    return Response.json({ error: "only admins can run curation" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { category?: string };
  const category =
    typeof body?.category === "string" && body.category.trim() ? body.category : undefined;

  try {
    const summary = await curate(loadCuratorConfig(), category ? { category } : {});
    return Response.json(summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("in progress") ? 409 : msg.includes("unknown category") ? 400 : 500;
    return Response.json({ error: msg }, { status });
  }
}
