# SoundBored

A full-stack social music web application where users can sign up, log in, rate songs, build custom profiles, and follow friends to see music activity.

## Tech Stack

- **Frontend:** Next.js (App Router) + React
- **Database/Auth:** Supabase (PostgreSQL + Supabase Auth)
- **API:** Spotify Web API
- **Styling:** Tailwind CSS

## Finalized Features

- User signup, login, and logout
- Supabase authentication integration
- Public user profiles with customizable grid layouts, themes, and patterns
- Drag-and-drop profile section reordering and resizing
- Profile stickers (built-in and custom uploads)
- Song ratings with reviews
- Favorite tracks and albums (via Spotify search)
- Vinyl and CD player profile sections
- Custom playlist profile sections
- Concert ticket stub profile sections
- Follow / unfollow users
- Activity feed
- Find users page
- Admin panel with ban/unban and account deletion

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Environment Variables

Create a `.env.local` file in the project root with the following keys:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

### Installation

Clone the repository:

```terminal
git clone https://github.com/cdandeneau/Soundbored.git
cd SoundBored
```

Install dependencies:

```terminal
npm install
```

Start the development server:

```terminal
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> `npm` is recommended. `yarn` and `pnpm` will also work.
