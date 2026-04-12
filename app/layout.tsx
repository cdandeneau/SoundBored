/**
 * Root Layout
 *
 * Applied to every page in the app. Sets up:
 *  - Geist Sans + Geist Mono fonts (loaded from Google Fonts via next/font)
 *  - Global CSS (globals.css — Tailwind base, custom animations)
 *  - MusicNotes canvas — the floating animated music note background that
 *    renders on a fixed canvas behind all page content (z-index 1)
 *  - A relative wrapper div (z-index 2) that sits above the canvas so page
 *    content is always interactive and clickable
 *
 * The MusicNotes component reads the user's note_color from Supabase and
 * updates the canvas color accordingly.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MusicNotes from "./components/MusicNotes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoundBored",
  description: "Spotify tier list app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black">
        {/* Animated floating music notes rendered on a fixed canvas (z-index 1) */}
        <MusicNotes />
        {/* Page content sits above the canvas (z-index 2) so it stays interactive */}
        <div className="relative z-[2] flex flex-col flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
