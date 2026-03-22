import { supabaseServer } from '@/utils/supabaseServer'

export default async function Dashboard() {
  const { data: tracks } = await supabaseServer
    .from('saved_tracks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>My Top Tracks</h1>
      <div style={{ display: 'grid', gap: '20px' }}>
        {tracks?.map((track) => (
          <div key={track.id} style={{ 
            padding: '20px', 
            border: '1px solid #333',
            borderRadius: '10px'
          }}>
            {track.album_url && (
              <img 
                src={track.album_url} 
                alt={track.track_name}
                style={{ width: '200px', borderRadius: '8px' }}
              />
            )}
            <h3>{track.track_name}</h3>
            <p>{track.artist_name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}