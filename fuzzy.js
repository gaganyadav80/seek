// Small fuzzy matcher. Exact substrings win, word-start matches get a bonus,
// and scattered subsequence matches ("gtb" → "GitHub") still count.

const SEPARATOR = /[\s\-_./:#?&=+()[\]|,·]/;

function isBoundary(text, i) {
  if (i === 0) return true;
  const prev = text[i - 1];
  if (SEPARATOR.test(prev)) return true;
  // camelCase / PascalCase boundary
  const cur = text[i];
  return prev === prev.toLowerCase() && cur !== cur.toLowerCase();
}

function subsequence(token, text, lower, preferBoundary) {
  const positions = [];
  let from = 0;
  for (let qi = 0; qi < token.length; qi++) {
    const c = token[qi];
    const prev = positions.length ? positions[positions.length - 1] : -2;
    let firstAny = -1;
    let pick = -1;
    for (let j = from; j < lower.length; j++) {
      if (lower[j] !== c) continue;
      if (firstAny === -1) firstAny = j;
      if (!preferBoundary || j === prev + 1 || isBoundary(text, j)) { pick = j; break; }
    }
    if (pick === -1) pick = firstAny;
    if (pick === -1) return null;
    positions.push(pick);
    from = pick + 1;
  }
  return positions;
}

/** Match one lowercase token against `text`. Returns { score, positions } or null. */
export function matchToken(token, text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  const idx = lower.indexOf(token);
  if (idx !== -1) {
    let score = 100 + token.length * 12;
    if (idx === 0) score += 70;
    else if (isBoundary(text, idx)) score += 45;
    score -= Math.min(idx, 60) * 0.5;
    if (token.length === lower.length) score += 60;
    const positions = Array.from({ length: token.length }, (_, k) => idx + k);
    return { score, positions };
  }

  if (token.length < 2) return null;
  const positions =
    subsequence(token, text, lower, true) || subsequence(token, text, lower, false);
  if (!positions) return null;

  const span = positions[positions.length - 1] - positions[0] + 1;
  if (span > token.length * 5 + 6) return null; // too scattered to be meaningful

  let score = token.length * 4;
  for (let k = 0; k < positions.length; k++) {
    const p = positions[k];
    if (k > 0 && p === positions[k - 1] + 1) score += 9;
    else if (isBoundary(text, p)) score += 7;
    else score += 1;
  }
  score -= (span - token.length) * 0.6;
  score -= Math.min(positions[0], 60) * 0.3;
  return { score: Math.max(score, 1), positions };
}

/**
 * Every whitespace-separated token must match the title, URL or keywords.
 * Returns { score, titlePositions, urlPositions } or null.
 */
export function scoreItem(tokens, item) {
  let total = 0;
  const titlePositions = new Set();
  const urlPositions = new Set();

  for (const token of tokens) {
    const t = matchToken(token, item.title);
    const u = matchToken(token, item.displayUrl);
    const k = item.keywords ? matchToken(token, item.keywords) : null;

    const ts = t ? t.score * 1.4 : -1;
    const us = u ? u.score : -1;
    const best = Math.max(ts, us, k ? k.score * 0.9 : -1);
    if (best < 0) return null;
    total += best;
    // Highlight the token in whichever visible line it matched better.
    // Keyword-only matches (bookmark folders, setting aliases) aren't shown.
    if (t && ts >= us) t.positions.forEach((p) => titlePositions.add(p));
    else if (u) u.positions.forEach((p) => urlPositions.add(p));
  }
  return { score: total, titlePositions, urlPositions };
}
