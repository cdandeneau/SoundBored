/**
 * GET /api/login
 *
 * Kicks off the Spotify OAuth Authorization Code flow.
 * Redirects the browser to Spotify's /authorize endpoint with:
 *  - client_id   — identifies this app to Spotify
 *  - response_type=code — requests an authorization code (not a token directly)
 *  - redirect_uri — where Spotify sends the user after they approve access
 *  - scope       — `user-top-read` lets us read their top tracks
 *
 * After the user approves, Spotify redirects to SPOTIFY_REDIRECT_URI
 * (which should be /api/callback) with a `code` query param.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  // Permission to read the user's top artists and tracks
  const scope = 'user-top-read';

  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

  return NextResponse.redirect(spotifyAuthUrl);
}