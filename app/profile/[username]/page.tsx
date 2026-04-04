import { supabaseServer as supabase } from '@/utils/supabase/supabaseServer'; // Your Supabase SSR setup
import FollowButton from '@/app/components/FollowButton';
import { notFound } from 'next/navigation';

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  // 1. Get the profile of the user we are viewing
  const { username } = await params;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url')
    .eq('username', username)
    .single();

  if (!profile) return notFound();

  // 2. Get the current logged-in user
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // 3. Check if the current user is already following this profile
  let isFollowing = false;
  if (currentUser) {
    const { data: followRecord } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id)
      .single();
      
    isFollowing = !!followRecord;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white bg-zinc-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={profile.avatar_url || '/default-avatar.png'} 
            className="w-20 h-20 rounded-full border-2 border-green-500"
            alt={profile.username}
          />
          <div>
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <p className="text-gray-400">{profile.bio}</p>
          </div>
        </div>
        
        {/* Only show Follow button if it's not the user's own profile */}
        {currentUser && currentUser.id !== profile.id && (
          <FollowButton 
            targetUserId={profile.id} 
            initialIsFollowing={isFollowing} 
          />
        )}
      </div>
      
      {/* tier lists, ratings, spotify API integration here*/}
    </div>
  );
}