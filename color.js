// Site colors from favicons, for the site search pill and its entry glow.

/** Average color of the most common saturated hue in RGBA pixels; null for black-and-white icons. */
export function dominantColor(data) {
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (a < 128 || max < 64 || (max - min) / max < 0.4) continue; // transparent, dark or grey
    const d = max - min;
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const k = Math.floor(h * 2) % 12; // 30° buckets
    const bin = bins.get(k) || [0, 0, 0, 0];
    bin[0] += r; bin[1] += g; bin[2] += b; bin[3]++;
    bins.set(k, bin);
  }
  let best = null;
  for (const bin of bins.values()) if (!best || bin[3] > best[3]) best = bin;
  if (!best || best[3] < 8) return null;
  return best.slice(0, 3).map((v) => Math.round(v / best[3]));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pill background for white text: darken up to 30% to reach 4.5:1, else keep the color and use dark text. */
export function pillColors(rgb) {
  for (let i = 0; i <= 6; i++) {
    const bg = rgb.map((c) => Math.round(c * (1 - i * 0.05)));
    if (contrast(bg, [250, 250, 250]) >= 4.5) return { bg, lightText: true };
  }
  return { bg: rgb, lightText: false };
}
