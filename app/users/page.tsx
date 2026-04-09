"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase/supabaseClient";
import TopNav from "../../components/TopNav";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type SearchResult = Profile & {
  followerCount: number;
  isFollowing: boolean;
};

export default function UsersPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (myProfileData?.username) {
        setMyUsername(myProfileData.username);
      }

      await runSearch("", user.id);
      setLoading(false);
    }

    loadInitial();
  }, [router]);

  async function runSearch(rawQuery: string, userIdOverride?: string) {
    const userId = userIdOverride || currentUserId;
    if (!userId) return;

    setSearching(true);
    setMessage("");

    let profilesQuery = supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .neq("id", userId)
      .order("username", { ascending: true })
      .limit(25);

    const trimmed = rawQuery.trim();

    if (trimmed) {
      profilesQuery = profilesQuery.or(
        `username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`
      );
    }

    const { data: profilesData, error: profilesError } = await profilesQuery;

    if (profilesError) {
      setMessage(profilesError.message);
      setResults([]);
      setSearching(false);
      return;
    }

    const profiles = profilesData || [];

    if (profiles.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }

    const ids = profiles.map((profile) => profile.id);

    const { data: followsData, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", ids);

    if (followsError) {
      setMessage(followsError.message);
      setResults([]);
      setSearching(false);
      return;
    }

    const { data: followerRows, error: followerRowsError } = await supabase
      .from("follows")
      .select("following_id")
      .in("following_id", ids);

    if (followerRowsError) {
      setMessage(followerRowsError.message);
      setResults([]);
      setSearching(false);
      return;
    }

    const followingSet = new Set(
      (followsData || []).map((row) => row.following_id)
    );

    const followerCountMap = new Map<string, number>();

    for (const id of ids) {
      followerCountMap.set(id, 0);
    }

    for (const row of followerRows || []) {
      followerCountMap.set(
        row.following_id,
        (followerCountMap.get(row.following_id) || 0) + 1
      );
    }

    const merged: SearchResult[] = profiles.map((profile) => ({
      ...profile,
      followerCount: followerCountMap.get(profile.id) || 0,
      isFollowing: followingSet.has(profile.id),
    }));

    setResults(merged);
    setSearching(false);
  }

  async function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runSearch(query);
  }

  async function handleToggleFollow(
    profileId: string,
    currentlyFollowing: boolean
  ) {
    if (!currentUserId) return;

    setBusyId(profileId);
    setMessage("");

    if (currentlyFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profileId);

      setBusyId(null);

      if (error) {
        setMessage(error.message);
        return;
      }

      setResults((prev) =>
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                isFollowing: false,
                followerCount: Math.max(0, profile.followerCount - 1),
              }
            : profile
        )
      );

      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: currentUserId,
      following_id: profileId,
    });

    setBusyId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setResults((prev) =>
      prev.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              isFollowing: true,
              followerCount: profile.followerCount + 1,
            }
          : profile
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-lg text-zinc-400">Loading users...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Discover Users</h1>
              <p className="mt-2 text-zinc-400">
                Search SoundBored users and follow their music activity.
              </p>
            </div>

            <TopNav
              showMyProfile
              myProfileUsername={myUsername}
              showFeed
              showUsers={false}
              showRate
            />
          </div>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or display name"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-red-300">{message}</p>}
        </div>

        <section className="space-y-4">
          {results.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900 p-8 text-center text-zinc-400 shadow-lg">
              No users found.
            </div>
          ) : (
            results.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl bg-zinc-900 p-5 shadow-lg"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-xl font-bold text-green-400">
                        {profile.display_name?.[0]?.toUpperCase() ||
                          profile.username[0]?.toUpperCase() ||
                          "U"}
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/profile/${profile.username}`}
                          className="block truncate text-xl font-semibold text-white hover:text-green-400"
                        >
                          {profile.display_name || profile.username}
                        </Link>
                        <p className="truncate text-sm text-zinc-400">
                          @{profile.username}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {profile.followerCount}{" "}
                          {profile.followerCount === 1 ? "follower" : "followers"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm text-zinc-300">
                      {profile.bio?.trim() || "No bio yet."}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/profile/${profile.username}`}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      View Profile
                    </Link>

                    <button
                      onClick={() =>
                        handleToggleFollow(profile.id, profile.isFollowing)
                      }
                      disabled={busyId === profile.id}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        profile.isFollowing
                          ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          : "bg-green-500 text-black hover:bg-green-600"
                      } disabled:opacity-60`}
                    >
                      {busyId === profile.id
                        ? "Working..."
                        : profile.isFollowing
                        ? "Following"
                        : "Follow"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}