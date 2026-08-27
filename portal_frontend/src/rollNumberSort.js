// Roll numbers "{COURSE_CODE}-{S.No}" format me hain (jaise "UNREAL-2",
// "PRE-PROD-23"). Default string-sort galat order deta hai (UNREAL-10
// UNREAL-2 se pehle aa jata hai, kyunki '1' < '2' character-wise).
// Ye comparator prefix (course code, jo khud bhi hyphen-wala ho sakta
// hai jaise "PRE-PROD") aur trailing number ko alag karke: pehle
// prefix alphabetically, phir number NUMERICALLY compare karta hai.

function parseRollNumber(roll) {
  const match = /^(.*?)-(\d+)$/.exec(roll || '');
  if (match) {
    return { prefix: match[1], num: parseInt(match[2], 10) };
  }
  // Trailing number na mile (unexpected format) — poora string prefix
  // maan lo, number wala hissa na hone ki wajah se end me chala jata hai.
  return { prefix: roll || '', num: null };
}

export function compareRollNumbers(a, b) {
  const pa = parseRollNumber(a);
  const pb = parseRollNumber(b);

  if (pa.prefix !== pb.prefix) {
    return pa.prefix.localeCompare(pb.prefix);
  }
  if (pa.num === null && pb.num === null) return 0;
  if (pa.num === null) return 1;
  if (pb.num === null) return -1;
  return pa.num - pb.num;
}
