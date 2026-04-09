"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../utils/supabase/supabaseClient";
import TopNav from "../../../components/TopNav";

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

type SpotifyAlbumResult = {
  spotify_album_id: string;
  album_name: string;
  artist_name: string;
  image_url: string | null;
};

type SpotifyTrackResult = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username =
    typeof params.username === "string" ? params.username : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteTracks, setFavoriteTracks] = useState<FavoriteTrack[]>([]);
  const [favoriteAlbums, setFavoriteAlbums] = useState<FavoriteAlbum[]>([]);
  const [recentRatings, setRecentRatings] = useState<SongRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [bioDraft, setBioDraft] = useState("");
  const [bioMessage, setBioMessage] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [albumPosition, setAlbumPosition] = useState("1");
  const [albumMessage, setAlbumMessage] = useState("");
  const [albumSubmitting, setAlbumSubmitting] = useState(false);
  const [albumSearch, setAlbumSearch] = useState("");
  const [albumResults, setAlbumResults] = useState<SpotifyAlbumResult[]>([]);
  const [albumSearchLoading, setAlbumSearchLoading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] =
    useState<SpotifyAlbumResult | null>(null);

  const [showTrackForm, setShowTrackForm] = useState(false);
  const [trackPosition, setTrackPosition] = useState("1");
  const [trackMessage, setTrackMessage] = useState("");
  const [trackSubmitting, setTrackSubmitting] = useState(false);
  const [trackSearch, setTrackSearch] = useState("");
  const [trackResults, setTrackResults] = useState<SpotifyTrackResult[]>([]);
  const [trackSearchLoading, setTrackSearchLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] =
    useState<SpotifyTrackResult | null>(null);

  const [busyAction, setBusyAction] = useState("");

  function reorderAlbumsLocal(albumAId: string, albumBId: string) {
    setFavoriteAlbums((prev) => {
      const updated = [...prev];
      const indexA = updated.findIndex((a) => a.id === albumAId);
      const indexB = updated.findIndex((a) => a.id === albumBId);

      if (indexA === -1 || indexB === -1) return prev;

      const posA = updated[indexA].position;
      const posB = updated[indexB].position;

      updated[indexA] = { ...updated[indexA], position: posB };
      updated[indexB] = { ...updated[indexB], position: posA };

      return updated.sort((a, b) => a.position - b.position);
    });
  }

  function reorderTracksLocal(trackAId: string, trackBId: string) {
    setFavoriteTracks((prev) => {
      const updated = [...prev];
      const indexA = updated.findIndex((t) => t.id === trackAId);
      const indexB = updated.findIndex((t) => t.id === trackBId);

      if (indexA === -1 || indexB === -1) return prev;

      const posA = updated[indexA].position;
      const posB = updated[indexB].position;

      updated[indexA] = { ...updated[indexA], position: posB };
      updated[indexB] = { ...updated[indexB], position: posA };

      return updated.sort((a, b) => a.position - b.position);
    });
  }

  function deleteAlbumLocal(id: string) {
    setFavoriteAlbums((prev) => prev.filter((album) => album.id !== id));
  }

  function deleteTrackLocal(id: string) {
    setFavoriteTracks((prev) => prev.filter((track) => track.id !== id));
  }

  async function loadProfile() {
    if (!username) return;

    setLoading(true);
    setNotFound(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    if (user?.id) {
      const { data: currentProfileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (currentProfileData?.username) {
        setCurrentUsername(currentProfileData.username);
      }
    }

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
    setBioDraft(profileData.bio || "");

    const ownProfile = !!user?.id && user.id === profileData.id;
    setIsOwnProfile(ownProfile);

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

    const { count: followerCountValue } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileData.id);

    const { count: followingCountValue } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileData.id);

    setFollowerCount(followerCountValue || 0);
    setFollowingCount(followingCountValue || 0);

    if (user?.id && user.id !== profileData.id) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", profileData.id)
        .maybeSingle();

      setIsFollowing(!!followRow);
    } else {
      setIsFollowing(false);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, [username]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleToggleFollow() {
    if (!currentUserId || !profile || isOwnProfile) return;

    setFollowBusy(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", profile.id);

      setFollowBusy(false);

      if (error) {
        console.error(error.message);
        return;
      }

      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: currentUserId,
      following_id: profile.id,
    });

    setFollowBusy(false);

    if (error) {
      console.error(error.message);
      return;
    }

    setIsFollowing(true);
    setFollowerCount((prev) => prev + 1);
  }

  async function handleSaveBio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBioMessage("");

    if (!currentUserId || !isOwnProfile) {
      setBioMessage("You can only edit your own bio.");
      return;
    }

    setBioSaving(true);

    const cleanedBio = bioDraft.trim();

    const { error } = await supabase
      .from("profiles")
      .update({ bio: cleanedBio })
      .eq("id", currentUserId);

    setBioSaving(false);

    if (error) {
      setBioMessage(error.message);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, bio: cleanedBio } : prev));
    setBioMessage("Bio updated.");
    setIsEditingBio(false);
  }

  function handleCancelBioEdit() {
    setBioDraft(profile?.bio || "");
    setBioMessage("");
    setIsEditingBio(false);
  }

  async function handleAlbumSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAlbumMessage("");
    setAlbumResults([]);
    setSelectedAlbum(null);

    const query = albumSearch.trim();

    if (!query) {
      setAlbumMessage("Enter an album to search.");
      return;
    }

    setAlbumSearchLoading(true);

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}&type=album`
      );
      const data = await response.json();

      if (!response.ok) {
        setAlbumMessage(data.error || "Album search failed.");
        return;
      }

      setAlbumResults(data.albums || []);
    } catch (error) {
      console.error("Album search error:", error);
      setAlbumMessage("Something went wrong while searching.");
    } finally {
      setAlbumSearchLoading(false);
    }
  }

  async function handleTrackSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTrackMessage("");
    setTrackResults([]);
    setSelectedTrack(null);

    const query = trackSearch.trim();

    if (!query) {
      setTrackMessage("Enter a track to search.");
      return;
    }

    setTrackSearchLoading(true);

    try {
      const response = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(query)}&type=track`
      );
      const data = await response.json();

      if (!response.ok) {
        setTrackMessage(data.error || "Track search failed.");
        return;
      }

      setTrackResults(data.tracks || []);
    } catch (error) {
      console.error("Track search error:", error);
      setTrackMessage("Something went wrong while searching.");
    } finally {
      setTrackSearchLoading(false);
    }
  }

  async function handleAddFavoriteAlbum(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAlbumMessage("");

    if (!currentUserId || !isOwnProfile) {
      setAlbumMessage("You can only edit your own profile.");
      return;
    }

    if (!selectedAlbum) {
      setAlbumMessage("Please select an album from search results.");
      return;
    }

    const position = Number(albumPosition);

    if (position < 1 || position > 5) {
      setAlbumMessage("Position must be between 1 and 5.");
      return;
    }

    setAlbumSubmitting(true);

    const albumsToShift = [...favoriteAlbums]
      .filter((album) => album.position >= position)
      .sort((a, b) => b.position - a.position);

    for (const album of albumsToShift) {
      if (album.position === 5) {
        const { error: deleteError } = await supabase
          .from("favorite_albums")
          .delete()
          .eq("id", album.id);

        if (deleteError) {
          setAlbumSubmitting(false);
          setAlbumMessage(deleteError.message);
          return;
        }
      } else {
        const { error: shiftError } = await supabase
          .from("favorite_albums")
          .update({ position: album.position + 1 })
          .eq("id", album.id);

        if (shiftError) {
          setAlbumSubmitting(false);
          setAlbumMessage(shiftError.message);
          return;
        }
      }
    }

    const { data: insertedAlbum, error } = await supabase
      .from("favorite_albums")
      .insert({
        user_id: currentUserId,
        spotify_album_id: selectedAlbum.spotify_album_id,
        album_name: selectedAlbum.album_name,
        artist_name: selectedAlbum.artist_name,
        image_url: selectedAlbum.image_url,
        position,
      })
      .select("id, album_name, artist_name, image_url, position")
      .single();

    setAlbumSubmitting(false);

    if (error) {
      setAlbumMessage(error.message);
      return;
    }

    setFavoriteAlbums((prev) => {
      const shifted = prev
        .filter((album) => album.position < position)
        .concat(
          prev
            .filter((album) => album.position >= position && album.position < 5)
            .map((album) => ({
              ...album,
              position: album.position + 1,
            }))
        );

      return [...shifted, insertedAlbum].sort((a, b) => a.position - b.position);
    });

    setAlbumSearch("");
    setAlbumResults([]);
    setSelectedAlbum(null);
    setAlbumPosition("1");
    setAlbumMessage("Favorite album saved.");
    setShowAlbumForm(false);
  }

  async function handleAddFavoriteTrack(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTrackMessage("");

    if (!currentUserId || !isOwnProfile) {
      setTrackMessage("You can only edit your own profile.");
      return;
    }

    if (!selectedTrack) {
      setTrackMessage("Please select a track from search results.");
      return;
    }

    const position = Number(trackPosition);

    if (position < 1 || position > 5) {
      setTrackMessage("Position must be between 1 and 5.");
      return;
    }

    setTrackSubmitting(true);

    const tracksToShift = [...favoriteTracks]
      .filter((track) => track.position >= position)
      .sort((a, b) => b.position - a.position);

    for (const track of tracksToShift) {
      if (track.position === 5) {
        const { error: deleteError } = await supabase
          .from("favorite_tracks")
          .delete()
          .eq("id", track.id);

        if (deleteError) {
          setTrackSubmitting(false);
          setTrackMessage(deleteError.message);
          return;
        }
      } else {
        const { error: shiftError } = await supabase
          .from("favorite_tracks")
          .update({ position: track.position + 1 })
          .eq("id", track.id);

        if (shiftError) {
          setTrackSubmitting(false);
          setTrackMessage(shiftError.message);
          return;
        }
      }
    }

    const { data: insertedTrack, error } = await supabase
      .from("favorite_tracks")
      .insert({
        user_id: currentUserId,
        spotify_track_id: selectedTrack.spotify_track_id,
        track_name: selectedTrack.track_name,
        artist_name: selectedTrack.artist_name,
        album_name: selectedTrack.album_name,
        image_url: selectedTrack.image_url,
        position,
      })
      .select("id, track_name, artist_name, album_name, image_url, position")
      .single();

    setTrackSubmitting(false);

    if (error) {
      setTrackMessage(error.message);
      return;
    }

    setFavoriteTracks((prev) => {
      const shifted = prev
        .filter((track) => track.position < position)
        .concat(
          prev
            .filter((track) => track.position >= position && track.position < 5)
            .map((track) => ({
              ...track,
              position: track.position + 1,
            }))
        );

      return [...shifted, insertedTrack].sort((a, b) => a.position - b.position);
    });

    setTrackSearch("");
    setTrackResults([]);
    setSelectedTrack(null);
    setTrackPosition("1");
    setTrackMessage("Favorite track saved.");
    setShowTrackForm(false);
  }

  async function handleDeleteFavoriteAlbum(id: string) {
    setBusyAction(`delete-album-${id}`);
    const { error } = await supabase.from("favorite_albums").delete().eq("id", id);
    setBusyAction("");

    if (error) {
      setAlbumMessage(error.message);
      return;
    }

    deleteAlbumLocal(id);
  }

  async function handleDeleteFavoriteTrack(id: string) {
    setBusyAction(`delete-track-${id}`);
    const { error } = await supabase.from("favorite_tracks").delete().eq("id", id);
    setBusyAction("");

    if (error) {
      setTrackMessage(error.message);
      return;
    }

    deleteTrackLocal(id);
  }

  async function swapAlbumPositions(albumA: FavoriteAlbum, albumB: FavoriteAlbum) {
    setBusyAction(`swap-album-${albumA.id}`);

    const tempPosition = 0;

    const step1 = await supabase
      .from("favorite_albums")
      .update({ position: tempPosition })
      .eq("id", albumA.id);

    if (step1.error) {
      setBusyAction("");
      setAlbumMessage(step1.error.message);
      return;
    }

    const step2 = await supabase
      .from("favorite_albums")
      .update({ position: albumA.position })
      .eq("id", albumB.id);

    if (step2.error) {
      setBusyAction("");
      setAlbumMessage(step2.error.message);
      return;
    }

    const step3 = await supabase
      .from("favorite_albums")
      .update({ position: albumB.position })
      .eq("id", albumA.id);

    setBusyAction("");

    if (step3.error) {
      setAlbumMessage(step3.error.message);
      return;
    }

    reorderAlbumsLocal(albumA.id, albumB.id);
  }

  async function swapTrackPositions(trackA: FavoriteTrack, trackB: FavoriteTrack) {
    setBusyAction(`swap-track-${trackA.id}`);

    const tempPosition = 0;

    const step1 = await supabase
      .from("favorite_tracks")
      .update({ position: tempPosition })
      .eq("id", trackA.id);

    if (step1.error) {
      setBusyAction("");
      setTrackMessage(step1.error.message);
      return;
    }

    const step2 = await supabase
      .from("favorite_tracks")
      .update({ position: trackA.position })
      .eq("id", trackB.id);

    if (step2.error) {
      setBusyAction("");
      setTrackMessage(step2.error.message);
      return;
    }

    const step3 = await supabase
      .from("favorite_tracks")
      .update({ position: trackB.position })
      .eq("id", trackA.id);

    setBusyAction("");

    if (step3.error) {
      setTrackMessage(step3.error.message);
      return;
    }

    reorderTracksLocal(trackA.id, trackB.id);
  }

  async function moveAlbumUp(album: FavoriteAlbum) {
    if (album.position === 1) return;
    const other = favoriteAlbums.find((a) => a.position === album.position - 1);
    if (!other) return;
    await swapAlbumPositions(album, other);
  }

  async function moveAlbumDown(album: FavoriteAlbum) {
    if (album.position === 5) return;
    const other = favoriteAlbums.find((a) => a.position === album.position + 1);
    if (!other) return;
    await swapAlbumPositions(album, other);
  }

  async function moveTrackUp(track: FavoriteTrack) {
    if (track.position === 1) return;
    const other = favoriteTracks.find((t) => t.position === track.position - 1);
    if (!other) return;
    await swapTrackPositions(track, other);
  }

  async function moveTrackDown(track: FavoriteTrack) {
    if (track.position === 5) return;
    const other = favoriteTracks.find((t) => t.position === track.position + 1);
    if (!other) return;
    await swapTrackPositions(track, other);
  }

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
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
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

                <div className="mt-3 flex gap-4 text-sm text-zinc-400">
                  <span>
                    <span className="font-semibold text-white">
                      {followerCount}
                    </span>{" "}
                    followers
                  </span>
                  <span>
                    <span className="font-semibold text-white">
                      {followingCount}
                    </span>{" "}
                    following
                  </span>
                </div>
              </div>
            </div>

            {isOwnProfile ? (
              <TopNav
                showMyProfile={false}
                myProfileUsername={currentUsername}
                showFeed
                showUsers
                showRate
                showLogout
                onLogout={handleLogout}
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                <TopNav
                  showMyProfile
                  myProfileUsername={currentUsername}
                  showFeed
                  showUsers
                  showRate
                  showProfile={false}
                />

                <button
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isFollowing
                      ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      : "bg-green-500 text-black hover:bg-green-600"
                  } disabled:opacity-60`}
                >
                  {followBusy ? "Working..." : isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Bio</h2>

              {isOwnProfile && !isEditingBio && (
                <button
                  onClick={() => {
                    setBioDraft(profile.bio || "");
                    setBioMessage("");
                    setIsEditingBio(true);
                  }}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Edit ✏️
                </button>
              )}
            </div>

            {!isEditingBio ? (
              <p className="text-zinc-300">
                {profile.bio?.trim()
                  ? profile.bio
                  : isOwnProfile
                  ? "No bio yet. Click edit to add one."
                  : "This user hasn’t added a bio yet."}
              </p>
            ) : (
              <form onSubmit={handleSaveBio} className="space-y-3">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={3}
                  placeholder="Write something about your music taste..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={bioSaving}
                    className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
                  >
                    {bioSaving ? "Saving..." : "Save Bio"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelBioEdit}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>

                  {bioMessage && (
                    <p className="text-sm text-zinc-300">{bioMessage}</p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent Ratings</h2>

            <div className="flex gap-3">
              {isOwnProfile && (
                <Link
                  href="/rate"
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Rate a Song
                </Link>
              )}
              <Link
                href={`/profile/${profile.username}/ratings`}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                View All Ratings
              </Link>
            </div>
          </div>

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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Favorite Tracks</h2>

              {isOwnProfile && (
                <button
                  onClick={() => {
                    setShowTrackForm((prev) => !prev);
                    setTrackMessage("");
                    setTrackResults([]);
                    setSelectedTrack(null);
                    setTrackSearch("");
                  }}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  {showTrackForm ? "Close" : "Add Track"}
                </button>
              )}
            </div>

            {isOwnProfile && showTrackForm && (
              <div className="mb-6 space-y-4">
                <form className="space-y-3" onSubmit={handleTrackSearch}>
                  <input
                    type="text"
                    placeholder="Search for a track"
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
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
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

                <form
                  onSubmit={handleAddFavoriteTrack}
                  className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  {selectedTrack ? (
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-800/70 p-3">
                      {selectedTrack.image_url ? (
                        <img
                          src={selectedTrack.image_url}
                          alt={selectedTrack.track_name}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-zinc-700" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {selectedTrack.track_name}
                        </p>
                        <p className="truncate text-sm text-zinc-400">
                          {selectedTrack.artist_name}
                        </p>
                        {selectedTrack.album_name && (
                          <p className="truncate text-xs text-zinc-500">
                            {selectedTrack.album_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Select a track above first.
                    </p>
                  )}

                  <select
                    value={trackPosition}
                    onChange={(e) => setTrackPosition(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="1">Position #1</option>
                    <option value="2">Position #2</option>
                    <option value="3">Position #3</option>
                    <option value="4">Position #4</option>
                    <option value="5">Position #5</option>
                  </select>

                  <button
                    type="submit"
                    disabled={trackSubmitting}
                    className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
                  >
                    {trackSubmitting ? "Saving..." : "Save Favorite Track"}
                  </button>

                  {trackMessage && (
                    <p className="text-sm text-zinc-300">{trackMessage}</p>
                  )}
                </form>
              </div>
            )}

            <div className="space-y-3">
              {favoriteTracks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
                  No favorite tracks yet.
                </div>
              ) : (
                favoriteTracks.map((track) => (
                  <div key={track.id} className="rounded-xl bg-zinc-800/60 p-3">
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

                    {isOwnProfile && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => moveTrackUp(track)}
                          disabled={track.position === 1 || busyAction !== ""}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          ↑ Move Up
                        </button>
                        <button
                          onClick={() => moveTrackDown(track)}
                          disabled={track.position === 5 || busyAction !== ""}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          ↓ Move Down
                        </button>
                        <button
                          onClick={() => handleDeleteFavoriteTrack(track.id)}
                          disabled={busyAction !== ""}
                          className="rounded-lg border border-red-700 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-900 p-8 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Favorite Albums</h2>

              {isOwnProfile && (
                <button
                  onClick={() => {
                    setShowAlbumForm((prev) => !prev);
                    setAlbumMessage("");
                    setAlbumResults([]);
                    setSelectedAlbum(null);
                    setAlbumSearch("");
                  }}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  {showAlbumForm ? "Close" : "Add Album"}
                </button>
              )}
            </div>

            {isOwnProfile && showAlbumForm && (
              <div className="mb-6 space-y-4">
                <form className="space-y-3" onSubmit={handleAlbumSearch}>
                  <input
                    type="text"
                    placeholder="Search for an album"
                    value={albumSearch}
                    onChange={(e) => setAlbumSearch(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                  />

                  <button
                    type="submit"
                    disabled={albumSearchLoading}
                    className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {albumSearchLoading ? "Searching..." : "Search Albums"}
                  </button>
                </form>

                {albumResults.length > 0 && (
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                    {albumResults.map((album) => (
                      <button
                        key={album.spotify_album_id}
                        type="button"
                        onClick={() => setSelectedAlbum(album)}
                        className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                          selectedAlbum?.spotify_album_id === album.spotify_album_id
                            ? "bg-green-500/20 ring-1 ring-green-500"
                            : "bg-zinc-800/60 hover:bg-zinc-800"
                        }`}
                      >
                        {album.image_url ? (
                          <img
                            src={album.image_url}
                            alt={album.album_name}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-zinc-700" />
                        )}

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {album.album_name}
                          </p>
                          <p className="truncate text-sm text-zinc-400">
                            {album.artist_name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleAddFavoriteAlbum}
                  className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  {selectedAlbum ? (
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-800/70 p-3">
                      {selectedAlbum.image_url ? (
                        <img
                          src={selectedAlbum.image_url}
                          alt={selectedAlbum.album_name}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-zinc-700" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {selectedAlbum.album_name}
                        </p>
                        <p className="truncate text-sm text-zinc-400">
                          {selectedAlbum.artist_name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Select an album above first.
                    </p>
                  )}

                  <select
                    value={albumPosition}
                    onChange={(e) => setAlbumPosition(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="1">Position #1</option>
                    <option value="2">Position #2</option>
                    <option value="3">Position #3</option>
                    <option value="4">Position #4</option>
                    <option value="5">Position #5</option>
                  </select>

                  <button
                    type="submit"
                    disabled={albumSubmitting}
                    className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
                  >
                    {albumSubmitting ? "Saving..." : "Save Favorite Album"}
                  </button>

                  {albumMessage && (
                    <p className="text-sm text-zinc-300">{albumMessage}</p>
                  )}
                </form>
              </div>
            )}

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

                    {isOwnProfile && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => moveAlbumUp(album)}
                          disabled={album.position === 1 || busyAction !== ""}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          ↑ Up
                        </button>
                        <button
                          onClick={() => moveAlbumDown(album)}
                          disabled={album.position === 5 || busyAction !== ""}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          ↓ Down
                        </button>
                        <button
                          onClick={() => handleDeleteFavoriteAlbum(album.id)}
                          disabled={busyAction !== ""}
                          className="rounded-lg border border-red-700 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
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