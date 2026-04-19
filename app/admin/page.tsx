"use client";

/**
 * Admin Panel (/admin)
 *
 * Only accessible to users with is_admin=true in the profiles table.
 * Non-admins are redirected to /feed.
 *
 * Features:
 *  - Lists all users with their username, display name, and status (banned/admin)
 *  - Search users by username or display name
 *  - Ban / Unban a user (prevents/restores login via Supabase Auth)
 *  - Delete a user permanently (removes them from Supabase Auth + cascades to DB)
 *  - Admins cannot ban or delete themselves from this panel
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../utils/supabase/auth";
import MusicNotesLoader from "../components/MusicNotesLoader";

// Shape of a user row as returned from the profiles table
type AdminUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  is_banned: boolean | null;
};

export default function AdminPage() {
  const router = useRouter();

  // Current authenticated admin
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // All users fetched from the database
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Search query typed into the filter input
  const [query, setQuery] = useState("");

  // Track which user is currently being acted on (to show loading state)
  const [busyId, setBusyId] = useState<string | null>(null);

  // Status message shown after an admin action
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function init() {
      // Get the currently logged-in user
      const user = await getCurrentUserSafe();

      if (!user) {
        // Not logged in — send to login page
        router.push("/login");
        return;
      }

      // Fetch the current user's profile to check admin status
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .single();

      // If the user is not an admin, redirect them away
      if (!myProfile?.is_admin) {
        router.push("/feed");
        return;
      }

      setCurrentUserId(user.id);
      setMyUsername(myProfile.username);

      // Load all users for the admin panel
      await fetchUsers();
      setLoading(false);
    }

    init();
  }, [router]);

  /**
   * Fetches all users from the profiles table.
   * This is intentionally un-paginated for the admin view — admins need the full list.
   */
  async function fetchUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_admin, is_banned")
      .order("username", { ascending: true });

    if (error) {
      setMessage("Error loading users: " + error.message);
      return;
    }

    setUsers(data || []);
  }

  /**
   * Calls the /api/admin/ban or /api/admin/unban endpoint.
   * Passes the current session's access_token as a Bearer token for server-side verification.
   */
  async function handleBanToggle(targetUser: AdminUserRow) {
    setMessage("");
    setBusyId(targetUser.id);

    // Get current session token to authenticate the API call
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setMessage("Session expired. Please log in again.");
      setBusyId(null);
      return;
    }

    const endpoint = targetUser.is_banned ? "/api/admin/unban" : "/api/admin/ban";
    const action = targetUser.is_banned ? "unban" : "ban";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: targetUser.id }),
    });

    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setMessage(`Failed to ${action} user: ${json.error}`);
      return;
    }

    setMessage(
      `User @${targetUser.username} has been ${action === "ban" ? "banned" : "unbanned"}.`
    );

    // Update the local list so the UI reflects the change immediately
    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id ? { ...u, is_banned: !u.is_banned } : u
      )
    );
  }

  /**
   * Calls the /api/admin/delete endpoint.
   * Shows a confirmation dialog first because deletion is permanent.
   */
  async function handleDelete(targetUser: AdminUserRow) {
    // Always confirm before permanent deletion
    if (
      !window.confirm(
        `Permanently delete @${targetUser.username}? This cannot be undone.`
      )
    ) {
      return;
    }

    setMessage("");
    setBusyId(targetUser.id);

    // Get current session token to authenticate the API call
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setMessage("Session expired. Please log in again.");
      setBusyId(null);
      return;
    }

    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: targetUser.id }),
    });

    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setMessage(`Failed to delete user: ${json.error}`);
      return;
    }

    setMessage(`User @${targetUser.username} has been permanently deleted.`);

    // Remove the deleted user from the local list
    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
  }

  // Filter the displayed users based on the search query (client-side)
  const filtered = users.filter((u) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.display_name?.toLowerCase() || "").includes(q)
    );
  });

  if (loading) {
    return <MusicNotesLoader />;
  }

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">

        {/* Header */}
        <div className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                {/* Shield icon to indicate this is the admin area */}
                <span className="text-blue-400">🛡️</span> Admin Panel
              </h1>
              <p className="mt-2 text-zinc-400">
                Manage users — ban, unban, or permanently delete accounts.
              </p>
            </div>
          </div>

          {/* Search box to filter users client-side */}
          <div className="mt-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by username or display name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status message from the last admin action */}
          {message && (
            <p className="mt-4 rounded-lg bg-zinc-800 px-4 py-3 text-sm text-green-400">
              {message}
            </p>
          )}
        </div>

        {/* User list */}
        <section className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900 p-8 text-center text-zinc-400">
              No users found.
            </div>
          ) : (
            filtered.map((user) => (
              <div
                key={user.id}
                className={`rounded-2xl bg-zinc-900 p-5 shadow-lg border ${
                  user.is_banned
                    ? "border-red-800"
                    : user.is_admin
                    ? "border-blue-800"
                    : "border-transparent"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* User info */}
                  <div className="flex items-center gap-4">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-green-400">
                        {user.display_name?.[0]?.toUpperCase() ||
                          user.username[0]?.toUpperCase() ||
                          "U"}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profile/${user.username}`}
                          className="font-semibold text-white hover:text-green-400"
                        >
                          {user.display_name || user.username}
                        </Link>

                        {/* Admin badge — shown if this user is an admin */}
                        {user.is_admin && (
                          <span
                            title="Admin"
                            className="text-blue-400 text-sm"
                            aria-label="Admin"
                          >
                            🛡️
                          </span>
                        )}

                        {/* Banned badge — shown if this user is currently banned */}
                        {user.is_banned && (
                          <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs font-semibold text-red-300">
                            BANNED
                          </span>
                        )}

                        {/* Highlight the current viewer so they know not to act on themselves */}
                        {user.id === currentUserId && (
                          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                            You
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-zinc-400">@{user.username}</p>
                    </div>
                  </div>

                  {/* Admin action buttons (not shown for the admin's own account) */}
                  {user.id !== currentUserId && (
                    <div className="flex gap-2">
                      {/* Ban / Unban toggle */}
                      <button
                        onClick={() => handleBanToggle(user)}
                        disabled={busyId === user.id}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                          user.is_banned
                            ? "bg-green-700 text-white hover:bg-green-600"
                            : "bg-yellow-700 text-white hover:bg-yellow-600"
                        }`}
                      >
                        {busyId === user.id
                          ? "Working..."
                          : user.is_banned
                          ? "Unban"
                          : "Ban"}
                      </button>

                      {/* Delete user permanently */}
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={busyId === user.id}
                        className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {busyId === user.id ? "Working..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Footer count */}
        <p className="text-center text-sm text-zinc-600">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""} shown
        </p>
      </div>
    </main>
  );
}
