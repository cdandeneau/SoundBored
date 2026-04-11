"use client";

import { useMemo, useState } from "react";

type TicketStubData = {
  artist: string;
  tourName: string;
  albumName: string;
  venue: string;
  city: string;
  date: string;
  year: string;
  row: string;
  section: string;
  seat: string;
  notes: string;
  borderPrimary: string;
  borderSecondary: string;
};

const DEFAULT_BORDER_PRIMARY = "#e11d48";
const DEFAULT_BORDER_SECONDARY = "#9ca3af";

function safeHex(color?: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? (color as string) : DEFAULT_BORDER_PRIMARY;
}

type Props = {
  title: string;
  data: Partial<TicketStubData>;
  isOwnProfile: boolean;
  canCustomize: boolean;
  accentTextColor: string;
  outerBackgroundColor: string;
  innerBackgroundColor: string;
  onSave: (title: string, data: TicketStubData) => void;
};

function parseYear(date: string, fallback: string): string {
  if (!date) return fallback;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return fallback;
  return String(d.getUTCFullYear());
}

export default function ConcertTicketStubSection({
  title,
  data,
  isOwnProfile,
  canCustomize,
  accentTextColor,
  outerBackgroundColor,
  innerBackgroundColor,
  onSave,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title || "Concert Ticket Stub");
  const [draft, setDraft] = useState<TicketStubData>({
    artist: data.artist || "",
    tourName: data.tourName || "",
    albumName: data.albumName || "",
    venue: data.venue || "",
    city: data.city || "",
    date: data.date || "",
    year: data.year || "",
    row: data.row || "",
    section: data.section || "",
    seat: data.seat || "",
    notes: data.notes || "",
    borderPrimary: safeHex(data.borderPrimary),
    borderSecondary: /^#[0-9a-fA-F]{6}$/.test(data.borderSecondary || "")
      ? (data.borderSecondary as string)
      : DEFAULT_BORDER_SECONDARY,
  });

  const displayYear = useMemo(
    () => (draft.year || parseYear(draft.date, data.year || "")).trim(),
    [draft.date, draft.year, data.year]
  );

  const displayDate = useMemo(() => {
    if (!data.date) return "--/--/----";
    const parsed = new Date(data.date);
    if (Number.isNaN(parsed.getTime())) return data.date;
    return parsed.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
  }, [data.date]);

  const displayBorderPrimary = safeHex(data.borderPrimary);
  const displayBorderSecondary = /^#[0-9a-fA-F]{6}$/.test(data.borderSecondary || "")
    ? (data.borderSecondary as string)
    : DEFAULT_BORDER_SECONDARY;

  function handleChange<K extends keyof TicketStubData>(key: K, value: TicketStubData[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit() {
    setTitleDraft(title || "Concert Ticket Stub");
    setDraft({
      artist: data.artist || "",
      tourName: data.tourName || "",
      albumName: data.albumName || "",
      venue: data.venue || "",
      city: data.city || "",
      date: data.date || "",
      year: data.year || "",
      row: data.row || "",
      section: data.section || "",
      seat: data.seat || "",
      notes: data.notes || "",
      borderPrimary: safeHex(data.borderPrimary),
      borderSecondary: /^#[0-9a-fA-F]{6}$/.test(data.borderSecondary || "")
        ? (data.borderSecondary as string)
        : DEFAULT_BORDER_SECONDARY,
    });
    setIsEditing(true);
  }

  function handleSave() {
    onSave(titleDraft.trim() || "Concert Ticket Stub", {
      ...draft,
      year: (draft.year || parseYear(draft.date, "")).trim(),
    });
    setIsEditing(false);
  }

  return (
    <section
      className="h-full rounded-2xl p-4 shadow-lg"
      style={{ backgroundColor: outerBackgroundColor }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: accentTextColor }}>
          {title || "Concert Ticket Stub"}
        </h2>
        {isOwnProfile && canCustomize && (
          <button
            onClick={() => (isEditing ? setIsEditing(false) : startEdit())}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>

      {isOwnProfile && canCustomize && isEditing ? (
        <div className="space-y-2 rounded-xl border border-zinc-700/70 p-3" style={{ backgroundColor: innerBackgroundColor }}>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="Section title"
            className="w-full rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input value={draft.artist} onChange={(e) => handleChange("artist", e.target.value)} placeholder="Artist" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.tourName} onChange={(e) => handleChange("tourName", e.target.value)} placeholder="Tour name" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.albumName} onChange={(e) => handleChange("albumName", e.target.value)} placeholder="Album/Tour" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.venue} onChange={(e) => handleChange("venue", e.target.value)} placeholder="Venue" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="City" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input type="date" value={draft.date} onChange={(e) => handleChange("date", e.target.value)} className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.year} onChange={(e) => handleChange("year", e.target.value)} placeholder="Year (optional)" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.row} onChange={(e) => handleChange("row", e.target.value)} placeholder="Row" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.section} onChange={(e) => handleChange("section", e.target.value)} placeholder="Section" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.seat} onChange={(e) => handleChange("seat", e.target.value)} placeholder="Seat" className="rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <input value={draft.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Notes (opener, setlist, etc)" className="col-span-2 rounded border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs text-white outline-none" />
            <label className="text-[11px] text-zinc-400">Primary Border</label>
            <label className="text-[11px] text-zinc-400">Secondary Border</label>
            <input type="color" value={draft.borderPrimary} onChange={(e) => handleChange("borderPrimary", e.target.value)} className="h-8 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-900/70" />
            <input type="color" value={draft.borderSecondary} onChange={(e) => handleChange("borderSecondary", e.target.value)} className="h-8 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-900/70" />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="rounded bg-green-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-green-600"
            >
              Save Ticket
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-xl border-2 bg-[#efefef] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.32)]"
          style={{ borderColor: displayBorderPrimary }}
        >
          <div className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-900" />
          <div className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-zinc-900" />

          <div
            className="relative grid grid-cols-[82px_minmax(0,1fr)_74px] overflow-hidden rounded-lg border bg-white text-zinc-900"
            style={{ borderColor: displayBorderSecondary }}
          >
            <div
              className="border-r-2 border-dashed bg-[#f7f7f7] p-2 text-[10px]"
              style={{ borderColor: displayBorderPrimary }}
            >
              <p className="font-semibold uppercase tracking-wide text-zinc-700">Event Code</p>
              <p className="mb-2 text-base font-black leading-none text-zinc-900">{(data.tourName || "LIVE").slice(0, 5).toUpperCase()}</p>

              <p className="uppercase text-zinc-700">Section</p>
              <p className="mb-1 text-sm font-bold leading-tight">{data.section || "--"}</p>

              <p className="uppercase text-zinc-700">Seat</p>
              <p className="mb-1 text-sm font-bold leading-tight">{data.seat || "--"}</p>

              <p className="uppercase text-zinc-700">Date</p>
              <p className="font-bold">{displayDate}</p>
            </div>

            <div className="bg-[repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5_8px,#f2f2f2_8px,#f2f2f2_16px)] p-3">
              <div className="mb-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                <div>
                  <p>Section</p>
                  <p className="text-base font-bold text-zinc-900">{data.section || "--"}</p>
                </div>
                <div>
                  <p>Row</p>
                  <p className="text-base font-bold text-zinc-900">{data.row || "GA"}</p>
                </div>
                <div>
                  <p>Seat</p>
                  <p className="text-base font-bold text-zinc-900">{data.seat || "--"}</p>
                </div>
                <div>
                  <p>Year</p>
                  <p className="text-base font-bold text-zinc-900">{displayYear || "----"}</p>
                </div>
              </div>

              <div className="space-y-1 text-center">
                <p className="text-[11px] uppercase tracking-[0.4em] text-zinc-500">* * * *</p>
                <p className="truncate text-2xl font-black uppercase tracking-[0.1em] text-zinc-900">{data.artist || "Unknown Artist"}</p>
                <p className="truncate text-sm font-semibold uppercase text-zinc-700">{data.tourName || "Tour Name"}</p>
                <p className="truncate text-xs font-semibold uppercase text-zinc-600">{data.albumName || "Album/Tour"}</p>
                <p className="truncate text-sm font-semibold uppercase text-zinc-800">{data.venue || "Venue"}</p>
                <p className="truncate text-xs uppercase text-zinc-700">{data.city || "City"}</p>
                <p className="text-xs font-semibold uppercase text-zinc-800">{displayDate}</p>
              </div>
            </div>

            <div
              className="border-l-2 border-dashed bg-[#f7f7f7] p-2"
              style={{ borderColor: displayBorderPrimary }}
            >
              <div className="h-full rounded border bg-white p-1" style={{ borderColor: displayBorderSecondary }}>
                <div
                  className="h-full w-full"
                  style={{
                    backgroundColor: "#fff",
                    backgroundImage:
                      "repeating-linear-gradient(180deg,#111 0px,#111 2px,#fff 2px,#fff 3px,#111 3px,#111 4px,#fff 4px,#fff 7px,#111 7px,#111 9px,#fff 9px,#fff 10px,#111 10px,#111 12px,#fff 12px,#fff 14px)",
                  }}
                />
              </div>
            </div>
          </div>

          {data.notes?.trim() && (
            <div className="mt-2 rounded border bg-white px-2 py-1 text-xs font-semibold text-zinc-700" style={{ borderColor: displayBorderSecondary }}>
              {data.notes}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
