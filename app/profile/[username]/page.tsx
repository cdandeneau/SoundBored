"use client";

/**
 * Profile Page (/profile/[username])
 *
 * Dynamic public profile for any user. The page is split into two areas:
 *
 * 1. PROFILE HEADER — avatar, display name, bio, follow stats, follow button.
 *    - Admins see a blue shield (🛡️) badge next to the display name.
 *    - Admins viewing someone else's profile see a ban/unban/delete action strip.
 *    - The profile owner sees edit controls for name, bio, avatar, colors, and layout.
 *
 * 2. SECTION GRID — a drag-and-drop 12-column grid built with react-grid-layout.
 *    Sections can be: recent-ratings, favorite-tracks, favorite-albums, vinyl,
 *    cd, custom-playlist, concert-ticket, or text.
 *    - In view mode the grid is static and compact.
 *    - In edit mode (own profile only) sections are draggable and resizable,
 *      and the user can add new sections, change their theme, and auto-fit heights.
 *
 * Data loaded on mount:
 *  - profiles row for the viewed username (includes is_admin + is_banned)
 *  - Current viewer's profile (to check is_admin and determine isOwnProfile)
 *  - favorite_tracks, favorite_albums, song_ratings for the viewed profile
 *  - follows counts + whether the viewer is already following
 *  - Pattern/color theme stored in the profiles row
 */

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import {
  ResponsiveGridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { supabase } from "../../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../../utils/supabase/auth";
import NoteRating from "../../components/NoteRating";
import VinylPlayer from "../../components/profile/VinylPlayer";
import MusicNotesLoader, { cacheNoteColor } from "../../components/MusicNotesLoader";
import WalkmanPlayer from "../../components/profile/WalkmanPlayer";
import TextSection from "../../components/profile/TextSection";
import CustomPlaylistSection from "../../components/profile/CustomPlaylistSection";
import ConcertTicketStubSection from "../../components/profile/ConcertTicketStubSection";
import AddSectionModal from "../../components/profile/AddSectionModal";
import MusicReviewCard from "../../components/MusicReviewCard";
import StickerLayer, {
  type PlacedSticker,
  type UserCustomSticker,
} from "../../components/profile/StickerLayer";

function formatNotesText(rating: number) {
  const fullNotes = Math.floor(rating);
  const half = rating % 1 !== 0;
  return "♪".repeat(fullNotes) + (half ? "½" : "");
}

type LayoutSection = {
  id: string;
  type: string;
  title: string;
  // react-grid-layout coordinates
  x: number;
  y: number;
  w: number;
  h: number;
  data?: Record<string, unknown>;
  // legacy fields (for migration)
  width?: "full" | "half" | "third";
  position?: number;
};

const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 15;
const GRID_MARGIN_Y = 8;
const DEFAULT_NOTE_COLOR = "#22c55e";
const DEFAULT_ACCENT_TEXT_COLOR = "#22c55e";
const DEFAULT_CARD_BG_COLOR = "#27272a";
const DEFAULT_CARD_BG_OPACITY = 0.6;
const DEFAULT_INNER_BG_COLOR = "#3f3f46";
const DEFAULT_INNER_BG_OPACITY = 0.6;
const DEFAULT_PROFILE_PATTERN = "none" as const;
const DEFAULT_PROFILE_PATTERN_COLOR = "#22c55e";
const DEFAULT_PROFILE_PATTERN_OPACITY = 0.2;
const DEFAULT_PROFILE_BOX_BG_COLOR = "#27272a";
const DEFAULT_PROFILE_BOX_BG_OPACITY = 0.6;

type ProfileCardPattern = "none" | "dots" | "grid" | "diagonal" | "waves" | "crosshatch";

type SectionTheme = {
  accentTextColor: string;
  outerBgColor: string;
  outerBgOpacity: number;
  innerBgColor: string;
  innerBgOpacity: number;
};

/** Clamps opacity to [0.1, 1] — prevents fully invisible card backgrounds */
function clampOpacity(value: number): number {
  return Math.max(0.1, Math.min(1, value));
}

/** Converts a 6-digit hex color to an rgba() string with the given alpha.
 *  Falls back to DEFAULT_CARD_BG_COLOR if the hex is malformed. */
function hexToRgba(hex: string, alpha: number): string {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_CARD_BG_COLOR;
  const normalized = safeHex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clampOpacity(alpha)})`;
}

/** Clamps alpha to [0, 1] for pattern overlays (allows fully transparent) */
function clampAlpha(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Same as hexToRgba but falls back to DEFAULT_PROFILE_PATTERN_COLOR.
 *  Used for background pattern overlays where full transparency is allowed. */
function hexToRgbaAlpha(hex: string, alpha: number): string {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_PROFILE_PATTERN_COLOR;
  const normalized = safeHex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clampAlpha(alpha)})`;
}

/**
 * Returns a React.CSSProperties object with backgroundImage / backgroundSize
 * that renders the chosen decorative pattern over the profile card.
 * The "waves" pattern uses an inline SVG data-URI because CSS gradients alone
 * cannot draw curved wave shapes.
 */
function getProfileCardPatternStyle(
  pattern: ProfileCardPattern,
  color: string,
  opacity: number
): React.CSSProperties {
  const rgba = hexToRgbaAlpha(color, opacity);

  if (pattern === "dots") {
    return {
      backgroundImage: `radial-gradient(${rgba} 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    };
  }

  if (pattern === "grid") {
    return {
      backgroundImage: `linear-gradient(${rgba} 1px, transparent 1px), linear-gradient(90deg, ${rgba} 1px, transparent 1px)`,
      backgroundSize: "20px 20px",
      backgroundPosition: "-1px -1px",
    };
  }

  if (pattern === "diagonal") {
    return {
      backgroundImage: `repeating-linear-gradient(45deg, ${rgba} 0px, ${rgba} 2px, transparent 2px, transparent 12px)`,
    };
  }

  if (pattern === "waves") {
    const waveSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='20'><path d='M0 10 C15 0 30 0 30 10 C30 20 45 20 60 10' stroke='${rgba}' stroke-width='2' fill='none'/></svg>`;
    return {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(waveSvg)}")`,
      backgroundSize: "60px 20px",
    };
  }

  if (pattern === "crosshatch") {
    return {
      backgroundImage: `repeating-linear-gradient(45deg, ${rgba} 0px, ${rgba} 1px, transparent 1px, transparent 10px), repeating-linear-gradient(-45deg, ${rgba} 0px, ${rgba} 1px, transparent 1px, transparent 10px)`,
    };
  }

  return {};
}

/**
 * Estimates the number of grid rows a list section needs to fit all its items
 * without a scrollbar. Called when the user clicks "Auto-fit" in edit mode.
 *
 * The calculation converts pixel heights to grid row units using the formula:
 *   rows = ceil(totalPx / (GRID_ROW_HEIGHT + GRID_MARGIN_Y)) + 1 safety row
 */
function estimateSnugRows(itemCount: number, extraPx = 0): number {
  const safeCount = Math.max(0, itemCount);
  const panelPaddingPx = 40; // p-5 top+bottom
  const headerPx = 42;
  const gapPx = 8;
  const itemPx = 128; // slightly generous to avoid clipping from dynamic content
  const emptyPx = 92;

  const listPx =
    safeCount === 0
      ? emptyPx
      : safeCount * itemPx + Math.max(0, safeCount - 1) * gapPx;

  const totalPx = panelPaddingPx + headerPx + extraPx + listPx;
  const rowUnit = GRID_ROW_HEIGHT + GRID_MARGIN_Y;
  // Add one safety row so inner cards always keep a visible bottom gap.
  return clamp(Math.ceil(totalPx / rowUnit) + 1, 8, 80);
}

const DEFAULT_LAYOUT: LayoutSection[] = [
  { id: "recent-ratings", type: "recent-ratings", title: "Recent Ratings", x: 0, y: 0, w: 4, h: 28 },
  { id: "favorite-tracks", type: "favorite-tracks", title: "Favorite Tracks", x: 4, y: 0, w: 4, h: 28 },
  { id: "favorite-albums", type: "favorite-albums", title: "Favorite Albums", x: 8, y: 0, w: 4, h: 28 },
];

/**
 * Migrates older saved layout formats to the current x/y/w/h grid format.
 *
 * Two legacy formats exist:
 *  1. width/position format — sections had a "full"/"half"/"third" width string
 *     and a numeric position. Converted by mapping widths to column counts and
 *     placing sections left-to-right, wrapping when the row is full.
 *  2. Old 6-column format — sections used a 6-column grid (max x+w ≤ 6).
 *     Doubled by multiplying x, y, w, h by 2 to fit the current 12-column grid.
 */
function migrateLayout(sections: LayoutSection[]): LayoutSection[] {
  if (sections.length === 0) return sections;

  // Old width/position format (no x/y/w/h)
  if (typeof sections[0].x !== "number" || typeof sections[0].w !== "number") {
    const widthMap: Record<string, number> = { full: 12, half: 6, third: 4 };
    let curX = 0;
    let curY = 0;
    return sections
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((s) => {
        const w = widthMap[s.width ?? "third"] ?? 4;
        if (curX + w > GRID_COLS) {
          curX = 0;
          curY += 14;
        }
        const migrated = { ...s, x: curX, y: curY, w, h: 28 };
        curX += w;
        return migrated;
      });
  }

  // Detect old 6-col layouts: max x+w would be <= 6
  const maxRight = Math.max(...sections.map((s) => s.x + s.w));
  if (maxRight <= 6 && sections.some((s) => s.w <= 3)) {
    return sections.map((s) => ({
      ...s,
      x: s.x * 2,
      y: s.y * 2,
      w: s.w * 2,
      h: s.h * 2,
    }));
  }

  return sections;
}

