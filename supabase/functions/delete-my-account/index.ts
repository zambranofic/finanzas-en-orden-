import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const publishable = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // Revoke refresh tokens on every device before deleting the identity.
  const { error: signOutError } = await userClient.auth.signOut({ scope: "global" });
  if (signOutError) return Response.json({ error: "Could not revoke account sessions" }, { status: 500 });

  // Always read from offset 0 because each batch is deleted before the next list.
  for (let batch = 0; batch < 100; batch++) {
    const { data: objects, error: listError } = await admin.storage.from("avatars").list(user.id, { limit: 100, offset: 0 });
    if (listError) return Response.json({ error: "Could not enumerate account files" }, { status: 500 });
    if (!objects?.length) break;
    const paths = objects.filter((o) => o.name && o.name !== ".emptyFolderPlaceholder").map((o) => `${user.id}/${o.name}`);
    if (!paths.length) break;
    const { error: removeError } = await admin.storage.from("avatars").remove(paths);
    if (removeError) return Response.json({ error: "Could not remove account files" }, { status: 500 });
    if (objects.length < 100) break;
    if (batch === 99) return Response.json({ error: "Account file cleanup limit exceeded" }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: "Could not delete account" }, { status: 500 });
  return Response.json({ ok: true });
});