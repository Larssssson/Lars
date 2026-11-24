/**
 * Einfache SVG-Diagramme für Vorschau, PDF und Word (als Bild). Kunde in der Akzentfarbe,
 * Wettbewerber in abgestuftem Grau, Werte immer direkt beschriftet.
 */
const INK = "#1c1b19";
const MUTED = "#6b6459";
const GRID = "#e7e2d8";
const GREYS = ["#8a8378", "#a59f94", "#bfb9ae", "#d4cfc5", "#9c9488"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number) => new Intl.NumberFormat("de-DE").format(n);

/** Waagerechte Balken, z. B. Share of Voice oder Tiers. */
export function barChart(items: { label: string; value: number; note?: string; highlight?: boolean }[], accent: string, width = 640): string {
  const row = 30;
  const labelW = 170;
  const valueW = 110;
  const max = Math.max(1, ...items.map((i) => i.value));
  const barW = width - labelW - valueW;
  const height = items.length * row + 8;
  let grey = 0;
  const bars = items
    .map((item, i) => {
      const y = i * row + 4;
      const w = Math.max(item.value > 0 ? 2 : 0, (item.value / max) * barW);
      const color = item.highlight ? accent : GREYS[grey++ % GREYS.length];
      return `<text x="${labelW - 10}" y="${y + 17}" text-anchor="end" font-size="13" fill="${INK}" font-weight="${item.highlight ? 600 : 400}">${esc(item.label)}</text>
<rect x="${labelW}" y="${y + 4}" width="${w.toFixed(1)}" height="${row - 10}" rx="3" fill="${color}"/>
<text x="${labelW + w + 8}" y="${y + 17}" font-size="12" fill="${MUTED}">${esc(item.note ?? fmt(item.value))}</text>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Inter, Arial, sans-serif" role="img">${bars}</svg>`;
}

/** Ein gestapelter Balken über 100 %, z. B. Tonalität. */
export function stackBar(parts: { label: string; value: number; color: string }[], width = 640): string {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let x = 0;
  const segs = parts
    .filter((p) => p.value > 0)
    .map((p) => {
      const w = (p.value / total) * width;
      const seg = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="26" fill="${p.color}"/>`;
      x += w;
      return seg;
    })
    .join("");
  let lx = 0;
  const legend = parts
    .map((p) => {
      const text = `${p.label} ${fmt(p.value)} (${Math.round((p.value / total) * 100)} %)`;
      const item = `<rect x="${lx}" y="38" width="10" height="10" rx="2" fill="${p.color}"/><text x="${lx + 15}" y="47" font-size="12" fill="${INK}">${esc(text)}</text>`;
      lx += 22 + text.length * 6.4;
      return item;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 56" width="${width}" height="56" font-family="Inter, Arial, sans-serif" role="img"><g>${segs}</g>${legend}</svg>`;
}

/** Säulen je Monat für Kunde und Wettbewerber gesamt. */
export function trendChart(points: { label: string; client: number; competitors: number }[], accent: string, labels: { client: string; competitors: string }, showCompetitors: boolean, width = 640): string {
  const height = 200;
  const top = 24;
  const bottom = 26;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...points.map((p) => Math.max(p.client, showCompetitors ? p.competitors : 0)));
  const slot = width / Math.max(1, points.length);
  const bw = Math.min(28, slot / 3);
  const cols = points
    .map((p, i) => {
      const cx = i * slot + slot / 2;
      const h1 = (p.client / max) * plotH;
      const h2 = (p.competitors / max) * plotH;
      const a = `<rect x="${(showCompetitors ? cx - bw - 2 : cx - bw / 2).toFixed(1)}" y="${(top + plotH - h1).toFixed(1)}" width="${bw}" height="${h1.toFixed(1)}" rx="2" fill="${accent}"/>
<text x="${(showCompetitors ? cx - bw / 2 - 2 : cx).toFixed(1)}" y="${(top + plotH - h1 - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="${INK}">${p.client}</text>`;
      const b = showCompetitors
        ? `<rect x="${(cx + 2).toFixed(1)}" y="${(top + plotH - h2).toFixed(1)}" width="${bw}" height="${h2.toFixed(1)}" rx="2" fill="${GREYS[1]}"/>
<text x="${(cx + 2 + bw / 2).toFixed(1)}" y="${(top + plotH - h2 - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="${MUTED}">${p.competitors}</text>`
        : "";
      return `${a}${b}<text x="${cx.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="${MUTED}">${esc(p.label)}</text>`;
    })
    .join("\n");
  const legend = `<rect x="0" y="2" width="10" height="10" rx="2" fill="${accent}"/><text x="15" y="11" font-size="12" fill="${INK}">${esc(labels.client)}</text>${
    showCompetitors ? `<rect x="110" y="2" width="10" height="10" rx="2" fill="${GREYS[1]}"/><text x="125" y="11" font-size="12" fill="${INK}">${esc(labels.competitors)}</text>` : ""
  }`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Inter, Arial, sans-serif" role="img"><line x1="0" x2="${width}" y1="${top + plotH}" y2="${top + plotH}" stroke="${GRID}"/>${legend}${cols}</svg>`;
}

export const SENTIMENT_COLORS = { positiv: "#2f8f5b", neutral: "#bfb9ae", negativ: "#b3361f", ohne: "#e7e2d8" } as const;
