import { isAuthed, unauthorized } from "@/lib/auth";
import { readAppConfig, writeAppConfig, type AppConfig } from "@/lib/appconfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json(await readAppConfig());
}

export async function POST(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as Partial<AppConfig> | null;
  if (!body || !Array.isArray(body.categories)) {
    return Response.json({ error: "invalid config" }, { status: 400 });
  }
  const saved = await writeAppConfig(body);
  return Response.json(saved);
}
