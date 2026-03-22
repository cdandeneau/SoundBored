import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabaseServer';

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

    return NextResponse.redirect(new URL('/dashboard?status=success', request.url));

  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.redirect(new URL('/dashboard?status=error', request.url));
  }
}