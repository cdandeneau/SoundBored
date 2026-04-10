"use client";

import { useEffect, useRef } from "react";

const NOTES = ["♪", "♫", "♬", "♩", "𝄞"];
const NOTE_COUNT = 35;
const GLOW_COLOR = "rgba(34,197,94,";

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

export default function MusicNotes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<Note[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const frameRef = useRef<number>(0);

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
        ctx.shadowColor = `${GLOW_COLOR}${(glowIntensity * 0.7).toFixed(2)})`;
        ctx.shadowBlur = 15 + glowIntensity * 15;
        ctx.fillStyle = `${GLOW_COLOR}${alpha.toFixed(2)})`;
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
