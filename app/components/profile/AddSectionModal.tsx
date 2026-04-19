"use client";

import { createPortal } from "react-dom";

/**
 * AddSectionModal
 *
 * Full-screen overlay that lets the profile owner pick a new section type
 * to add to their profile grid.
 *
 * Props:
 *  existingTypes — array of section type strings already on the profile,
 *                  used to disable options for sections marked `unique: true`
 *  onAdd         — called with (type, label) when the user picks a section
 *  onClose       — called when the user dismisses the modal (backdrop click or ✕)
 *
 * Unique sections (e.g. recent-ratings, favorite-tracks) can only appear once.
 * Non-unique sections (vinyl, text, custom-playlist, etc.) can be added multiple times.
 */

const SECTION_TYPES = [
  {
    type: "recent-ratings",
    label: "Recent Ratings",
    description: "Shows your latest song ratings",
    icon: "♪",
    unique: true,
  },
  {
    type: "favorite-tracks",
    label: "Favorite Tracks",
    description: "Display your top 5 tracks",
    icon: "♫",
    unique: true,
  },
  {
    type: "favorite-albums",
    label: "Favorite Albums",
    description: "Display your top 5 albums",
    icon: "◉",
    unique: true,
  },
  {
    type: "vinyl",
    label: "Record Player",
    description: "A spinning vinyl record with a song",
    icon: "◎",
    unique: false,
  },
  {
    type: "cd",
    label: "CD Player",
    description: "A spinning CD disc with a song",
    icon: "💿",
    unique: false,
  },
  {
    type: "custom-playlist",
    label: "Custom Playlist",
    description: "Create a custom list of songs",
    icon: "≡",
    unique: false,
  },
  {
    type: "concert-ticket",
    label: "Concert Ticket Stub",
    description: "Share a live show ticket with artist, tour, and date",
    icon: "▦",
    unique: false,
  },
  {
    type: "text",
    label: "Text Box",
    description: "Add custom text content",
    icon: "T",
    unique: false,
  },
  {
    type: "strollman",
    label: "Strollman",
    description: "A retro cassette walkman with spinning reels and a song",
    icon: "📼",
    unique: false,
  },
];

type Props = {
  existingTypes: string[];
  onAdd: (type: string, title: string) => void;
  onClose: () => void;
};

export default function AddSectionModal({
  existingTypes,
  onAdd,
  onClose,
}: Props) {
  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add Section</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {SECTION_TYPES.map((section) => {
            const alreadyExists =
              section.unique && existingTypes.includes(section.type);

            return (
              <button
                key={section.type}
                onClick={() => {
                  if (!alreadyExists) {
                    onAdd(section.type, section.label);
                    onClose();
                  }
                }}
                disabled={alreadyExists}
                className={`flex w-full items-center gap-4 rounded-xl p-4 text-left transition ${
                  alreadyExists
                    ? "cursor-not-allowed bg-zinc-800/30 opacity-40"
                    : "bg-zinc-800/60 hover:bg-zinc-800 hover:ring-1 hover:ring-green-500"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-700 text-2xl text-green-400">
                  {section.icon}
                </div>
                <div>
                  <p className="font-semibold text-white">{section.label}</p>
                  <p className="text-sm text-zinc-400">
                    {section.description}
                  </p>
                  {alreadyExists && (
                    <p className="text-xs text-zinc-500">
                      Already on your profile
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
