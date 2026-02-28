// Sexy/Cool default avatars for users without profile photos
// Using DiceBear API with different styles for variety

const AVATAR_STYLES = [
  { style: 'adventurer', seed: 'phoenix' },
  { style: 'adventurer', seed: 'dragon' },
  { style: 'adventurer', seed: 'wolf' },
  { style: 'adventurer', seed: 'tiger' },
  { style: 'adventurer', seed: 'panther' },
  { style: 'bottts', seed: 'neon' },
  { style: 'bottts', seed: 'cyber' },
  { style: 'bottts', seed: 'matrix' },
  { style: 'fun-emoji', seed: 'fire' },
  { style: 'fun-emoji', seed: 'star' },
];

// Cool animal/creature themed avatars using DiceBear
const SEXY_AVATAR_URLS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=phoenix&backgroundColor=f97316&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=dragon&backgroundColor=ec4899&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=wolf&backgroundColor=8b5cf6&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=tiger&backgroundColor=ef4444&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=panther&backgroundColor=3b82f6&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/bottts/svg?seed=neon&backgroundColor=22c55e&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber&backgroundColor=06b6d4&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/bottts/svg?seed=matrix&backgroundColor=a855f7&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=fire&backgroundColor=f97316&backgroundType=gradientLinear',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=star&backgroundColor=eab308&backgroundType=gradientLinear',
];

/**
 * Get a random default avatar URL
 */
export const getRandomDefaultAvatar = (): string => {
  const index = Math.floor(Math.random() * SEXY_AVATAR_URLS.length);
  return SEXY_AVATAR_URLS[index];
};

/**
 * Get a deterministic avatar based on user ID (consistent for same user)
 */
export const getDefaultAvatarForUser = (userId: string): string => {
  // Use the first characters of UUID to pick an avatar consistently
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % SEXY_AVATAR_URLS.length;
  return SEXY_AVATAR_URLS[index];
};

/**
 * Get avatar URL for a user - returns their avatar or a deterministic default
 */
export const getAvatarUrl = (avatarUrl: string | null | undefined, identifier: string): string => {
  if (avatarUrl && avatarUrl.trim() !== '') {
    return avatarUrl;
  }
  // Generate deterministic avatar based on identifier (username or userId)
  const hash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % SEXY_AVATAR_URLS.length;
  return SEXY_AVATAR_URLS[index];
};

/**
 * Check if a URL is one of our default avatars
 */
export const isDefaultAvatar = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes('api.dicebear.com');
};

export { SEXY_AVATAR_URLS };