/** Returns the default grid dimensions for a newly added section type.
 *  Taller defaults are given to sections that display lists (ratings, tracks). */
function getDefaultSectionSize(type: string): { w: number; h: number } {
  switch (type) {
    case "text":
      return { w: 4, h: 10 };
    case "vinyl":
    case "cd":
      return { w: 4, h: 18 };
    case "strollman":
      return { w: 4, h: 32 };
    case "custom-playlist":
      return { w: 4, h: 16 };
    case "concert-ticket":
      return { w: 4, h: 20 };
    case "favorite-albums":
      return { w: 4, h: 22 };
    case "favorite-tracks":
    case "recent-ratings":
      return { w: 4, h: 28 };
    default:
      return { w: 4, h: 16 };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes an appropriate grid size for a text section based on its content.
 * Used by the "Auto-fit" button so short notes get a compact box while
 * long paragraphs get a wider, taller card.
 *
 * The width is chosen by character count + line count heuristics.
 * The height estimates how many lines the text will wrap to at the chosen width,
 * then converts wrapped lines to grid row units.
 */
function getDynamicTextSectionSize(title: string, content: string): { w: number; h: number } {
  const safeTitle = (title || "").trim();
  const safeContent = (content || "").trim();
  const combined = `${safeTitle} ${safeContent}`.trim();
  const lines = safeContent.length > 0 ? safeContent.split(/\r?\n/) : [""];
  const longestWord = combined
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, word.length), 0);

  // Width heuristic: short text stays narrow, sentence-like text gets wider,
  // very long words force extra width to avoid tall narrow boxes.
  let w = 4;
  if (combined.length <= 24 && lines.length <= 1) w = 2;
  else if (combined.length <= 60 && lines.length <= 2) w = 4;
  else if (combined.length <= 120 && lines.length <= 3) w = 6;
  else w = 7;

  if (longestWord >= 16) w = Math.max(w, 6);
  if (longestWord >= 24) w = Math.max(w, 8);
  w = clamp(w, 2, 8);

  // Estimate wrapped line count based on chosen width.
  const charsPerLine = w * 16;
  const wrappedLines = lines.reduce((sum, line) => {
    const len = Math.max(1, line.trim().length);
    return sum + Math.max(1, Math.ceil(len / charsPerLine));
  }, 0);

  // Height heuristic: keep tiny text tiny, scale as wrapped lines increase.
  const rows = clamp(5 + Math.ceil(wrappedLines * 1.7), 5, 30);
  return { w, h: rows };
}

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  profile_layout: LayoutSection[] | null;
  note_color?: string | null;
  accent_text_color?: string | null;
  /** Whether this user is a site admin — shows the shield badge publicly */
  is_admin?: boolean | null;
  /** Whether this user has been banned by an admin */
  is_banned?: boolean | null;
  /** Free-floating stickers placed on the profile grid (JSONB array) */
  stickers?: PlacedSticker[] | null;
};

type FavoriteTrack = {
  id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  position: number;
};

