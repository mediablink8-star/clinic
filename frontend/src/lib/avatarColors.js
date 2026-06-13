const COLORS = [
  { bg: '#6366f1', text: '#ffffff' },
  { bg: '#10b981', text: '#ffffff' },
  { bg: '#f59e0b', text: '#ffffff' },
  { bg: '#ef4444', text: '#ffffff' },
  { bg: '#8b5cf6', text: '#ffffff' },
  { bg: '#06b6d4', text: '#ffffff' },
  { bg: '#ec4899', text: '#ffffff' },
  { bg: '#14b8a6', text: '#ffffff' },
];

export function getAvatarColor(name) {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
