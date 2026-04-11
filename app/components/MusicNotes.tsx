"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../utils/supabase/supabaseClient";
import { getCurrentUserSafe } from "../../utils/supabase/auth";

const NOTES = ["♪", "♫", "♬", "♩", "𝄞"];
const NOTE_COUNT = 35;
const DEFAULT_NOTE_COLOR = "#22c55e";

interface Note {
  x: number;
  y: number;
  size: number;
  speed: number;
  char: string;
  opacity: number;
  glowPhase: number;
  glowSpeed: number;
  drift: number;
  driftSpeed: number;
  driftPhase: number;
}

function isValidHexColor(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

export default function MusicNotes() {
  const pathname = usePathname();
  const [noteColor, setNoteColor] = useState(DEFAULT_NOTE_COLOR);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<Note[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function resolveNoteColor() {
      const pathParts = pathname.split("/").filter(Boolean);
      const isProfileRoute = pathParts[0] === "profile" && !!pathParts[1];

      if (isProfileRoute) {
        const username = decodeURIComponent(pathParts[1]);
        const { data, error } = await supabase
          .from("profiles")
          .select("note_color")
          .eq("username", username.toLowerCase())
          .maybeSingle();

        if (!cancelled) {
          const color = !error && isValidHexColor(data?.note_color)
            ? data.note_color
            : DEFAULT_NOTE_COLOR;
          setNoteColor(color);
        }
        return;
      }

      const user = await getCurrentUserSafe();
      if (!user) {
        if (!cancelled) setNoteColor(DEFAULT_NOTE_COLOR);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("note_color")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        const color = !error && isValidHexColor(data?.note_color)
          ? data.note_color
          : DEFAULT_NOTE_COLOR;
        setNoteColor(color);
      }
    }

    resolveNoteColor();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = document.documentElement.scrollHeight;
    }

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", resize);

    function createNote(startAtTop?: boolean): Note {
      return {
        x: Math.random() * canvas!.width,
        y: startAtTop ? -30 : Math.random() * canvas!.height,
        size: 22 + Math.random() * 26,
        speed: 0.15 + Math.random() * 0.35,
        char: NOTES[Math.floor(Math.random() * NOTES.length)],
        opacity: 0.15 + Math.random() * 0.25,
        glowPhase: Math.random() * Math.PI * 2,
        glowSpeed: 0.008 + Math.random() * 0.015,
        drift: 15 + Math.random() * 25,
        driftSpeed: 0.003 + Math.random() * 0.006,
        driftPhase: Math.random() * Math.PI * 2,
      };
    }

    notesRef.current = Array.from({ length: NOTE_COUNT }, () => createNote(false));

    function handleMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY + window.scrollY };
    }

    window.addEventListener("mousemove", handleMouse);

    let time = 0;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { r, g, b } = hexToRgb(noteColor);

      time++;
      const mouse = mouseRef.current;

      for (const note of notesRef.current) {
        note.y += note.speed;
        note.glowPhase += note.glowSpeed;
        note.driftPhase += note.driftSpeed;

        const xOffset = Math.sin(note.driftPhase) * note.drift;

        // Mouse interaction — push notes away
        const dx = (note.x + xOffset) - mouse.x;
        const dy = note.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const interactionRadius = 120;

        let pushX = 0;
        let pushY = 0;
        if (dist < interactionRadius && dist > 0) {
          const force = (1 - dist / interactionRadius) * 2.5;
          pushX = (dx / dist) * force;
          pushY = (dy / dist) * force;
        }

        const drawX = note.x + xOffset + pushX;
        const drawY = note.y + pushY;

        // Glow pulse
        const glowIntensity = 0.4 + Math.sin(note.glowPhase) * 0.4;
        const alpha = note.opacity * (0.6 + glowIntensity * 0.4);

        ctx.save();
        ctx.font = `${note.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Glow layers
        ctx.shadowColor = `rgba(${r},${g},${b},${(glowIntensity * 0.7).toFixed(2)})`;
        ctx.shadowBlur = 15 + glowIntensity * 15;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
        ctx.fillText(note.char, drawX, drawY);

        // Second pass for stronger glow
        ctx.shadowBlur = 5 + glowIntensity * 8;
        ctx.fillText(note.char, drawX, drawY);

        ctx.restore();

        // Reset note when it falls off screen
        if (note.y > canvas.height + 40) {
          Object.assign(note, createNote(true));
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
    };
  }, [noteColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
