import Link from 'next/link';

export default function ProfileIndexPage() {
  return (
    <main className="min-h-screen text-white px-6 py-8">
      <div className="max-w-4xl mx-auto bg-zinc-900 p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Profile</h1>
        <p className="text-zinc-400 mb-6">Use the dashboard to view a profile or share a profile link.</p>
        <Link href="/dashboard" className="text-green-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
