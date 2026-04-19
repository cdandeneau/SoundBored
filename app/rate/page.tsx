"use client";

/**
 * Rate a Song Page (/rate)
 *
 * Lets the current user search for a track on Spotify and submit a rating
 * (0.5–5.0 in half-step increments) plus an optional written review.
 *
 * Ratings are upserted into the song_ratings table — if the user has already
 * rated the same Spotify track, their existing rating is updated instead of
 * creating a duplicate.
 *
 * The search proxies through /api/spotify/search so the Spotify credentials
 * never reach the browser.
 *
 * Protected: redirects to /login if not authenticated.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../utils/supabase/auth";
import NoteRating from "../components/NoteRating";
import MusicReviewCard from "../components/MusicReviewCard";

type SpotifyTrackResult = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
};

const ratingOptions = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function formatNotesText(rating: number) {
  const fullNotes = Math.floor(rating);
  const half = rating % 1 !== 0;
  return "♪".repeat(fullNotes) + (half ? "½" : "");
}

export default function RateSongPage() {
  const router = useRouter();

  const [myUsername, setMyUsername] = useState<string | null>(null);

  const [trackSearch, setTrackSearch] = useState("");
  const [trackResults, setTrackResults] = useState<SpotifyTrackResult[]>([]);
  const [trackSearchLoading, setTrackSearchLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrackResult | null>(
    null
  );

  const [rating, setRating] = useState("4");
  const [review, setReview] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadCurrentProfile() {
      const user = await getCurrentUserSafe();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (profileData?.username) {
        setMyUsername(profileData.username);
      }
    }

    loadCurrentProfile();
  }, [router]);

  async function handleTrackSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setTrackResults([]);
    setSelectedTrack(null);

    const query = trackSearch.trim();

    if (!query) {
      setMessage("Enter a song to search.");
      return;
    }

    setTrackSearchLoading(true);

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}&type=track`
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Track search failed.");
        return;
      }

      setTrackResults(data.tracks || []);
    } catch (error) {
      console.error("Track search error:", error);
      setMessage("Something went wrong while searching.");
    } finally {
      setTrackSearchLoading(false);
    }
  }

  async function handleSaveRating(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const user = await getCurrentUserSafe();

    if (!user) {
      setMessage("You must be logged in to rate songs.");
      return;
    }

    if (!selectedTrack) {
      setMessage("Please select a song first.");
      return;
    }

    const numericRating = Number(rating);

    if (numericRating < 0.5 || numericRating > 5) {
      setMessage("Rating must be between 0.5 and 5.");
      return;
    }

    setSubmitting(true);

    const now = new Date().toISOString();

    const { error } = await supabase.from("song_ratings").upsert(
      {
        user_id: user.id,
        spotify_track_id: selectedTrack.spotify_track_id,
        track_name: selectedTrack.track_name,
        artist_name: selectedTrack.artist_name,
        album_name: selectedTrack.album_name,
        image_url: selectedTrack.image_url,
        rating: numericRating,
        review: review.trim() || null,
        updated_at: now,
      },
      {
        onConflict: "user_id,spotify_track_id",
      }
    );

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Song rating saved.");
    setTrackSearch("");
    setTrackResults([]);
    setSelectedTrack(null);
    setRating("4");
    setReview("");
  }

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div>
          <h1 className="text-4xl font-bold">Rate a Song</h1>
        </div>

        <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold">Search for a track</h2>

          <form className="space-y-3" onSubmit={handleTrackSearch}>
            <input
              type="text"
              placeholder="Search song title or artist"
              value={trackSearch}
              onChange={(e) => setTrackSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
            />

            <button
              type="submit"
              disabled={trackSearchLoading}
              className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              {trackSearchLoading ? "Searching..." : "Search Tracks"}
            </button>
          </form>

          {trackResults.length > 0 && (
            <div className="mt-6 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              {trackResults.map((track) => (
                <button
                  key={track.spotify_track_id}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                    selectedTrack?.spotify_track_id === track.spotify_track_id
                      ? "bg-green-500/20 ring-1 ring-green-500"
                      : "bg-zinc-800/60 hover:bg-zinc-800"
                  }`}
                >
                  {track.image_url ? (
                    <img
                      src={track.image_url}
                      alt={track.track_name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-zinc-700" />
                  )}

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {track.track_name}
                    </p>
                    <p className="truncate text-sm text-zinc-400">
                      {track.artist_name}
                    </p>
                    {track.album_name && (
                      <p className="truncate text-xs text-zinc-500">
                        {track.album_name}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold">Your rating</h2>

          <form onSubmit={handleSaveRating} className="space-y-5">
            {selectedTrack ? (
              <div className="flex items-center gap-4 rounded-xl bg-zinc-800/70 p-4">
                {selectedTrack.image_url ? (
                  <img
                    src={selectedTrack.image_url}
                    alt={selectedTrack.track_name}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-zinc-700" />
                )}

                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-white">
                    {selectedTrack.track_name}
                  </p>
                  <p className="truncate text-sm text-zinc-400">
                    {selectedTrack.artist_name}
                  </p>
                  {selectedTrack.album_name && (
                    <p className="truncate text-sm text-zinc-500">
                      {selectedTrack.album_name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                Select a track above first.
              </div>
            )}

            <div>
              <label className="mb-4 block text-sm font-medium text-zinc-300">
                Rating
              </label>
              <div className="flex justify-center gap-4">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(String(value))}
                    className={`text-6xl transition ${
                      Number(rating) >= value
                        ? "text-green-500"
                        : "text-zinc-600 hover:text-zinc-500"
                    }`}
                  >
                    ♪
                  </button>
                ))}
              </div>
            </div>

            {(selectedTrack || review.trim()) && (
              <MusicReviewCard
                rating={Number(rating)}
                review={review}
                accentColor="#4ade80"
              />
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Short review (optional)
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                placeholder="What did you think of this song?"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Rating"}
            </button>

            {message && <p className="text-sm text-zinc-300">{message}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
