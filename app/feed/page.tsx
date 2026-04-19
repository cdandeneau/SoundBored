"use client";

/**
 * Feed Page (/feed)
 *
 * The main social feed. Shows three columns:
 *  1. Feed — song ratings posted by users the current user follows
 *  2. Trending — tracks with the most ratings across all users
 *  3. Suggested — users the current user isn't following yet (helps discovery)
 *
 * Also has a search bar to find and follow users directly from the feed.
 * Protected: redirects to /login if not authenticated.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../utils/supabase/auth";
import NoteRating from "../components/NoteRating";
import MusicNotesLoader from "../components/MusicNotesLoader";

type SongRating = {
  id: string;
  user_id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  accent_text_color?: string | null;
};

type FeedItem = SongRating & {
  profile: ProfileSummary | null;
};

type SearchResult = ProfileSummary & {
  followerCount: number;
  isFollowing: boolean;
};

type TrendingTrack = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  image_url: string | null;
  ratingsCount: number;
  averageRating: number;
};



/**
 * Converts an ISO timestamp to a human-readable relative string
 * e.g. "3 hours ago", "yesterday", "2 weeks ago".
 *
 * Uses Intl.RelativeTimeFormat with numeric:"auto" which produces "yesterday"
 * instead of "1 day ago" where applicable. Falls back to "just now" for
 * timestamps less than a minute in the past.
 */
function formatTimeAgo(iso: string) {
  const now = new Date().getTime();
  const then = new Date(iso).getTime();
  // negative = past, positive = future
  const diffSeconds = Math.round((then - now) / 1000);

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  // Ordered from largest unit to smallest — first match wins
  const ranges = [
    { unit: "year", seconds: 60 * 60 * 24 * 365 },
    { unit: "month", seconds: 60 * 60 * 24 * 30 },
    { unit: "week", seconds: 60 * 60 * 24 * 7 },
    { unit: "day", seconds: 60 * 60 * 24 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "minute", seconds: 60 },
  ] as const;

  for (const range of ranges) {
    if (Math.abs(diffSeconds) >= range.seconds) {
      return formatter.format(
        Math.round(diffSeconds / range.seconds),
        range.unit
      );
    }
  }

  return "just now";
}

