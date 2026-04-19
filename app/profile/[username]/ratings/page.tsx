"use client";

/**
 * Profile Ratings Page (/profile/[username]/ratings)
 *
 * Full listing of all song ratings for a given user profile.
 * Shows a summary header (total ratings, average score, # with written reviews,
 * last-reviewed date) and then a full scrollable list of each rating.
 *
 * Each rating entry shows:
 *  - Album art thumbnail
 *  - Track name, artist, album
 *  - Note-symbol rating + numeric score + date
 *  - Written review (or "No written review" message)
 *  - "Listen on Spotify" link (for any viewer)
 *  - Edit / Delete controls (profile owner only)
 *
 * The accent color is read from the profile's accent_text_color column and
 * applied to artist names, scores, and reviews.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../../../utils/supabase/auth";
import TopNav from "../../../../components/TopNav";
import MusicNotesLoader from "../../../components/MusicNotesLoader";
import NoteRating from "../../../components/NoteRating";
import MusicReviewCard from "../../../components/MusicReviewCard";

const DEFAULT_ACCENT_TEXT_COLOR = "#22c55e";

function formatNotesText(rating: number) {
  const fullNotes = Math.floor(rating);
  const half = rating % 1 !== 0;
  return "♪".repeat(fullNotes) + (half ? "½" : "");
}

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  accent_text_color?: string | null;
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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [accentTextColor, setAccentTextColor] = useState(DEFAULT_ACCENT_TEXT_COLOR);

  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editRatingValue, setEditRatingValue] = useState("");
  const [editReviewValue, setEditReviewValue] = useState("");
  const [ratingBusy, setRatingBusy] = useState("");

  useEffect(() => {
    async function loadRatingsPage() {
      if (!username) return;

      setLoading(true);
      setNotFound(false);

      const user = await getCurrentUserSafe();
      setCurrentUserId(user?.id || null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, accent_text_color")
        .eq("username", username.toLowerCase())
        .single();

      if (profileError || !profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (/^#[0-9a-fA-F]{6}$/.test(profileData.accent_text_color || "")) {
        setAccentTextColor(profileData.accent_text_color as string);
      } else {
        setAccentTextColor(DEFAULT_ACCENT_TEXT_COLOR);
      }

      setIsOwnProfile(!!user?.id && user.id === profileData.id);

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

  function startEditRating(rating: SongRating) {
    setEditingRatingId(rating.id);
    setEditRatingValue(String(rating.rating));
    setEditReviewValue(rating.review || "");
  }

  function cancelEditRating() {
    setEditingRatingId(null);
    setEditRatingValue("");
    setEditReviewValue("");
  }

  async function handleSaveRating(ratingId: string) {
    if (!currentUserId || !isOwnProfile) return;
    setRatingBusy(`save-${ratingId}`);

    const { error } = await supabase
      .from("song_ratings")
      .update({
        rating: Number(editRatingValue),
        review: editReviewValue.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ratingId)
      .eq("user_id", currentUserId);

    setRatingBusy("");

    if (error) {
      console.error("Update rating error:", error.message);
      return;
    }

    setRatings((prev) =>
      prev.map((r) =>
        r.id === ratingId
          ? {
              ...r,
              rating: Number(editRatingValue),
              review: editReviewValue.trim() || null,
              updated_at: new Date().toISOString(),
            }
          : r
      )
    );
    setEditingRatingId(null);
  }

  async function handleDeleteRating(ratingId: string) {
    if (!currentUserId || !isOwnProfile) return;
    setRatingBusy(`delete-${ratingId}`);

    const { error } = await supabase
      .from("song_ratings")
      .delete()
      .eq("id", ratingId)
      .eq("user_id", currentUserId);

    setRatingBusy("");

    if (error) {
      console.error("Delete rating error:", error.message);
      return;
    }

    setRatings((prev) => prev.filter((r) => r.id !== ratingId));
  }

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
    return <MusicNotesLoader />;
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center px-6 overflow-x-hidden">
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
    <main className="min-h-screen overflow-x-hidden px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-2xl bg-zinc-900 p-6 shadow-lg">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-2xl font-bold" style={{ color: accentTextColor }}>
                  {profile.display_name?.[0]?.toUpperCase() ||
                    profile.username?.[0]?.toUpperCase() ||
                    "U"}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                  Reviews
                </p>
                <h1 className="text-2xl font-bold text-white">
                  {profile.display_name || profile.username}
                </h1>
                <p className="text-sm text-zinc-400">@{profile.username}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-center">
              <div>
                <p className="text-xs text-zinc-500">Ratings</p>
                <p className="text-xl font-bold text-white">{stats.total}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Average</p>
                <p className="text-xl font-bold" style={{ color: accentTextColor }}>{stats.average}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Reviews</p>
                <p className="text-xl font-bold text-white">{stats.withReviews}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Last reviewed</p>
                <p className="text-sm font-semibold text-white">{stats.latestDate}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <TopNav
              showMyProfile
              myProfileUsername={profile.username}
              showFeed
              showUsers
              showRate
              showAllRatings={false}
            />
            <Link
              href={`/profile/${profile.username}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Back to Profile
            </Link>
          </div>
        </section>

        <section>
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
                            <p className="mt-1 text-base" style={{ color: accentTextColor }}>
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
                            <p className="text-xl font-semibold" style={{ color: accentTextColor }}>
                              <NoteRating rating={rating.rating} />
                            </p>
                            <p className="mt-1 text-sm" style={{ color: accentTextColor }}>
                              {rating.rating}/5 · Reviewed{" "}
                              {formatDate(rating.updated_at)}
                            </p>
                          </div>
                        </div>

                        {rating.review?.trim() ? (
                          <div className="mt-4 max-w-4xl">
                            <p className="text-lg leading-8" style={{ color: accentTextColor }}>
                              &ldquo;{rating.review}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <p className="italic" style={{ color: accentTextColor }}>
                              No written review for this rating.
                            </p>
                          </div>
                        )}

                        <div className="max-w-4xl">
                          <MusicReviewCard
                            rating={rating.rating}
                            review={rating.review}
                            accentColor={accentTextColor}
                          />
                        </div>

                        {isOwnProfile && editingRatingId === rating.id ? (
                          <div className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                            <div>
                              <label className="mb-1 block text-xs text-zinc-400">Rating</label>
                              <select
                                value={editRatingValue}
                                onChange={(e) => setEditRatingValue(e.target.value)}
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none"
                              >
                                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                                  <option key={v} value={v}>{v} — {formatNotesText(v)}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-xs text-zinc-400">Review</label>
                              <textarea
                                value={editReviewValue}
                                onChange={(e) => setEditReviewValue(e.target.value)}
                                rows={3}
                                placeholder="Write your review..."
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none"
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveRating(rating.id)}
                                disabled={ratingBusy !== ""}
                                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-600 disabled:opacity-50"
                              >
                                {ratingBusy === `save-${rating.id}` ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEditRating}
                                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : isOwnProfile ? (
                          <div className="mt-4 flex items-center gap-2">
                            <button
                              onClick={() => startEditRating(rating)}
                              disabled={ratingBusy !== ""}
                              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                            >
                              ✎ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRating(rating.id)}
                              disabled={ratingBusy !== ""}
                              className="rounded-lg border border-red-700 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                            >
                              {ratingBusy === `delete-${rating.id}` ? "Deleting..." : "✕ Delete"}
                            </button>
                            {rating.spotify_track_id && (
                              <a
                                href={`https://open.spotify.com/track/${rating.spotify_track_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-sm hover:underline"
                                style={{ color: accentTextColor }}
                              >
                                Listen on Spotify
                              </a>
                            )}
                          </div>
                        ) : rating.spotify_track_id ? (
                          <div className="mt-4 flex justify-end">
                            <a
                              href={`https://open.spotify.com/track/${rating.spotify_track_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm hover:underline"
                              style={{ color: accentTextColor }}
                            >
                              Listen on Spotify
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
      </div>
    </main>
  );
}
