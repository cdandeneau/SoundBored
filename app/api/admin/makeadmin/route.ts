/**
 * POST /api/admin/makeadmin
 * Toggles admin status for a user. Only callable by authenticated admins.
 *
 * Request body: { userId: string }
 * Authorization: Bearer <access_token>
 *
 * Auth pattern:
 *  - supabaseUser (anon key + caller JWT): verifies identity + reads caller's is_admin
 *  - supabaseAdmin (service role): updates the is_admin flag in profiles
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const { userId } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // User-context client: verify identity and read caller's own profile (no service role needed)
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseUser.auth.getUser();

  if (callerError || !caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read is_admin from the caller's own profile row using their JWT
  const { data: callerProfile, error: profileReadError } = await supabaseUser
    .from("profiles")
    .select("is_admin")
    .eq("id", caller.id)
    .single();

  if (profileReadError || !callerProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
  }

  if (userId === caller.id) {
    return NextResponse.json({ error: "You cannot change your own admin status" }, { status: 400 });
  }

  // Service-role client — needed to update profiles
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the current admin status
  const { data: targetProfile, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (readError) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Toggle the admin status
  const newAdminStatus = !targetProfile.is_admin;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ is_admin: newAdminStatus })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, is_admin: newAdminStatus });
}