export default function FeedPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<TrendingTrack[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function runUserSearch(rawQuery: string, userIdOverride?: string) {
    const userId = userIdOverride || currentUserId;
    if (!userId) return;

    const trimmed = rawQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    setMessage("");

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, accent_text_color")
      .neq("id", userId)
      .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
      .order("username", { ascending: true })
      .limit(8);

    if (profilesError) {
      setMessage(profilesError.message);
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    const profiles = profilesData || [];

    if (profiles.length === 0) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    const ids = profiles.map((profile) => profile.id);

    const { data: myFollowRows, error: myFollowError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", ids);

    if (myFollowError) {
      setMessage(myFollowError.message);
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    const { data: followerRows, error: followerRowsError } = await supabase
      .from("follows")
      .select("following_id")
      .in("following_id", ids);

    if (followerRowsError) {
      setMessage(followerRowsError.message);
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    // Set of profile IDs the current user is already following — used for O(1) lookup
    const followingSet = new Set(
      (myFollowRows || []).map((row) => row.following_id)
    );

    // Build a map of { profileId → total follower count } by counting how many
    // rows in the follows table point to each candidate profile.
    const followerCountMap = new Map<string, number>();
    for (const id of ids) {
      followerCountMap.set(id, 0); // initialize each profile at 0
    }
    for (const row of followerRows || []) {
      followerCountMap.set(
        row.following_id,
        (followerCountMap.get(row.following_id) || 0) + 1
      );
    }

    setSearchResults(
      profiles.map((profile) => ({
        ...profile,
        followerCount: followerCountMap.get(profile.id) || 0,
        isFollowing: followingSet.has(profile.id),
      }))
    );
    setSearchingUsers(false);
  }

  async function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runUserSearch(searchQuery);
  }

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      setMessage("");

      const user = await getCurrentUserSafe();

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

      const { data: followsData, error: followsError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (followsError) {
        setMessage(followsError.message);
        setLoading(false);
        return;
      }

      const followingIds = (followsData || []).map((row) => row.following_id);
      setFollowingCount(followingIds.length);

      // This week's top tracks from app activity (ratings), used to keep the feed lively.
      const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: weekRatings, error: weekRatingsError } = await supabase
        .from("song_ratings")
        .select("spotify_track_id, track_name, artist_name, image_url, rating, updated_at")
        .gte("updated_at", weekAgoIso)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (weekRatingsError) {
        setMessage(weekRatingsError.message);
      } else {
        // Group the last 500 ratings by track, accumulating a count and sum
        // so we can compute the average and sort by popularity.
        const grouped = new Map<
          string,
          {
            spotify_track_id: string;
            track_name: string;
            artist_name: string;
            image_url: string | null;
            ratingsCount: number;
            ratingSum: number;
          }
        >();

        for (const row of weekRatings || []) {
          const key = row.spotify_track_id;
          const current = grouped.get(key);
          if (current) {
            current.ratingsCount += 1;
            current.ratingSum += Number(row.rating || 0);
          } else {
            grouped.set(key, {
              spotify_track_id: row.spotify_track_id,
              track_name: row.track_name,
              artist_name: row.artist_name,
              image_url: row.image_url,
              ratingsCount: 1,
              ratingSum: Number(row.rating || 0),
            });
          }
        }

        // Sort: most-rated tracks first; break ties by average rating
        const topTracks = Array.from(grouped.values())
          .map((track) => ({
            spotify_track_id: track.spotify_track_id,
            track_name: track.track_name,
            artist_name: track.artist_name,
            image_url: track.image_url,
            ratingsCount: track.ratingsCount,
            averageRating:
              track.ratingsCount > 0 ? track.ratingSum / track.ratingsCount : 0,
          }))
          .sort((a, b) => {
            if (b.ratingsCount !== a.ratingsCount) {
              return b.ratingsCount - a.ratingsCount;
            }
            return b.averageRating - a.averageRating;
          })
          .slice(0, 5); // Only show the top 5 trending tracks

        setTrendingTracks(topTracks);
      }

      const { data: allProfiles, error: allProfilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, accent_text_color")
        .neq("id", user.id)
        .order("username", { ascending: true })
        .limit(40);

      if (allProfilesError) {
        setMessage(allProfilesError.message);
      } else {
        const candidates = allProfiles || [];
        const candidateIds = candidates.map((profile) => profile.id);

        if (candidateIds.length > 0) {
          const { data: followingRows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
            .in("following_id", candidateIds);

          const { data: followerRows } = await supabase
            .from("follows")
            .select("following_id")
            .in("following_id", candidateIds);

          const followingSet = new Set(
            (followingRows || []).map((row) => row.following_id)
          );

          const followerCountMap = new Map<string, number>();
          for (const id of candidateIds) {
            followerCountMap.set(id, 0);
          }
          for (const row of followerRows || []) {
            followerCountMap.set(
              row.following_id,
              (followerCountMap.get(row.following_id) || 0) + 1
            );
          }

          const suggestions: SearchResult[] = candidates
            .map((profile) => ({
              ...profile,
              followerCount: followerCountMap.get(profile.id) || 0,
              isFollowing: followingSet.has(profile.id),
            }))
            .filter((profile) => !profile.isFollowing)
            .sort((a, b) => b.followerCount - a.followerCount)
            .slice(0, 5);

          setSuggestedUsers(suggestions);
        } else {
          setSuggestedUsers([]);
        }
      }

      if (followingIds.length === 0) {
        setFeedItems([]);
        setLoading(false);
        return;
      }

      const { data: ratingsData, error: ratingsError } = await supabase
        .from("song_ratings")
        .select(
          "id, user_id, spotify_track_id, track_name, artist_name, album_name, image_url, rating, review, created_at, updated_at"
        )
        .in("user_id", followingIds)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (ratingsError) {
        setMessage(ratingsError.message);
        setLoading(false);
        return;
      }

      const ratingUsers = Array.from(
        new Set((ratingsData || []).map((rating) => rating.user_id))
      );

      let profileMap = new Map<string, ProfileSummary>();

      if (ratingUsers.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, accent_text_color")
          .in("id", ratingUsers);

        if (profileError) {
          setMessage(profileError.message);
          setLoading(false);
          return;
        }

        profileMap = new Map(
          (profileData || []).map((profile) => [profile.id, profile])
        );
      }

      const mergedItems: FeedItem[] = (ratingsData || []).map((rating) => ({
        ...(rating as SongRating),
        profile: profileMap.get(rating.user_id) || null,
      }));

      setFeedItems(mergedItems);
      setLoading(false);
    }

    loadFeed();
  }, [router]);

  if (loading) {
    return <MusicNotesLoader />;
  }

  return (
    <main className="min-h-screen text-white px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-12">
        <div className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Your Feed</h1>
              <p className="mt-2 text-zinc-400">
                Recent ratings from people you follow.
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Following {followingCount}{" "}
                {followingCount === 1 ? "person" : "people"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="mt-6 space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by username or display name"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="submit"
                disabled={searchingUsers}
                className="rounded-lg bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
              >
                {searchingUsers ? "Searching..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                {searchResults.map((user) => (
                  <Link
                    key={user.id}
                    href={`/profile/${user.username}`}
                    className="flex items-center justify-between rounded-lg bg-zinc-800/70 px-3 py-2 hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-green-400">
                          {user.display_name?.[0]?.toUpperCase() ||
                            user.username?.[0]?.toUpperCase() ||
                            "U"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {user.display_name || user.username}
                        </p>
                        <p className="text-xs text-zinc-400">@{user.username}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {user.followerCount} follower{user.followerCount === 1 ? "" : "s"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>

        <section className="rounded-2xl bg-zinc-900 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Top Tracks This Week</h2>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Based on SoundBored ratings
            </p>
          </div>

          {trendingTracks.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Not enough rating activity yet this week.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {trendingTracks.map((track, index) => (
                <article
                  key={track.spotify_track_id}
                  className="rounded-xl bg-zinc-800/70 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-black">
                      #{index + 1}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {track.ratingsCount} ratings
                    </span>
                  </div>
                  {track.image_url ? (
                    <img
                      src={track.image_url}
                      alt={track.track_name}
                      className="mb-2 h-28 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-2 h-28 w-full rounded-lg bg-zinc-700" />
                  )}
                  <p className="truncate text-sm font-semibold text-white">
                    {track.track_name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">{track.artist_name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Avg: {track.averageRating.toFixed(1)}/5
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-zinc-900 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">People You Might Like</h2>
            <Link href="/users" className="text-sm text-green-400 hover:underline">
              Browse all users
            </Link>
          </div>

          {suggestedUsers.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Follow more people and we&apos;ll suggest similar listeners here.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {suggestedUsers.map((user) => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  className="rounded-xl bg-zinc-800/70 p-3 hover:bg-zinc-800"
                >
                  <div className="mb-2 flex items-center gap-2">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-green-400">
                        {user.display_name?.[0]?.toUpperCase() ||
                          user.username?.[0]?.toUpperCase() ||
                          "U"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.display_name || user.username}
                      </p>
                      <p className="truncate text-xs text-zinc-400">@{user.username}</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {user.followerCount} follower{user.followerCount === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {message && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        {followingCount === 0 ? (
          <section className="rounded-2xl bg-zinc-900 p-8 text-center shadow-lg">
            <h2 className="text-2xl font-semibold">Your feed is empty</h2>
            <p className="mt-3 text-zinc-400">
              Follow a few SoundBored users to start seeing their song ratings
              here.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/users"
                className="rounded-lg bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-600"
              >
                Find Users
              </Link>
            </div>
          </section>
        ) : feedItems.length === 0 ? (
          <section className="rounded-2xl bg-zinc-900 p-8 text-center shadow-lg">
            <h2 className="text-2xl font-semibold">No ratings yet</h2>
            <p className="mt-3 text-zinc-400">
              The people you follow haven’t posted any song ratings yet.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {feedItems.map((item) => {
              // Validate the stored accent color before using it; fall back to default green
              const accentColor = /^#[0-9a-fA-F]{6}$/.test(item.profile?.accent_text_color || "")
                ? (item.profile?.accent_text_color as string)
                : "#22c55e";

              return (
              <article
                key={item.id}
                className="rounded-2xl bg-zinc-900 p-5 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.track_name}
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-zinc-800" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {item.profile?.avatar_url ? (
                            <img
                              src={item.profile.avatar_url}
                              alt={item.profile.username}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold" style={{ color: accentColor }}>
                              {item.profile?.display_name?.[0]?.toUpperCase() ||
                                item.profile?.username?.[0]?.toUpperCase() ||
                                "U"}
                            </div>
                          )}
                          <p className="text-sm text-zinc-400">
                          {item.profile?.username ? (
                            <>
                              <Link
                                href={`/profile/${item.profile.username}`}
                                className="font-semibold hover:underline"
                                style={{ color: accentColor }}
                              >
                                {item.profile.display_name ||
                                  item.profile.username}
                              </Link>{" "}
                              <span className="text-zinc-500">
                                @{item.profile.username}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-500">Unknown user</span>
                          )}
                        </p>
                        </div>

                        <h2 className="mt-1 truncate text-xl font-semibold text-white">
                          {item.track_name}
                        </h2>
                        <p className="truncate text-sm text-zinc-400">
                          {item.artist_name}
                        </p>
                        {item.album_name && (
                          <p className="truncate text-xs text-zinc-500">
                            {item.album_name}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-2xl font-semibold" style={{ color: accentColor }}>
                          <NoteRating rating={item.rating} />
                        </p>
                        <p className="text-sm text-zinc-400">
                          {item.rating}/5
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatTimeAgo(item.updated_at)}
                        </p>
                      </div>
                    </div>

                    {item.review && (
                      <p className="mt-4 rounded-xl bg-zinc-800/70 p-4 text-sm text-zinc-200">
                        {item.review}
                      </p>
                    )}
                  </div>
                </div>
              </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}