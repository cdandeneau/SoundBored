"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../utils/supabase/supabaseClient";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type FavoriteTrack = {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  position: number;
};

type FavoriteAlbum = {
  id: string;
  album_name: string;
  artist_name: string;
  image_url: string | null;
  position: number;
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

export default function PublicProfilePage() {
  const params = useParams();
  const username =
    typeof params.username === "string" ? params.username : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteTracks, setFavoriteTracks] = useState<FavoriteTrack[]>([]);
  const [favoriteAlbums, setFavoriteAlbums] = useState<FavoriteAlbum[]>([]);
  const [recentRatings, setRecentRatings] = useState<SongRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadProfile() {
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

      const { data: tracksData, error: tracksError } = await supabase
        .from("favorite_tracks")
        .select("id, track_name, artist_name, album_name, image_url, position")
        .eq("user_id", profileData.id)
        .order("position", { ascending: true });

      if (tracksError) {
        console.error("Error loading favorite tracks:", tracksError.message);
      } else {
        setFavoriteTracks(tracksData || []);
      }

      const { data: albumsData, error: albumsError } = await supabase
        .from("favorite_albums")
        .select("id, album_name, artist_name, image_url, position")
        .eq("user_id", profileData.id)
        .order("position", { ascending: true });

      if (albumsError) {
        console.error("Error loading favorite albums:", albumsError.message);
      } else {
        setFavoriteAlbums(albumsData || []);
      }

      const { data: ratingsData, error: ratingsError } = await supabase
        .from("song_ratings")
        .select(
          "id, spotify_track_id, track_name, artist_name, album_name, image_url, rating, review, created_at, updated_at"
        )
        .eq("user_id", profileData.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (ratingsError) {
        console.error("Error loading recent ratings:", ratingsError.message);
      } else {
        setRecentRatings((ratingsData || []) as SongRating[]);
      }

      setLoading(false);
    }

    loadProfile();
  }, [username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading profile...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
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
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 text-3xl font-bold text-green-400">
              {profile.display_name?.[0]?.toUpperCase() ||
                profile.username?.[0]?.toUpperCase() ||
                "U"}
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-zinc-400">@{profile.username}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <h2 className="mb-2 text-lg font-semibold text-white">Bio</h2>
            <p className="text-zinc-300">
              {profile.bio?.trim()
                ? profile.bio
                : "This user hasn’t added a bio yet."}
            </p>
          </div>
        </div>

        <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold">Recent Ratings</h2>

          <div className="space-y-3">
            {recentRatings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                No song ratings yet.
              </div>
            ) : (
              recentRatings.map((rating) => (
                <div key={rating.id} className="rounded-xl bg-zinc-800/60 p-4">
                  <div className="flex items-center gap-4">
                    {rating.image_url ? (
                      <img
                        src={rating.image_url}
                        alt={rating.track_name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-zinc-700" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">
                        {rating.track_name}
                      </p>
                      <p className="truncate text-sm text-zinc-400">
                        {rating.artist_name}
                      </p>
                      {rating.album_name && (
                        <p className="truncate text-xs text-zinc-500">
                          {rating.album_name}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-semibold text-green-400">
                        {formatNotes(rating.rating)}
                      </p>
                      <p className="text-sm text-zinc-400">{rating.rating}/5</p>
                    </div>
                  </div>

                  {rating.review && (
                    <p className="mt-3 text-sm text-zinc-300">{rating.review}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold">Favorite Tracks</h2>

            <div className="space-y-3">
              {favoriteTracks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                  No favorite tracks yet.
                </div>
              ) : (
                favoriteTracks.map((track) => (
                  <div
                    key={track.id}
                    className="rounded-xl bg-zinc-800/60 p-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 font-bold text-black">
                        {track.position}
                      </div>

                      {track.image_url ? (
                        <img
                          src={track.image_url}
                          alt={track.track_name}
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-zinc-700" />
                      )}

                      <div className="min-w-0 flex-1">
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold">Favorite Albums</h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {favoriteAlbums.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                  No favorite albums yet.
                </div>
              ) : (
                favoriteAlbums.map((album) => (
                  <div key={album.id} className="rounded-xl bg-zinc-800/60 p-3">
                    {album.image_url ? (
                      <img
                        src={album.image_url}
                        alt={album.album_name}
                        className="mb-3 aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-3 aspect-square w-full rounded-lg bg-zinc-700" />
                    )}

                    <div className="mb-1 text-sm font-bold text-green-400">
                      #{album.position}
                    </div>
                    <p className="font-semibold text-white">{album.album_name}</p>
                    <p className="text-sm text-zinc-400">{album.artist_name}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}