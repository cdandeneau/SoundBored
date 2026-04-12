'use client';

/**
 * FollowButton (app/components)
 *
 * Reusable follow/unfollow toggle button used on the profile page.
 * Uses an optimistic UI update — the displayed state flips immediately
 * and reverts only if the Supabase write fails.
 *
 * Note: there is also a near-identical copy at app/profile/followbutton.tsx
 * which was the original version. This one in app/components/ is the canonical
 * version. Both are functionally the same.
 */
import { useState } from 'react';
import { supabase } from '@/utils/supabase/supabaseClient';
import { getCurrentUserSafe } from '@/utils/supabase/auth';
import { useRouter } from 'next/navigation';

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
}

export default function FollowButton({ targetUserId, initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const toggleFollow = async () => {
    setIsLoading(true);
    
    // Optimistic UI update
    setIsFollowing(!isFollowing);

    const user = await getCurrentUserSafe();
    if (!user) return; // Prompt login here if preferred

    if (isFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);
        
      if (error) setIsFollowing(true); // Revert on error
    } else {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetUserId });
        
      if (error) setIsFollowing(false); // Revert on error
    }

    setIsLoading(false);
    router.refresh(); // Refresh Next.js server cache to update follower counts if needed
  };

  return (
    <button
      onClick={toggleFollow}
      disabled={isLoading}
      className={`px-6 py-2 font-semibold rounded-full transition-colors duration-200 ${
        isFollowing
          ? 'bg-zinc-800 text-white border border-zinc-600 hover:bg-zinc-700'
          : 'bg-green-500 text-black hover:bg-green-400'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}