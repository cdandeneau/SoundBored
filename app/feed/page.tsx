"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../utils/supabase/supabaseClient";
import TopNav from "../../components/TopNav";
import NoteRating from "../components/NoteRating";

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
};

type FeedItem = SongRating & {
  profile: ProfileSummary | null;
};



function formatTimeAgo(iso: string) {
  const now = new Date().getTime();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((then - now) / 1000);

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

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

  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

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
          .select("id, username, display_name, avatar_url")
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
    return (
      <main className="min-h-screen text-white flex items-center justify-center">
        <p className="text-lg text-zinc-400">Loading feed...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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

            <TopNav
              showMyProfile
              myProfileUsername={myUsername}
              showFeed={false}
              showUsers
              showRate
            />
          </div>
        </div>

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
            {feedItems.map((item) => (
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
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-green-400">
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
                                className="font-semibold text-green-400 hover:underline"
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
                        <p className="text-2xl font-semibold text-green-400">
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
            ))}
          </section>
        )}
      </div>
    </main>
  );
}