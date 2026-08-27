// Course name -> pill badge color mapping (design system se).
// Agar course ka naam design-system ki 6 predefined categories me se
// kisi se match kare (case-insensitive), wahi color use hota hai.
// Warna ek deterministic fallback color (isi palette se) milta hai,
// taake har course ko consistent aur distinct pill color mile.

const NAMED_BADGES = [
  { match: /unity/i, text: '#F97316', bg: '#FFF7ED' },
  { match: /unreal/i, text: '#3B82F6', bg: '#EFF6FF' },
  { match: /3d\s*animation/i, text: '#A855F7', bg: '#FAF5FF' },
  { match: /3d\s*design/i, text: '#EC4899', bg: '#FDF2F8' },
  { match: /post[\s-]?production/i, text: '#2563EB', bg: '#EFF6FF' },
  { match: /pre[\s-]?production/i, text: '#14B8A6', bg: '#F0FDFA' },
];

const FALLBACK_PALETTE = [
  { text: '#F97316', bg: '#FFF7ED' },
  { text: '#3B82F6', bg: '#EFF6FF' },
  { text: '#A855F7', bg: '#FAF5FF' },
  { text: '#EC4899', bg: '#FDF2F8' },
  { text: '#2563EB', bg: '#EFF6FF' },
  { text: '#14B8A6', bg: '#F0FDFA' },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCourseBadge(courseNameOrCode) {
  const label = (courseNameOrCode || '').trim();
  if (!label) return { text: '#6B7280', bg: '#F3F4F6' };

  const named = NAMED_BADGES.find((entry) => entry.match.test(label));
  if (named) return { text: named.text, bg: named.bg };

  const fallback = FALLBACK_PALETTE[hashString(label) % FALLBACK_PALETTE.length];
  return fallback;
}