type FavoriteAlbum = {
  id: string;
  spotify_album_id: string;
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

type FollowProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function loadFollowProfiles(userIds: string[]): Promise<FollowProfile[]> {
  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);

  if (error || !data) {
    console.error("Error loading follow profiles:", error?.message);
    return [];
  }

  const profileMap = new Map(data.map((item) => [item.id, item as FollowProfile]));
  return userIds
    .map((id) => profileMap.get(id))
    .filter((item): item is FollowProfile => !!item);
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
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowProfile[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const [bioDraft, setBioDraft] = useState("");
  const [bioMessage, setBioMessage] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [noteColor, setNoteColor] = useState(DEFAULT_NOTE_COLOR);
  const [noteColorSaving, setNoteColorSaving] = useState(false);
  const [noteColorMessage, setNoteColorMessage] = useState("");
  const [accentTextColor, setAccentTextColor] = useState(DEFAULT_ACCENT_TEXT_COLOR);
  const [accentTextSaving, setAccentTextSaving] = useState(false);
  const [accentTextMessage, setAccentTextMessage] = useState("");
  const [profileCardPattern, setProfileCardPattern] = useState<ProfileCardPattern>(DEFAULT_PROFILE_PATTERN);
  const [profileCardPatternColor, setProfileCardPatternColor] = useState(DEFAULT_PROFILE_PATTERN_COLOR);
  const [profileCardPatternOpacity, setProfileCardPatternOpacity] = useState(DEFAULT_PROFILE_PATTERN_OPACITY);
  const [profileBoxBgColor, setProfileBoxBgColor] = useState(DEFAULT_PROFILE_BOX_BG_COLOR);
  const [profileBoxBgOpacity, setProfileBoxBgOpacity] = useState(DEFAULT_PROFILE_BOX_BG_OPACITY);
  const [profilePatternSaving, setProfilePatternSaving] = useState(false);
  const [profilePatternMessage, setProfilePatternMessage] = useState("");
  const [styleTargetSectionId, setStyleTargetSectionId] = useState<string>("all");
  const [boxAccentDraft, setBoxAccentDraft] = useState(DEFAULT_ACCENT_TEXT_COLOR);
  const [boxOuterBgColorDraft, setBoxOuterBgColorDraft] = useState(DEFAULT_CARD_BG_COLOR);
  const [boxOuterBgOpacityDraft, setBoxOuterBgOpacityDraft] = useState(DEFAULT_CARD_BG_OPACITY);
  const [boxInnerBgColorDraft, setBoxInnerBgColorDraft] = useState(DEFAULT_INNER_BG_COLOR);
  const [boxInnerBgOpacityDraft, setBoxInnerBgOpacityDraft] = useState(DEFAULT_INNER_BG_OPACITY);
  const [boxStyleMessage, setBoxStyleMessage] = useState("");

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

  // Admin state — whether the logged-in viewer is an admin, and status of admin actions
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState("");
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  // Sticker state
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [userCustomStickers, setUserCustomStickers] = useState<UserCustomSticker[]>([]);
  const [showStickerToolbar, setShowStickerToolbar] = useState(false);
  const stickerSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);
  const [editRatingValue, setEditRatingValue] = useState("");
  const [editReviewValue, setEditReviewValue] = useState("");
  const [ratingBusy, setRatingBusy] = useState("");

  const [layout, setLayout] = useState<LayoutSection[]>(DEFAULT_LAYOUT);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [panelX, setPanelX] = useState(20);
  const [panelY, setPanelY] = useState(100);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canCustomizeSections = isOwnProfile && isEditMode;

  useEffect(() => {
    const updateWidth = () => {
      setViewportWidth(window.innerWidth || 1200);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setShowTrackForm(false);
      setShowAlbumForm(false);
      setEditingRatingId(null);
      setTrackMessage("");
      setAlbumMessage("");
      setShowStickerToolbar(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (styleTargetSectionId === "all") {
      if (layout.length === 0) {
        setBoxAccentDraft(accentTextColor);
        setBoxOuterBgColorDraft(DEFAULT_CARD_BG_COLOR);
        setBoxOuterBgOpacityDraft(DEFAULT_CARD_BG_OPACITY);
        setBoxInnerBgColorDraft(DEFAULT_INNER_BG_COLOR);
        setBoxInnerBgOpacityDraft(DEFAULT_INNER_BG_OPACITY);
        return;
      }

      // Reflect actual applied styles in controls when "All Boxes" is selected.
      const baseTheme = getSectionTheme(layout[0]);
      setBoxAccentDraft(baseTheme.accentTextColor);
      setBoxOuterBgColorDraft(baseTheme.outerBgColor);
      setBoxOuterBgOpacityDraft(baseTheme.outerBgOpacity);
      setBoxInnerBgColorDraft(baseTheme.innerBgColor);
      setBoxInnerBgOpacityDraft(baseTheme.innerBgOpacity);
      return;
    }

    const selected = layout.find((section) => section.id === styleTargetSectionId);
    if (!selected) return;
    const theme = getSectionTheme(selected);
    setBoxAccentDraft(theme.accentTextColor);
    setBoxOuterBgColorDraft(theme.outerBgColor);
    setBoxOuterBgOpacityDraft(theme.outerBgOpacity);
    setBoxInnerBgColorDraft(theme.innerBgColor);
    setBoxInnerBgOpacityDraft(theme.innerBgOpacity);
  }, [styleTargetSectionId, layout, accentTextColor]);

  useEffect(() => {
    if (isEditMode) return;

    let changed = false;

    const nextLayout = layout.map((section) => {
      let targetH = section.h;

      if (section.type === "favorite-tracks") {
        targetH = estimateSnugRows(favoriteTracks.length, showTrackForm ? 320 : 0);
      } else if (section.type === "favorite-albums") {
        targetH = estimateSnugRows(favoriteAlbums.length, showAlbumForm ? 320 : 0);
      } else if (section.type === "recent-ratings") {
        // Extra per-item height for MusicReviewCard rendered inside each rating
        const reviewCardExtra = recentRatings.length * 80;
        targetH = estimateSnugRows(recentRatings.length, (editingRatingId ? 120 : 0) + 24 + reviewCardExtra);
      } else if (section.type === "custom-playlist") {
        const tracks = (section.data?.tracks as unknown[] | undefined) || [];
        targetH = estimateSnugRows(tracks.length, 0);
      }

      if (targetH !== section.h) {
        changed = true;
        return { ...section, h: targetH };
      }

      return section;
    });

    if (!changed) return;

    setLayout(nextLayout);

    if (currentUserId) {
      supabase
        .from("profiles")
        .update({ profile_layout: nextLayout })
        .eq("id", currentUserId);
    }
  }, [
    layout,
    isEditMode,
    currentUserId,
    favoriteTracks.length,
    favoriteAlbums.length,
    recentRatings.length,
    showTrackForm,
    showAlbumForm,
    editingRatingId,
  ]);

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

    // Seed noteColor from cache immediately so the loading screen uses the
    // right color before the network response arrives.
    const cached = localStorage.getItem("soundbored_note_color");
    if (cached) setNoteColor(cached);

    setLoading(true);
    setNotFound(false);

    const user = await getCurrentUserSafe();

    setCurrentUserId(user?.id || null);

    if (user?.id) {
      // Fetch the logged-in user's own profile to get their username and admin status
      const { data: currentProfileData } = await supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .single();

      if (currentProfileData?.username) {
        setCurrentUsername(currentProfileData.username);
      }
      // Store whether the currently logged-in viewer is an admin
      setIsCurrentUserAdmin(!!currentProfileData?.is_admin);
    }

    // Fetch the profile being viewed — includes is_admin and is_banned so we can
    // show the shield badge and let admins see the ban status of other users
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, profile_layout, note_color, accent_text_color, is_admin, is_banned, stickers")
      .eq("username", username.toLowerCase())
      .single();

    if (profileError || !profileData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfile(profileData);
    setBioDraft(profileData.bio || "");
    setLayout(migrateLayout(profileData.profile_layout || DEFAULT_LAYOUT));
    setPlacedStickers((profileData.stickers as PlacedSticker[] | null) || []);

    if (/^#[0-9a-fA-F]{6}$/.test(profileData.note_color || "")) {
      setNoteColor(profileData.note_color as string);
      cacheNoteColor(profileData.note_color as string);
    } else {
      setNoteColor(DEFAULT_NOTE_COLOR);
      cacheNoteColor(DEFAULT_NOTE_COLOR);
    }

    if (/^#[0-9a-fA-F]{6}$/.test(profileData.accent_text_color || "")) {
      setAccentTextColor(profileData.accent_text_color as string);
    } else {
      setAccentTextColor(DEFAULT_ACCENT_TEXT_COLOR);
    }

    const { data: patternData, error: patternError } = await supabase
      .from("profiles")
      .select("profile_card_pattern, profile_card_pattern_color, profile_card_pattern_opacity, profile_box_bg_color, profile_box_bg_opacity")
      .eq("id", profileData.id)
      .maybeSingle();

    if (!patternError && patternData) {
      const rawPattern = patternData.profile_card_pattern;
      const parsedPattern: ProfileCardPattern =
        rawPattern === "dots" || rawPattern === "grid" || rawPattern === "diagonal" || rawPattern === "waves" || rawPattern === "crosshatch"
          ? rawPattern
          : "none";
      setProfileCardPattern(parsedPattern);

      if (/^#[0-9a-fA-F]{6}$/.test(patternData.profile_card_pattern_color || "")) {
        setProfileCardPatternColor(patternData.profile_card_pattern_color as string);
      } else {
        setProfileCardPatternColor(DEFAULT_PROFILE_PATTERN_COLOR);
      }

      const parsedOpacity = Number(patternData.profile_card_pattern_opacity);
      if (!Number.isNaN(parsedOpacity)) {
        setProfileCardPatternOpacity(clampAlpha(parsedOpacity));
      } else {
        setProfileCardPatternOpacity(DEFAULT_PROFILE_PATTERN_OPACITY);
      }

      if (/^#[0-9a-fA-F]{6}$/.test(patternData.profile_box_bg_color || "")) {
        setProfileBoxBgColor(patternData.profile_box_bg_color as string);
      } else {
        setProfileBoxBgColor(DEFAULT_PROFILE_BOX_BG_COLOR);
      }

      const parsedBoxOpacity = Number(patternData.profile_box_bg_opacity);
      if (!Number.isNaN(parsedBoxOpacity)) {
        setProfileBoxBgOpacity(clampAlpha(parsedBoxOpacity));
      } else {
        setProfileBoxBgOpacity(DEFAULT_PROFILE_BOX_BG_OPACITY);
      }
    } else {
      setProfileCardPattern(DEFAULT_PROFILE_PATTERN);
      setProfileCardPatternColor(DEFAULT_PROFILE_PATTERN_COLOR);
      setProfileCardPatternOpacity(DEFAULT_PROFILE_PATTERN_OPACITY);
      setProfileBoxBgColor(DEFAULT_PROFILE_BOX_BG_COLOR);
      setProfileBoxBgOpacity(DEFAULT_PROFILE_BOX_BG_OPACITY);
    }

    const ownProfile = !!user?.id && user.id === profileData.id;
    setIsOwnProfile(ownProfile);

    // Load the user's uploaded custom stickers so they can place them on their profile
    if (ownProfile && user?.id) {
      const { data: customStickerData } = await supabase
        .from("user_stickers")
        .select("id, image_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setUserCustomStickers(customStickerData || []);
    } else {
      setUserCustomStickers([]);
    }

    const { data: tracksData, error: tracksError } = await supabase
      .from("favorite_tracks")
      .select("id, spotify_track_id, track_name, artist_name, album_name, image_url, position")
      .eq("user_id", profileData.id)
      .order("position", { ascending: true });

    if (tracksError) {
      console.error("Error loading favorite tracks:", tracksError.message);
    } else {
      setFavoriteTracks(tracksData || []);
    }

    const { data: albumsData, error: albumsError } = await supabase
      .from("favorite_albums")
      .select("id, spotify_album_id, album_name, artist_name, image_url, position")
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

    const { data: followerRows, error: followerRowsError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", profileData.id)
      .limit(50);

    if (followerRowsError) {
      console.error("Error loading followers:", followerRowsError.message);
      setFollowers([]);
    } else {
      const followerIds = (followerRows || []).map((row) => row.follower_id);
      setFollowers(await loadFollowProfiles(followerIds));
    }

    const { data: followingRows, error: followingRowsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", profileData.id)
      .limit(50);

    if (followingRowsError) {
      console.error("Error loading following:", followingRowsError.message);
      setFollowingUsers([]);
    } else {
      const followingIds = (followingRows || []).map((row) => row.following_id);
      setFollowingUsers(await loadFollowProfiles(followingIds));
    }

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

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingPanel) return;
      setPanelX(e.clientX - dragOffset.x);
      setPanelY(e.clientY - dragOffset.y);
    }

    function handleMouseUp() {
      setIsDraggingPanel(false);
    }

    if (isDraggingPanel) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPanel, dragOffset]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  /**
   * Admin: ban or unban the profile being viewed.
   * Calls /api/admin/ban or /api/admin/unban with the current session token.
   * The server verifies admin status before taking action.
   */
  async function handleAdminBanToggle() {
    if (!profile || !isCurrentUserAdmin) return;

    setAdminActionMessage("");
    setAdminActionBusy(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setAdminActionMessage("Session expired. Please log in again.");
      setAdminActionBusy(false);
      return;
    }

    const isBanned = !!profile.is_banned;
    const endpoint = isBanned ? "/api/admin/unban" : "/api/admin/ban";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: profile.id }),
    });

    const json = await res.json();
    setAdminActionBusy(false);

    if (!res.ok) {
      setAdminActionMessage(json.error || "Action failed.");
      return;
    }

    // Update local profile state so the UI reflects the new ban status immediately
    setProfile((prev) => (prev ? { ...prev, is_banned: !isBanned } : prev));
    setAdminActionMessage(
      isBanned
        ? `@${profile.username} has been unbanned.`
        : `@${profile.username} has been banned.`
    );
  }

  /**
   * Admin: permanently delete the user being viewed.
   * Confirms with a dialog first, then calls /api/admin/delete.
   * After success, redirects to /admin since the profile no longer exists.
   */
  async function handleAdminDelete() {
    if (!profile || !isCurrentUserAdmin) return;

    if (
      !window.confirm(
        `Permanently delete @${profile.username}? This cannot be undone.`
      )
    ) {
      return;
    }

    setAdminActionMessage("");
    setAdminActionBusy(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setAdminActionMessage("Session expired. Please log in again.");
      setAdminActionBusy(false);
      return;
    }

    const res = await fetch("/api/admin/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: profile.id }),
    });

    const json = await res.json();
    setAdminActionBusy(false);

    if (!res.ok) {
      setAdminActionMessage(json.error || "Delete failed.");
      return;
    }

    // Profile is gone — redirect to the admin panel
    router.push("/admin");
  }

  /**
   * Admin: toggle the admin status of the profile being viewed.
   * Calls /api/admin/makeadmin with the current session token.
   * The server verifies admin status before taking action.
   */
  async function handleAdminToggleAdmin() {
    if (!profile || !isCurrentUserAdmin) return;

    setAdminActionMessage("");
    setAdminActionBusy(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setAdminActionMessage("Session expired. Please log in again.");
      setAdminActionBusy(false);
      return;
    }

    const res = await fetch("/api/admin/makeadmin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: profile.id }),
    });

    const json = await res.json();
    setAdminActionBusy(false);

    if (!res.ok) {
      setAdminActionMessage(json.error || "Action failed.");
      return;
    }

    // Update local profile state so the UI reflects the new admin status immediately
    setProfile((prev) => (prev ? { ...prev, is_admin: json.is_admin } : prev));
    setAdminActionMessage(
      json.is_admin
        ? `@${profile.username} is now an admin.`
        : `@${profile.username} is no longer an admin.`
    );
  }

  /**
   * Called by StickerLayer whenever stickers are added, moved, or deleted.
   * Updates local state immediately and debounces the Supabase write by 500 ms.
   */
  function handleStickersChange(stickers: PlacedSticker[]) {
    setPlacedStickers(stickers);
    if (!currentUserId) return;
    if (stickerSaveTimeoutRef.current) clearTimeout(stickerSaveTimeoutRef.current);
    stickerSaveTimeoutRef.current = setTimeout(async () => {
      await supabase.from("profiles").update({ stickers }).eq("id", currentUserId);
    }, 500);
  }

  /**
   * Uploads a custom sticker PNG/WebP to the `stickers` Supabase Storage bucket,
   * inserts a row in `user_stickers`, and returns the public URL.
   * Returns null if validation fails or the upload errors.
   */
  async function handleUploadSticker(file: File): Promise<string | null> {
    if (!currentUserId) return null;

    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) return null;
    if (!["image/png", "image/webp"].includes(file.type)) return null;

    const ext = file.type === "image/webp" ? "webp" : "png";
    const filePath = `${currentUserId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("stickers")
      .upload(filePath, file, { upsert: false });

    if (uploadError) return null;

    const { data: publicUrlData } = supabase.storage
      .from("stickers")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const { data: insertedSticker } = await supabase
      .from("user_stickers")
      .insert({ user_id: currentUserId, image_url: imageUrl })
      .select("id, image_url")
      .single();

    if (insertedSticker) {
      setUserCustomStickers((prev) => [insertedSticker as UserCustomSticker, ...prev]);
    }

    return imageUrl;
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
      setFollowers((prev) => prev.filter((item) => item.id !== currentUserId));
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
    if (currentUsername) {
      setFollowers((prev) => {
        if (prev.some((item) => item.id === currentUserId)) {
          return prev;
        }

        return [
          {
            id: currentUserId,
            username: currentUsername,
            display_name: currentUsername,
            avatar_url: null,
          },
          ...prev,
        ].slice(0, 50);
      });
    }
  }

  function renderFollowList(
    title: string,
    items: FollowProfile[],
    emptyMessage: string
  ) {
    return (
      <section className="rounded-2xl bg-zinc-900/70 p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/profile/${item.username}`}
                className="flex items-center gap-3 rounded-xl bg-zinc-800/70 px-3 py-2 transition hover:bg-zinc-800"
              >
                {item.avatar_url ? (
                  <img
                    src={item.avatar_url}
                    alt={item.username}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-green-400">
                    {item.display_name?.[0]?.toUpperCase() ||
                      item.username?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {item.display_name || item.username}
                  </p>
                  <p className="truncate text-sm text-zinc-400">@{item.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    );
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

  async function handleSaveDisplayName() {
    if (!currentUserId || !isOwnProfile) return;
    setDisplayNameSaving(true);

    const cleaned = displayNameDraft.trim();

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: cleaned || null })
      .eq("id", currentUserId);

    setDisplayNameSaving(false);

    if (error) return;

    setProfile((prev) => (prev ? { ...prev, display_name: cleaned || null } : prev));
    setIsEditingDisplayName(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !isOwnProfile) return;

    setAvatarUploading(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `${currentUserId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      setAvatarUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", currentUserId);

    setAvatarUploading(false);

    if (updateError) {
      console.error("Profile update error:", updateError.message);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
  }

  async function handleSaveNoteColor() {
    if (!currentUserId || !isOwnProfile) return;
    setNoteColorSaving(true);
    setNoteColorMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ note_color: noteColor })
      .eq("id", currentUserId);

    setNoteColorSaving(false);

    if (error) {
      setNoteColorMessage("Unable to save note color yet.");
      return;
    }

    setNoteColorMessage("Saved");
  }

  async function handleSaveAccentTextColor() {
    if (!currentUserId || !isOwnProfile) return;
    setAccentTextSaving(true);
    setAccentTextMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ accent_text_color: accentTextColor })
      .eq("id", currentUserId);

    setAccentTextSaving(false);

    if (error) {
      setAccentTextMessage("Unable to save text color yet.");
      return;
    }

    setAccentTextMessage("Saved");
  }

  async function handleSaveProfileCardPattern() {
    if (!currentUserId || !isOwnProfile) return;
    setProfilePatternSaving(true);
    setProfilePatternMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        profile_card_pattern: profileCardPattern,
        profile_card_pattern_color: profileCardPatternColor,
        profile_card_pattern_opacity: clampAlpha(profileCardPatternOpacity),
        profile_box_bg_color: profileBoxBgColor,
        profile_box_bg_opacity: clampAlpha(profileBoxBgOpacity),
      })
      .eq("id", currentUserId);

    setProfilePatternSaving(false);

    if (error) {
      setProfilePatternMessage("Unable to save card pattern yet.");
      return;
    }

    setProfilePatternMessage("Saved");
  }

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

    setRecentRatings((prev) =>
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

    setRecentRatings((prev) => prev.filter((r) => r.id !== ratingId));
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
      .select("id, spotify_album_id, album_name, artist_name, image_url, position")
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
      .select("id, spotify_track_id, track_name, artist_name, album_name, image_url, position")
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

  /* ───── Layout handlers ───── */

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function saveLayout(newLayout: LayoutSection[]) {
    setLayout(newLayout);
    if (!currentUserId) return;
    await supabase
      .from("profiles")
      .update({ profile_layout: newLayout })
      .eq("id", currentUserId);
  }

  function getSectionTheme(section: LayoutSection): SectionTheme {
    const rawTheme = section.data?.theme as Partial<SectionTheme> | undefined;
    const legacyRawTheme = section.data?.theme as
      | (Partial<SectionTheme> & { cardBgColor?: string; cardBgOpacity?: number })
      | undefined;

    const outerBgColor =
      rawTheme?.outerBgColor && /^#[0-9a-fA-F]{6}$/.test(rawTheme.outerBgColor)
        ? rawTheme.outerBgColor
        : legacyRawTheme?.cardBgColor && /^#[0-9a-fA-F]{6}$/.test(legacyRawTheme.cardBgColor)
          ? legacyRawTheme.cardBgColor
          : DEFAULT_CARD_BG_COLOR;

    const outerBgOpacity =
      typeof rawTheme?.outerBgOpacity === "number"
        ? clampOpacity(rawTheme.outerBgOpacity)
        : typeof legacyRawTheme?.cardBgOpacity === "number"
          ? clampOpacity(legacyRawTheme.cardBgOpacity)
          : DEFAULT_CARD_BG_OPACITY;

    return {
      accentTextColor:
        rawTheme?.accentTextColor && /^#[0-9a-fA-F]{6}$/.test(rawTheme.accentTextColor)
          ? rawTheme.accentTextColor
          : accentTextColor,
      outerBgColor,
      outerBgOpacity,
      innerBgColor:
        rawTheme?.innerBgColor && /^#[0-9a-fA-F]{6}$/.test(rawTheme.innerBgColor)
          ? rawTheme.innerBgColor
          : DEFAULT_INNER_BG_COLOR,
      innerBgOpacity:
        typeof rawTheme?.innerBgOpacity === "number"
          ? clampOpacity(rawTheme.innerBgOpacity)
          : DEFAULT_INNER_BG_OPACITY,
    };
  }

  function applyBoxStyleToSection(sectionId: string) {
    const updatedLayout = layout.map((section) => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        data: {
          ...(section.data || {}),
          theme: {
            accentTextColor: boxAccentDraft,
            outerBgColor: boxOuterBgColorDraft,
            outerBgOpacity: clampOpacity(boxOuterBgOpacityDraft),
            innerBgColor: boxInnerBgColorDraft,
            innerBgOpacity: clampOpacity(boxInnerBgOpacityDraft),
          },
        },
      };
    });

    saveLayout(updatedLayout);
    setBoxStyleMessage("Applied to selected box.");
  }

  function applyBoxStyleToAllSections() {
    const updatedLayout = layout.map((section) => ({
      ...section,
      data: {
        ...(section.data || {}),
        theme: {
          accentTextColor: boxAccentDraft,
          outerBgColor: boxOuterBgColorDraft,
          outerBgOpacity: clampOpacity(boxOuterBgOpacityDraft),
          innerBgColor: boxInnerBgColorDraft,
          innerBgOpacity: clampOpacity(boxInnerBgOpacityDraft),
        },
      },
    }));

    saveLayout(updatedLayout);
    setBoxStyleMessage("Applied to all boxes.");
  }

  /** Called by react-grid-layout when items are moved or resized */
  const handleLayoutChange = useCallback(
    (rglLayout: Layout) => {
      // Only persist when the user is actively editing
      if (!isEditMode) return;
      const updated = layout.map((section) => {
        const item = rglLayout.find((l: LayoutItem) => l.i === section.id);
        if (!item) return section;
        return { ...section, x: item.x, y: item.y, w: item.w, h: item.h };
      });
      setLayout(updated);
      // Debounce save to Supabase
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (!currentUserId) return;
        supabase
          .from("profiles")
          .update({ profile_layout: updated })
          .eq("id", currentUserId);
      }, 500);
    },
    [currentUserId, isEditMode, layout]
  );

  function handleRemoveSection(sectionId: string) {
    saveLayout(layout.filter((s) => s.id !== sectionId));
  }

  function handleAddSection(type: string, title: string) {
    const id = `${type}-${Date.now()}`;
    const data =
      type === "text"
        ? { content: "" }
        : type === "vinyl" || type === "cd"
          ? {}
          : type === "custom-playlist"
            ? { tracks: [] }
            : type === "concert-ticket"
              ? {
                  artist: "",
                  tourName: "",
                  albumName: "",
                  venue: "",
                  city: "",
                  date: "",
                  year: "",
                  row: "",
                  section: "",
                  seat: "",
                  notes: "",
                  borderPrimary: "#e11d48",
                  borderSecondary: "#9ca3af",
                }
            : undefined;
    // Place new section at the bottom, 2 columns wide
    const maxY = layout.reduce((max, s) => Math.max(max, s.y + s.h), 0);
    const size = getDefaultSectionSize(type);
    saveLayout([
      ...layout,
      { id, type, title, x: 0, y: maxY, w: size.w, h: size.h, data },
    ]);
  }

  async function handleAutoFitTextSections() {
    if (!isEditMode || isAutoFitting) return;
    setIsAutoFitting(true);

    const updated = layout.map((section) => {
      // Text sections: true content-based measurement.
      if (section.type === "text") {
        const content = (section.data?.content as string) || "";
        const size = getDynamicTextSectionSize(section.title, content);
        return { ...section, w: size.w, h: size.h };
      }

      // Other sections: snap to tuned defaults so auto-fit has visible effect.
      const size = getDefaultSectionSize(section.type);
      return { ...section, h: size.h };
    });

    await saveLayout(updated);
    setIsAutoFitting(false);
  }

  function updateSectionData(sectionId: string, data: Record<string, unknown>, newTitle?: string) {
    saveLayout(
      layout.map((s) =>
        s.id === sectionId
          ? { ...s, data, ...(newTitle !== undefined ? { title: newTitle } : {}) }
          : s
      )
    );
  }

  function updateSectionTitle(sectionId: string, title: string) {
    saveLayout(
      layout.map((s) => (s.id === sectionId ? { ...s, title } : s))
    );
  }

  /* ───── Section renderers ───── */

  function renderSectionContent(section: LayoutSection) {
    const theme = getSectionTheme(section);
    switch (section.type) {
      case "recent-ratings":
        return renderRecentRatings(theme);
      case "favorite-tracks":
        return renderFavoriteTracks(theme);
      case "favorite-albums":
        return renderFavoriteAlbums(theme);
      case "vinyl":
        return (
          <VinylPlayer
            title={section.title}
            track={(section.data?.track as { spotify_track_id: string; track_name: string; artist_name: string; image_url: string | null; preview_url?: string | null }) || null}
            variant="vinyl"
            colors={(section.data?.colors as Record<string, string>) || undefined}
            isOwnProfile={isOwnProfile}
            canCustomize={canCustomizeSections}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            onSelectTrack={(track) => updateSectionData(section.id, { ...section.data, track })}
            onUpdateColors={(colors) => updateSectionData(section.id, { ...section.data, colors })}
            onUpdateTitle={(title) => updateSectionTitle(section.id, title)}
          />
        );
      case "cd":
        return (
          <VinylPlayer
            title={section.title}
            track={(section.data?.track as { spotify_track_id: string; track_name: string; artist_name: string; image_url: string | null; preview_url?: string | null }) || null}
            variant="cd"
            colors={(section.data?.colors as Record<string, string>) || undefined}
            isOwnProfile={isOwnProfile}
            canCustomize={canCustomizeSections}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            onSelectTrack={(track) => updateSectionData(section.id, { ...section.data, track })}
            onUpdateColors={(colors) => updateSectionData(section.id, { ...section.data, colors })}
            onUpdateTitle={(title) => updateSectionTitle(section.id, title)}
          />
        );
      case "strollman":
        return (
          <WalkmanPlayer
            title={section.title}
            track={(section.data?.track as { spotify_track_id: string; track_name: string; artist_name: string; image_url: string | null; preview_url?: string | null }) || null}
            colors={(section.data?.colors as Record<string, string>) || undefined}
            isOwnProfile={isOwnProfile}
            canCustomize={canCustomizeSections}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            onSelectTrack={(track) => updateSectionData(section.id, { ...section.data, track })}
            onUpdateColors={(colors) => updateSectionData(section.id, { ...section.data, colors })}
            onUpdateTitle={(title) => updateSectionTitle(section.id, title)}
          />
        );
      case "text":
        return (
          <TextSection
            title={section.title}
            content={(section.data?.content as string) || ""}
            isOwnProfile={isOwnProfile}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            accentTextColor={theme.accentTextColor}
            onSave={(title, content) => {
              const size = getDynamicTextSectionSize(title, content);
              saveLayout(
                layout.map((s) =>
                  s.id === section.id
                    ? { ...s, title, data: { content }, w: size.w, h: size.h }
                    : s
                )
              );
            }}
          />
        );
      case "custom-playlist":
        return (
          <CustomPlaylistSection
            title={section.title}
            tracks={(section.data?.tracks as { spotify_track_id: string; track_name: string; artist_name: string; image_url: string | null }[]) || []}
            isOwnProfile={isOwnProfile}
            canCustomize={canCustomizeSections}
            accentTextColor={theme.accentTextColor}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            innerBackgroundColor={hexToRgba(theme.innerBgColor, theme.innerBgOpacity)}
            onUpdateTitle={(title) => updateSectionTitle(section.id, title)}
            onAddTrack={(track) => {
              const tracks = [...((section.data?.tracks as unknown[]) || []), track];
              updateSectionData(section.id, { ...section.data, tracks });
            }}
            onRemoveTrack={(spotifyTrackId) => {
              const tracks = ((section.data?.tracks as { spotify_track_id: string }[]) || []).filter(
                (t) => t.spotify_track_id !== spotifyTrackId
              );
              updateSectionData(section.id, { ...section.data, tracks });
            }}
          />
        );
      case "concert-ticket":
        return (
          <ConcertTicketStubSection
            title={section.title}
            data={
              (section.data as {
                artist?: string;
                tourName?: string;
                albumName?: string;
                venue?: string;
                city?: string;
                date?: string;
                year?: string;
                row?: string;
                section?: string;
                seat?: string;
                notes?: string;
                borderPrimary?: string;
                borderSecondary?: string;
              }) || {}
            }
            isOwnProfile={isOwnProfile}
            canCustomize={canCustomizeSections}
            accentTextColor={theme.accentTextColor}
            outerBackgroundColor={hexToRgba(theme.outerBgColor, theme.outerBgOpacity)}
            innerBackgroundColor={hexToRgba(theme.innerBgColor, theme.innerBgOpacity)}
            onSave={(title, data) => {
              updateSectionData(section.id, { ...section.data, ...data }, title);
            }}
          />
        );
      default:
        return null;
    }
  }

  function renderRecentRatings(theme: SectionTheme) {
    return (
      <section className="rounded-2xl p-5 shadow-lg" style={{ backgroundColor: hexToRgba(theme.outerBgColor, theme.outerBgOpacity) }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: theme.accentTextColor }}>Recent Ratings</h2>
          <div className="flex gap-2">
            {canCustomizeSections && (
              <Link href="/rate" className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
                Rate
              </Link>
            )}
            <Link href={`/profile/${profile!.username}/ratings`} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
              View All
            </Link>
          </div>
        </div>
        <div className="space-y-2">
          {recentRatings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-400">No song ratings yet.</div>
          ) : (
            recentRatings.map((rating) => (
              <div key={rating.id} className="rounded-lg p-3 flex flex-col" style={{ backgroundColor: hexToRgba(theme.innerBgColor, theme.innerBgOpacity) }}>
                {editingRatingId === rating.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {rating.image_url ? (<img src={rating.image_url} alt={rating.track_name} className="h-12 w-12 rounded object-cover" />) : (<div className="h-12 w-12 rounded bg-zinc-700" />)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{rating.track_name}</p>
                        <p className="truncate text-xs text-zinc-400">{rating.artist_name}</p>
                      </div>
                    </div>
                    <select value={editRatingValue} onChange={(e) => setEditRatingValue(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white outline-none">
                      {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (<option key={v} value={v}>{v} — {formatNotesText(v)}</option>))}
                    </select>
                    <textarea value={editReviewValue} onChange={(e) => setEditReviewValue(e.target.value)} rows={2} placeholder="Review (optional)" className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white outline-none" />
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveRating(rating.id)} disabled={ratingBusy !== ""} className="rounded bg-green-500 px-2 py-1 text-xs font-semibold text-black hover:bg-green-600 disabled:opacity-50">Save</button>
                      <button onClick={cancelEditRating} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {rating.image_url ? (<img src={rating.image_url} alt={rating.track_name} className="h-12 w-12 rounded object-cover" />) : (<div className="h-12 w-12 rounded bg-zinc-700" />)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{rating.track_name}</p>
                        <p className="truncate text-xs" style={{ color: theme.accentTextColor }}>{rating.artist_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold" style={{ color: theme.accentTextColor }}><NoteRating rating={rating.rating} /></p>
                        <p className="text-xs" style={{ color: theme.accentTextColor }}>{rating.rating}/5</p>
                      </div>
                    </div>
                    {rating.review && (<p className="mt-1.5 truncate text-xs italic" style={{ color: theme.accentTextColor }}>&ldquo;{rating.review}&rdquo;</p>)}
                    <MusicReviewCard
                      rating={rating.rating}
                      review={rating.review}
                      accentColor={theme.accentTextColor}
                      compact
                    />
                    {canCustomizeSections && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button onClick={() => startEditRating(rating)} disabled={ratingBusy !== ""} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">✎</button>
                        <button onClick={() => handleDeleteRating(rating.id)} disabled={ratingBusy !== ""} className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50">✕</button>
                        {rating.spotify_track_id && (<a href={`https://open.spotify.com/track/${rating.spotify_track_id}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>)}
                      </div>
                    )}
                    {!canCustomizeSections && rating.spotify_track_id && (
                      <div className="mt-2 flex justify-end">
                        <a href={`https://open.spotify.com/track/${rating.spotify_track_id}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderFavoriteTracks(theme: SectionTheme) {
    return (
      <section className="h-full rounded-2xl p-5 shadow-lg" style={{ backgroundColor: hexToRgba(theme.outerBgColor, theme.outerBgOpacity) }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: theme.accentTextColor }}>Favorite Tracks</h2>
          {canCustomizeSections && (
            <button onClick={() => { setShowTrackForm((prev) => !prev); setTrackMessage(""); setTrackResults([]); setSelectedTrack(null); setTrackSearch(""); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
              {showTrackForm ? "Close" : "Add Track"}
            </button>
          )}
        </div>
        {canCustomizeSections && showTrackForm && (
          <div className="mb-6 space-y-4">
            <form className="space-y-3" onSubmit={handleTrackSearch}>
              <input type="text" placeholder="Search for a track" value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500" />
              <button type="submit" disabled={trackSearchLoading} className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60">{trackSearchLoading ? "Searching..." : "Search Tracks"}</button>
            </form>
            {trackResults.length > 0 && (
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                {trackResults.map((track) => (
                  <button key={track.spotify_track_id} type="button" onClick={() => setSelectedTrack(track)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${selectedTrack?.spotify_track_id === track.spotify_track_id ? "bg-green-500/20 ring-1 ring-green-500" : "bg-zinc-800/60 hover:bg-zinc-800"}`}>
                    {track.image_url ? (<img src={track.image_url} alt={track.track_name} className="h-16 w-16 rounded-lg object-cover" />) : (<div className="h-16 w-16 rounded-lg bg-zinc-700" />)}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{track.track_name}</p>
                      <p className="truncate text-sm text-zinc-400">{track.artist_name}</p>
                      {track.album_name && (<p className="truncate text-xs text-zinc-500">{track.album_name}</p>)}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleAddFavoriteTrack} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              {selectedTrack ? (
                <div className="flex items-center gap-3 rounded-lg bg-zinc-800/70 p-3">
                  {selectedTrack.image_url ? (<img src={selectedTrack.image_url} alt={selectedTrack.track_name} className="h-16 w-16 rounded-lg object-cover" />) : (<div className="h-16 w-16 rounded-lg bg-zinc-700" />)}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{selectedTrack.track_name}</p>
                    <p className="truncate text-sm text-zinc-400">{selectedTrack.artist_name}</p>
                    {selectedTrack.album_name && (<p className="truncate text-xs text-zinc-500">{selectedTrack.album_name}</p>)}
                  </div>
                </div>
              ) : (<p className="text-sm text-zinc-400">Select a track above first.</p>)}
              <select value={trackPosition} onChange={(e) => setTrackPosition(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500">
                <option value="1">Position #1</option><option value="2">Position #2</option><option value="3">Position #3</option><option value="4">Position #4</option><option value="5">Position #5</option>
              </select>
              <button type="submit" disabled={trackSubmitting} className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60">{trackSubmitting ? "Saving..." : "Save Favorite Track"}</button>
              {trackMessage && (<p className="text-sm text-zinc-300">{trackMessage}</p>)}
            </form>
          </div>
        )}
        <div className="space-y-2">
          {favoriteTracks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-400">No favorite tracks yet.</div>
          ) : (
            favoriteTracks.map((track) => (
              <div key={track.id} className="rounded-lg p-3 min-h-[7rem]" style={{ backgroundColor: hexToRgba(theme.innerBgColor, theme.innerBgOpacity) }}>
                <div className="flex items-center gap-3">
                  {track.image_url ? (<img src={track.image_url} alt={track.track_name} className="h-12 w-12 rounded object-cover" />) : (<div className="h-12 w-12 rounded bg-zinc-700" />)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{track.track_name}</p>
                    <p className="truncate text-xs" style={{ color: theme.accentTextColor }}>{track.artist_name}</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black" style={{ backgroundColor: theme.accentTextColor }}>{track.position}</div>
                </div>
                <p className="mt-1.5 text-xs text-transparent">&nbsp;</p>
                {canCustomizeSections && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button onClick={() => moveTrackUp(track)} disabled={track.position === 1 || busyAction !== ""} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">↑</button>
                    <button onClick={() => moveTrackDown(track)} disabled={track.position === 5 || busyAction !== ""} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">↓</button>
                    <button onClick={() => handleDeleteFavoriteTrack(track.id)} disabled={busyAction !== ""} className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50">✕</button>
                    {track.spotify_track_id && (<a href={`https://open.spotify.com/track/${track.spotify_track_id}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>)}
                  </div>
                )}
                {!canCustomizeSections && track.spotify_track_id && (
                  <div className="mt-2 flex justify-end">
                    <a href={`https://open.spotify.com/track/${track.spotify_track_id}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderFavoriteAlbums(theme: SectionTheme) {
    return (
      <section className="h-full rounded-2xl p-5 shadow-lg" style={{ backgroundColor: hexToRgba(theme.outerBgColor, theme.outerBgOpacity) }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: theme.accentTextColor }}>Favorite Albums</h2>
          {canCustomizeSections && (
            <button onClick={() => { setShowAlbumForm((prev) => !prev); setAlbumMessage(""); setAlbumResults([]); setSelectedAlbum(null); setAlbumSearch(""); }} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
              {showAlbumForm ? "Close" : "Add Album"}
            </button>
          )}
        </div>
        {canCustomizeSections && showAlbumForm && (
          <div className="mb-6 space-y-4">
            <form className="space-y-3" onSubmit={handleAlbumSearch}>
              <input type="text" placeholder="Search for an album" value={albumSearch} onChange={(e) => setAlbumSearch(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500" />
              <button type="submit" disabled={albumSearchLoading} className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60">{albumSearchLoading ? "Searching..." : "Search Albums"}</button>
            </form>
            {albumResults.length > 0 && (
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                {albumResults.map((album) => (
                  <button key={album.spotify_album_id} type="button" onClick={() => setSelectedAlbum(album)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${selectedAlbum?.spotify_album_id === album.spotify_album_id ? "bg-green-500/20 ring-1 ring-green-500" : "bg-zinc-800/60 hover:bg-zinc-800"}`}>
                    {album.image_url ? (<img src={album.image_url} alt={album.album_name} className="h-16 w-16 rounded-lg object-cover" />) : (<div className="h-16 w-16 rounded-lg bg-zinc-700" />)}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{album.album_name}</p>
                      <p className="truncate text-sm text-zinc-400">{album.artist_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleAddFavoriteAlbum} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              {selectedAlbum ? (
                <div className="flex items-center gap-3 rounded-lg bg-zinc-800/70 p-3">
                  {selectedAlbum.image_url ? (<img src={selectedAlbum.image_url} alt={selectedAlbum.album_name} className="h-16 w-16 rounded-lg object-cover" />) : (<div className="h-16 w-16 rounded-lg bg-zinc-700" />)}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{selectedAlbum.album_name}</p>
                    <p className="truncate text-sm text-zinc-400">{selectedAlbum.artist_name}</p>
                  </div>
                </div>
              ) : (<p className="text-sm text-zinc-400">Select an album above first.</p>)}
              <select value={albumPosition} onChange={(e) => setAlbumPosition(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-500">
                <option value="1">Position #1</option><option value="2">Position #2</option><option value="3">Position #3</option><option value="4">Position #4</option><option value="5">Position #5</option>
              </select>
              <button type="submit" disabled={albumSubmitting} className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-600 disabled:opacity-60">{albumSubmitting ? "Saving..." : "Save Favorite Album"}</button>
              {albumMessage && (<p className="text-sm text-zinc-300">{albumMessage}</p>)}
            </form>
          </div>
        )}
        <div className="space-y-2">
          {favoriteAlbums.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-400">No favorite albums yet.</div>
          ) : (
            favoriteAlbums.map((album) => (
              <div key={album.id} className="rounded-lg p-3 min-h-[7rem]" style={{ backgroundColor: hexToRgba(theme.innerBgColor, theme.innerBgOpacity) }}>
                <div className="flex items-center gap-3">
                  {album.image_url ? (<img src={album.image_url} alt={album.album_name} className="h-12 w-12 rounded object-cover" />) : (<div className="h-12 w-12 rounded bg-zinc-700" />)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{album.album_name}</p>
                    <p className="truncate text-xs" style={{ color: theme.accentTextColor }}>{album.artist_name}</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black" style={{ backgroundColor: theme.accentTextColor }}>{album.position}</div>
                </div>
                <p className="mt-1.5 text-xs text-transparent">&nbsp;</p>
                {canCustomizeSections && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button onClick={() => moveAlbumUp(album)} disabled={album.position === 1 || busyAction !== ""} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">↑</button>
                    <button onClick={() => moveAlbumDown(album)} disabled={album.position === 5 || busyAction !== ""} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">↓</button>
                    <button onClick={() => handleDeleteFavoriteAlbum(album.id)} disabled={busyAction !== ""} className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50">✕</button>
                    {album.spotify_album_id && (<a href={`https://open.spotify.com/album/${album.spotify_album_id}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>)}
                  </div>
                )}
                {!canCustomizeSections && album.spotify_album_id && (
                  <div className="mt-2 flex justify-end">
                    <a href={`https://open.spotify.com/album/${album.spotify_album_id}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: theme.accentTextColor }}>Listen on Spotify</a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return <MusicNotesLoader color={noteColor} />;
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center px-6">
        <div className="rounded-2xl bg-zinc-900 p-8 text-center shadow-lg">
          <h1 className="text-3xl font-bold">Profile not found</h1>
          <p className="mt-3 text-zinc-400">
            We couldn&apos;t find that SoundBored user.
          </p>
        </div>
      </main>
    );
  }

  function handlePanelMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, input, textarea, select")) return;
    setIsDraggingPanel(true);
    setDragOffset({
      x: e.clientX - panelX,
      y: e.clientY - panelY,
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-6 py-8 text-white">
      <div className="flex w-full flex-col gap-6">

        {/* Admin action strip — only shown to admins viewing someone else's profile */}
        {isCurrentUserAdmin && !isOwnProfile && profile && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-900 bg-blue-950/30 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">🛡️ Admin</span>
            <button
              onClick={handleAdminToggleAdmin}
              disabled={adminActionBusy}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
                profile.is_admin
                  ? "bg-blue-800 text-white hover:bg-blue-700"
                  : "bg-purple-800 text-white hover:bg-purple-700"
              }`}
            >
              {adminActionBusy ? "Working..." : profile.is_admin ? "Remove Admin" : "Make Admin"}
            </button>
            <button
              onClick={handleAdminBanToggle}
              disabled={adminActionBusy}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
                profile.is_banned
                  ? "bg-green-700 text-white hover:bg-green-600"
                  : "bg-yellow-700 text-white hover:bg-yellow-600"
              }`}
            >
              {adminActionBusy ? "Working..." : profile.is_banned ? "Unban User" : "Ban User"}
            </button>
            <button
              onClick={handleAdminDelete}
              disabled={adminActionBusy}
              className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {adminActionBusy ? "Working..." : "Delete User"}
            </button>
            {adminActionMessage && <span className="text-sm text-zinc-300">{adminActionMessage}</span>}
          </div>
        )}

        <div className="panel-surface relative rounded-[28px] p-8 shadow-lg" style={{ backgroundColor: hexToRgba(profileBoxBgColor, profileBoxBgOpacity) }}>
          {isOwnProfile && (
            <div className="relative z-10 mb-6 flex items-center justify-end gap-2">
              <div className="mr-auto inline-flex rounded-full border border-white/10 bg-zinc-800 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-400">
                SoundBored Profile
              </div>
              {isEditMode && (
                <button
                  onClick={() => setShowStickerToolbar((prev) => !prev)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    showStickerToolbar
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "border border-purple-600 text-purple-300 hover:bg-purple-900/30"
                  }`}
                >
                  🎨 Stickers
                </button>
              )}
              <button
                onClick={() => {
                  if (isEditMode) {
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveLayout(layout);
                  }
                  setIsEditMode(!isEditMode);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isEditMode
                    ? "bg-green-500 text-black hover:bg-green-600"
                    : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {isEditMode ? "Done Customizing" : "Customize Profile"}
              </button>
            </div>
          )}

          {isOwnProfile && isEditMode && createPortal(
            (
              <>
                <div
                  onMouseDown={handlePanelMouseDown}
                  className="fixed z-[9999] w-96 rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl backdrop-blur"
                style={{
                  left: `${panelX}px`,
                  top: `${panelY}px`,
                  cursor: isDraggingPanel ? "grabbing" : "grab",
                  maxHeight: "90vh",
                }}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-700">
                  <h3 className="text-sm font-semibold text-zinc-300">Customize</h3>
                  <div className="text-xs text-zinc-500 cursor-grab active:cursor-grabbing">☰</div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setShowAddSection(true)}
                    className="h-9 rounded-lg border border-green-500 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/10"
                  >
                    + Add Section
                  </button>
                  <button
                    onClick={handleAutoFitTextSections}
                    disabled={isAutoFitting}
                    className="h-9 rounded-lg border border-green-500 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/10 disabled:opacity-60"
                    title="Auto-fit section heights"
                  >
                    {isAutoFitting ? "Fitting..." : "Auto-fit Boxes"}
                  </button>

                  <div className="border-t border-zinc-700 px-2.5 py-3">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-300">Notes</p>
                    <p className="mb-2 text-[10px] text-zinc-500">Falling background notes</p>
                    <div className="flex items-center gap-2">
                      <input
                        id="note-color"
                        type="color"
                        value={noteColor}
                        onChange={(e) => setNoteColor(e.target.value)}
                        className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                        title="Background note color"
                      />
                      <button
                        onClick={handleSaveNoteColor}
                        disabled={noteColorSaving}
                        className="rounded border border-green-500 px-2 py-1 text-xs font-semibold text-green-400 hover:bg-green-500/10 disabled:opacity-60"
                      >
                        {noteColorSaving ? "..." : "Save"}
                      </button>
                    </div>
                    {noteColorMessage && <p className="mt-1 text-[11px] text-zinc-400">{noteColorMessage}</p>}
                  </div>

                  <div className="border-t border-zinc-700 px-2.5 py-3">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-300">Accent Text</p>
                    <p className="mb-2 text-[10px] text-zinc-500">Board headings and rating accents</p>
                    <div className="flex items-center gap-2">
                      <input
                        id="accent-text-color"
                        type="color"
                        value={accentTextColor}
                        onChange={(e) => setAccentTextColor(e.target.value)}
                        className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                        title="Accent text color"
                      />
                      <button
                        onClick={handleSaveAccentTextColor}
                        disabled={accentTextSaving}
                        className="rounded border border-green-500 px-2 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/10 disabled:opacity-60"
                      >
                        {accentTextSaving ? "..." : "Save"}
                      </button>
                    </div>
                    {accentTextMessage && <p className="mt-1 text-[11px] text-zinc-400">{accentTextMessage}</p>}
                  </div>

                  <div className="col-span-2 border-t border-zinc-700 px-2.5 py-3">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-300">Profile Box & Pattern</p>
                    <p className="mb-2 text-[10px] text-zinc-500">Box color/opacity + top-card pattern (bio stays clean)</p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[84px_minmax(0,1fr)_46px] items-center gap-2">
                        <label className="text-[11px] text-zinc-400">Box Color</label>
                        <div className="h-px" />
                        <div className="flex justify-end">
                          <input
                            type="color"
                            value={profileBoxBgColor}
                            onChange={(e) => setProfileBoxBgColor(e.target.value)}
                            className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                            title="Profile box background color"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[84px_minmax(0,1fr)_46px] items-center gap-2">
                        <label className="text-[11px] text-zinc-400">Opacity</label>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          value={Math.round(profileBoxBgOpacity * 100)}
                          onChange={(e) => setProfileBoxBgOpacity(Number(e.target.value) / 100)}
                          title="Profile box background opacity"
                        />
                        <span className="text-right text-xs text-zinc-400">{Math.round(profileBoxBgOpacity * 100)}%</span>
                      </div>

                      <div className="grid grid-cols-[84px_minmax(0,1fr)_46px] items-center gap-2">
                        <label htmlFor="profile-card-pattern" className="text-[11px] text-zinc-400">Pattern</label>
                        <select
                          id="profile-card-pattern"
                          value={profileCardPattern}
                          onChange={(e) => setProfileCardPattern(e.target.value as ProfileCardPattern)}
                          className="min-w-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white outline-none"
                        >
                          <option value="none">None</option>
                          <option value="dots">Dots</option>
                          <option value="grid">Grid</option>
                          <option value="diagonal">Diagonal</option>
                          <option value="waves">Waves</option>
                          <option value="crosshatch">Crosshatch</option>
                        </select>
                        <div className="flex justify-end">
                          <input
                            type="color"
                            value={profileCardPatternColor}
                            onChange={(e) => setProfileCardPatternColor(e.target.value)}
                            className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                            title="Profile card pattern color"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[84px_minmax(0,1fr)_46px] items-center gap-2">
                        <label className="text-[11px] text-zinc-400">Pattern %</label>
                        <input
                          type="range"
                          min={0}
                          max={60}
                          value={Math.round(profileCardPatternOpacity * 100)}
                          onChange={(e) => setProfileCardPatternOpacity(Number(e.target.value) / 100)}
                          title="Profile card pattern opacity"
                        />
                        <span className="text-right text-xs text-zinc-400">{Math.round(profileCardPatternOpacity * 100)}%</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <div
                        className="mr-auto h-4 w-4 rounded border border-zinc-600"
                        style={{ backgroundColor: hexToRgba(profileBoxBgColor, profileBoxBgOpacity) }}
                        title="Profile box preview"
                      />
                      <button
                        onClick={handleSaveProfileCardPattern}
                        disabled={profilePatternSaving}
                        className="h-8 rounded border border-green-500 px-2 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/10 disabled:opacity-60"
                      >
                        {profilePatternSaving ? "Saving..." : "Save Pattern"}
                      </button>
                    </div>
                    {profilePatternMessage && <p className="mt-1 text-[11px] text-zinc-400">{profilePatternMessage}</p>}
                  </div>

                  <div className="col-span-2 border-t border-zinc-700 px-2.5 py-3">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-300">Box Styles</p>
                    <p className="mb-2 text-[10px] text-zinc-500">Customize selected section or all sections</p>

                    <div className="grid grid-cols-[84px_minmax(0,1fr)_46px] items-center gap-2">
                      <label htmlFor="box-style-target" className="text-[11px] text-zinc-400">Target</label>
                      <select
                        id="box-style-target"
                        value={styleTargetSectionId}
                        onChange={(e) => {
                          setStyleTargetSectionId(e.target.value);
                          setBoxStyleMessage("");
                        }}
                        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white outline-none"
                      >
                        <option value="all">All Boxes</option>
                        {layout.map((section) => (
                          <option key={section.id} value={section.id}>{section.title}</option>
                        ))}
                      </select>
                      <div className="flex justify-end">
                        <input
                          type="color"
                          value={boxAccentDraft}
                          onChange={(e) => {
                            setBoxAccentDraft(e.target.value);
                            setBoxStyleMessage("");
                          }}
                          className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                          title="Box accent color"
                        />
                      </div>

                      <label className="text-[11px] text-zinc-400">Accent</label>
                      <div className="h-px" />
                      <span className="text-right text-xs text-zinc-500">&nbsp;</span>

                      <label className="text-[11px] text-zinc-400">Outer Color</label>
                      <div className="h-px" />
                      <div className="flex justify-end">
                        <input
                          type="color"
                          value={boxOuterBgColorDraft}
                          onChange={(e) => {
                            setBoxOuterBgColorDraft(e.target.value);
                            setBoxStyleMessage("");
                          }}
                          className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                          title="Outer panel color"
                        />
                      </div>

                      <label className="text-[11px] text-zinc-400">Outer Opacity</label>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(boxOuterBgOpacityDraft * 100)}
                        onChange={(e) => {
                          setBoxOuterBgOpacityDraft(Number(e.target.value) / 100);
                          setBoxStyleMessage("");
                        }}
                        title="Panel opacity"
                      />
                      <span className="text-right text-xs text-zinc-400">{Math.round(boxOuterBgOpacityDraft * 100)}%</span>

                      <label className="text-[11px] text-zinc-400">Inner Color</label>
                      <div className="h-px" />
                      <div className="flex justify-end">
                        <input
                          type="color"
                          value={boxInnerBgColorDraft}
                          onChange={(e) => {
                            setBoxInnerBgColorDraft(e.target.value);
                            setBoxStyleMessage("");
                          }}
                          className="h-7 w-7 cursor-pointer rounded border border-zinc-600 bg-transparent"
                          title="Inner card/button color"
                        />
                      </div>

                      <label className="text-[11px] text-zinc-400">Inner Opacity</label>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={Math.round(boxInnerBgOpacityDraft * 100)}
                        onChange={(e) => {
                          setBoxInnerBgOpacityDraft(Number(e.target.value) / 100);
                          setBoxStyleMessage("");
                        }}
                        title="Inner card/button opacity"
                      />
                      <span className="text-right text-xs text-zinc-400">{Math.round(boxInnerBgOpacityDraft * 100)}%</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (styleTargetSectionId === "all") {
                            applyBoxStyleToAllSections();
                            return;
                          }
                          applyBoxStyleToSection(styleTargetSectionId);
                        }}
                        className="h-8 rounded border border-green-500 px-2 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/10"
                      >
                        Apply Selected
                      </button>
                      <button
                        onClick={applyBoxStyleToAllSections}
                        className="h-8 rounded border border-zinc-600 px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                      >
                        Apply All
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[11px] text-zinc-500">Preview</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-400">Outer</span>
                        <div
                          className="h-4 w-4 rounded border border-zinc-600"
                          style={{ backgroundColor: hexToRgba(boxOuterBgColorDraft, boxOuterBgOpacityDraft) }}
                          title="Outer panel preview"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-400">Inner</span>
                        <div
                          className="h-4 w-4 rounded border border-zinc-600"
                          style={{ backgroundColor: hexToRgba(boxInnerBgColorDraft, boxInnerBgOpacityDraft) }}
                          title="Inner card preview"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-400">Accent</span>
                        <div
                          className="h-4 w-4 rounded-full border border-zinc-600"
                          style={{ backgroundColor: boxAccentDraft }}
                          title="Accent preview"
                        />
                      </div>
                    </div>
                    {boxStyleMessage && <p className="mt-1 text-[11px] text-zinc-400">{boxStyleMessage}</p>}
                  </div>
              </div>
              </div>

              </>
            ),
            document.body
          )}
          <div className="relative z-10">
            {profileCardPattern !== "none" && (
              <div
                className="absolute inset-0 pointer-events-none rounded-[24px] -z-10"
                style={getProfileCardPatternStyle(profileCardPattern, profileCardPatternColor, profileCardPatternOpacity)}
              />
            )}
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-24 w-24 rounded-full border border-white/15 object-cover shadow-[0_16px_30px_rgba(0,0,0,0.35)]"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-3xl font-bold shadow-[0_16px_30px_rgba(0,0,0,0.35)]" style={{ color: accentTextColor }}>
                    {profile.display_name?.[0]?.toUpperCase() ||
                      profile.username?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                )}
                {isOwnProfile && (
                  <label
                    className={`absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-800 ${
                      avatarUploading ? "opacity-60" : ""
                    }`}
                    title={avatarUploading ? "Uploading..." : "Change profile picture"}
                  >
                    {avatarUploading ? (
                      <span className="text-[10px] font-semibold">...</span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    )}
                    <span className="sr-only">Change profile picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={handleAvatarUpload}
                    />
                  </label>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {isEditingDisplayName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Display name"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveDisplayName}
                      disabled={displayNameSaving}
                      className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-green-600 disabled:opacity-60"
                    >
                      {displayNameSaving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => setIsEditingDisplayName(false)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                      {profile.display_name || profile.username}
                    </h1>
                    {/* Shield badge — visible to everyone when this user is an admin */}
                    {profile.is_admin && (
                      <span
                        title="Admin"
                        className="text-blue-400 text-2xl"
                        aria-label="Admin"
                      >
                        🛡️
                      </span>
                    )}
                    {isOwnProfile && (
                      <button
                        onClick={() => {
                          setDisplayNameDraft(profile.display_name || "");
                          setIsEditingDisplayName(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-200"
                        title="Edit display name"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
                <p className="mt-1 text-zinc-400">@{profile.username}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setShowFollowers(!showFollowers);
                      setShowFollowing(false);
                    }}
                    className="cursor-pointer rounded-full border border-white/10 bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
                  >
                    <span className="text-2xl font-bold text-white">
                      {followerCount}
                    </span>{" "}
                    <span className="text-lg font-bold text-zinc-300">Followers</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowFollowing(!showFollowing);
                      setShowFollowers(false);
                    }}
                    className="cursor-pointer rounded-full border border-white/10 bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
                  >
                    <span className="text-2xl font-bold text-white">
                      {followingCount}
                    </span>{" "}
                    <span className="text-lg font-bold text-zinc-300">Following</span>
                  </button>
                  {!isOwnProfile && currentUserId && (
                    <button
                      onClick={handleToggleFollow}
                      disabled={followBusy}
                      className={`ml-auto rounded-lg px-4 py-2 font-semibold transition ${
                        isFollowing
                          ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                          : "bg-green-500 text-black hover:bg-green-600"
                      } disabled:opacity-60`}
                    >
                      {followBusy ? "Working..." : isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                {showFollowers && followers.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Followers</h3>
                    {followers.map((follower) => (
                      <Link
                        key={follower.id}
                        href={`/profile/${follower.username}`}
                        className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
                      >
                        {follower.avatar_url ? (
                          <img
                            src={follower.avatar_url}
                            alt={follower.username}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-green-400">
                            {follower.display_name?.[0]?.toUpperCase() || follower.username?.[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {follower.display_name || follower.username}
                          </p>
                          <p className="truncate text-xs text-zinc-400">@{follower.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {showFollowing && followingUsers.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Following</h3>
                    {followingUsers.map((user) => (
                      <Link
                        key={user.id}
                        href={`/profile/${user.username}`}
                        className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2 transition hover:bg-zinc-700"
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-green-400">
                            {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {user.display_name || user.username}
                          </p>
                          <p className="truncate text-xs text-zinc-400">@{user.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>

          {(isOwnProfile || profile.bio?.trim()) && (
            <div className="relative z-10 mt-6 border-t pt-6" style={{ borderTopColor: profileCardPatternColor }}>
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
                  ✎ Edit
                </button>
              )}
            </div>

            {!isEditingBio ? (
              <p className="max-w-3xl text-[15px] leading-7 text-zinc-300">
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
          )}
        </div>

        {showAddSection && (
          <AddSectionModal
            existingTypes={layout.map((s) => s.type)}
            onAdd={handleAddSection}
            onClose={() => setShowAddSection(false)}
          />
        )}
      </div>

      {/* Grid layout — full-width, outside the constrained container */}
      <div
        className={`relative left-1/2 w-screen -translate-x-1/2 ${isEditMode ? "profile-grid-overlay" : ""}`}
      >
        {/* Sticker layer sits absolutely over the grid; pointer-events:none in view mode */}
        <StickerLayer
          stickers={placedStickers}
          customStickers={userCustomStickers}
          isEditMode={isEditMode && isOwnProfile}
          showToolbar={showStickerToolbar}
          userId={currentUserId}
          onChange={handleStickersChange}
          onUploadSticker={handleUploadSticker}
        />
        <ResponsiveGridLayout
          className="layout"
          width={viewportWidth}
          layouts={{
            lg: layout.map((s) => ({
              i: s.id,
              x: s.x,
              y: s.y,
              w: s.w,
              h: s.h,
              minW: 1,
              minH: 2,
            })),
          }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 12 }}
          rowHeight={GRID_ROW_HEIGHT}
          dragConfig={{ enabled: isEditMode, handle: ".grid-drag-handle" }}
          resizeConfig={{ enabled: isEditMode }}
          compactor={verticalCompactor}
          margin={[8, GRID_MARGIN_Y]}
          onLayoutChange={(rglLayout) => handleLayoutChange(rglLayout)}
        >
          {layout.map((section) => (
            <div key={section.id} className="relative flex flex-col rounded-xl bg-zinc-900">
              {isEditMode && (
                <div className="flex items-center gap-1 bg-zinc-800/80 px-2 py-1">
                  <button
                    className="grid-drag-handle cursor-grab rounded p-1 text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    ⠿
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => handleRemoveSection(section.id)}
                      className="rounded border border-red-700 px-2 py-0.5 text-xs text-red-300 hover:bg-red-950/40"
                      title="Remove section"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              <div className="p-3">
                {renderSectionContent(section)}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </main>
  );
}
