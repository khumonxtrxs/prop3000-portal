import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

/**
 * Creates the five fixed demo role accounts if they don't exist yet.
 * Idempotent, and limited to the hardcoded demo addresses only.
 */
export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const created: string[] = [];

  for (const account of DEMO_ACCOUNTS) {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", account.email)
      .maybeSingle();

    let userId = existing?.id ?? null;

    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (error) {
        if (!/already/i.test(error.message)) console.error(`[demo] ${account.email}: ${error.message}`);
        continue;
      }
      userId = data.user?.id ?? null;
      if (userId) created.push(account.email);
    }

    if (!userId) continue;
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: account.role },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
  }

  return { created: created.length };
});

/** Admin/owner only: grant or revoke a role for a user. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "owner", "supervisor", "agent", "client"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_office", { _user_id: context.userId });
    if (!allowed) throw new Error("Forbidden: only admins and owners can change roles");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
