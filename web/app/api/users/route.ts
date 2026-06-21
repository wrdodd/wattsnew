import { sessionUser } from "@/lib/auth";
import { getUser, listUsers, addUser, deleteUser, type Role } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

async function requireAdmin(request: Request): Promise<string | null> {
  const user = sessionUser(request);
  if (!user) return null;
  const rec = await getUser(user);
  return rec?.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return forbidden();
  return Response.json(await listUsers());
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return forbidden();
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    role?: string;
  };
  const role: Role = body.role === "admin" ? "admin" : "user";
  try {
    await addUser(String(body.username ?? ""), String(body.password ?? ""), role);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
  return Response.json(await listUsers());
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return forbidden();
  const target = new URL(request.url).searchParams.get("username") ?? "";
  if (!target) return Response.json({ error: "username required" }, { status: 400 });
  if (target === admin) return Response.json({ error: "you can't delete yourself" }, { status: 400 });
  await deleteUser(target);
  return Response.json(await listUsers());
}
