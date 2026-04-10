import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">SoundBored</h1>

        <p className="text-lg md:text-xl text-zinc-300 mb-10">
          A social music ranking platform where users can rate songs and albums,
          build tier lists, and follow friends to see their music activity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Log In
          </Link>

          <Link
            href="/signup"
            className="border border-white hover:bg-white hover:text-black px-6 py-3 rounded-lg font-semibold transition"
          >
            Sign Up
          </Link>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          Beta version in development
        </p>
      </div>
    </main>
  );
}