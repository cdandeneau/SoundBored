/**
 * GET /api/callback
 *
 * Spotify OAuth callback handler. Called by Spotify after the user
 * authorizes access via /api/login.
 *
 * Flow:
 *  1. Receive the `code` query param from Spotify's redirect
 *  2. Exchange the code for an access token (Authorization Code grant)
 *  3. Fetch the user's top 5 tracks from Spotify using that token
 *  4. Save those tracks to the `saved_tracks` table in Supabase
 *  5. Redirect to /feed?status=success (or /feed?status=error on failure)
 *
 * Credentials used:
 *  - SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET — Base64-encoded in the Authorization header
 *  - SPOTIFY_REDIRECT_URI — must match the URI registered in the Spotify developer dashboard
 *  - SUPABASE_SERVICE_ROLE_KEY — used by supabaseServer to write without RLS restrictions
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/supabaseServer';

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    console.error('No code provided');
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    console.log('🔄 Exchanging code for token...');
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Spotify token error:', errorText);
      throw new Error('Failed to get access token from Spotify');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Got access token');

    console.log('Fetching top tracks from Spotify...');
    const tracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!tracksResponse.ok) {
      console.error('Spotify tracks error:', await tracksResponse.text());
      throw new Error('Failed to get tracks from Spotify');
    }

    const tracksData = await tracksResponse.json();
    console.log(`Got ${tracksData.items.length} tracks`);

    console.log('Saving to Supabase...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Has Service Role Key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const rowsToInsert = tracksData.items.map(track => ({
      spotify_id: track.id,
      track_name: track.name,
      artist_name: track.artists[0].name,
      album_url: track.album.images[0]?.url || '',
    }));

    console.log('Inserting rows:', rowsToInsert);

    const { data, error } = await supabaseServer
      .from('saved_tracks')
      .insert(rowsToInsert)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Saved to Supabase:', data);

    return NextResponse.redirect(new URL('/feed?status=success', request.url));

  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.redirect(new URL('/feed?status=error', request.url));
  }
}