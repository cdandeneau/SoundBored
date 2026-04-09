"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../utils/supabase/supabaseClient";
import TopNav from "../../../../components/TopNav";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type SongRating = {
  id: string;
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

function formatNotes(rating: number) {
  const fullNotes = Math.floor(rating);
  const half = rating % 1 !== 0;
  return "♪".repeat(fullNotes) + (half ? "◐" : "");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function ProfileRatingsPage() {
  const params = useParams();
  const username =
    typeof params.username === "string" ? params.username : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<SongRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadRatingsPage() {
      if (!username) return;

      setLoading(true);
      setNotFound(false);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("username", username.toLowerCase())
        .single();

      if (profileError || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: ratingsData, error: ratingsError } = await supabase
        .from("song_ratings")
        .select(
          "id, spotify_track_id, track_name, artist_name, album_name, image_url, rating, review, created_at, updated_at"
        )
        .eq("user_id", profileData.id)
        .order("updated_at", { ascending: false });

      if (ratingsError) {
        console.error("Error loading ratings:", ratingsError.message);
        setRatings([]);
      } else {
        setRatings((ratingsData || []) as SongRating[]);
      }

      setLoading(false);
    }

    loadRatingsPage();
  }, [username]);

  const stats = useMemo(() => {
    const total = ratings.length;
    const average =
      total > 0
        ? (
            ratings.reduce((sum, rating) => sum + rating.rating, 0) / total
          ).toFixed(1)
        : "0.0";

    const withReviews = ratings.filter((rating) => rating.review?.trim()).length;
    const latestDate =
      ratings.length > 0 ? formatDate(ratings[0].updated_at) : "—";

    return {
      total,
      average,
      withReviews,
      latestDate,
    };
  }, [ratings]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center overflow-x-hidden">
        <p className="text-zinc-400 text-lg">Loading ratings...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 overflow-x-hidden">
        <div className="rounded-2xl bg-zinc-900 p-8 text-center shadow-lg">
          <h1 className="text-3xl font-bold">Profile not found</h1>
          <p className="mt-3 text-zinc-400">
            We couldn&apos;t find that SoundBored user.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="border-b border-zinc-800 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            Reviews
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">
            {profile.display_name || profile.username}
          </h1>
          <p className="mt-2 text-zinc-400">@{profile.username}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <TopNav
              showMyProfile
              myProfileUsername={profile.username}
              showFeed
              showUsers
              showRate
            />
            <Link
              href={`/profile/${profile.username}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Back to Profile
            </Link>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-4">
          <section className="min-w-0 xl:col-span-3">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm uppercase tracking-[0.25em] text-zinc-400">
                All Song Ratings
              </h2>
              <p className="text-sm text-zinc-500">
                {ratings.length} {ratings.length === 1 ? "entry" : "entries"}
              </p>
            </div>

            {ratings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                No song ratings yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {ratings.map((rating) => (
                  <article key={rating.id} className="py-6">
                    <div className="flex gap-4">
                      <div className="shrink-0">
                        {rating.image_url ? (
                          <img
                            src={rating.image_url}
                            alt={rating.track_name}
                            className="h-20 w-20 rounded-md object-cover ring-1 ring-zinc-800"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-md bg-zinc-800 ring-1 ring-zinc-700" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <h3 className="truncate text-2xl font-bold tracking-tight text-white">
                              {rating.track_name}
                            </h3>
                            <p className="mt-1 text-base text-zinc-300">
                              {rating.artist_name}
                              {rating.album_name ? (
                                <span className="text-zinc-500">
                                  {" "}
                                  · {rating.album_name}
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-xl font-semibold text-green-400">
                              {formatNotes(rating.rating)}
                            </p>
                            <p className="mt-1 text-sm text-zinc-400">
                              {rating.rating}/5 · Reviewed{" "}
                              {formatDate(rating.updated_at)}
                            </p>
                          </div>
                        </div>

                        {rating.review?.trim() ? (
                          <div className="mt-4 max-w-4xl">
                            <p className="text-lg leading-8 text-zinc-200">
                              {rating.review}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <p className="italic text-zinc-500">
                              No written review for this rating.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="xl:col-span-1">
            <div className="space-y-4 xl:sticky xl:top-8">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Profile
                </p>
                <h3 className="mt-3 text-2xl font-bold text-white">
                  {profile.display_name || profile.username}
                </h3>
                <p className="mt-1 text-zinc-400">@{profile.username}</p>
                <p className="mt-4 text-sm leading-6 text-zinc-300">
                  {profile.bio?.trim() || "No bio yet."}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Stats
                </p>

                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-sm text-zinc-500">Total ratings</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {stats.total}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-500">Average rating</p>
                    <p className="mt-1 text-2xl font-bold text-green-400">
                      {stats.average}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-500">Reviews written</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {stats.withReviews}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-zinc-500">Last reviewed</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {stats.latestDate}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Quick Links
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  <Link
                    href={`/profile/${profile.username}`}
                    className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    View main profile
                  </Link>
                  <Link
                    href="/users"
                    className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    Find more users
                  </Link>
                  <Link
                    href="/feed"
                    className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    Go to feed
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}