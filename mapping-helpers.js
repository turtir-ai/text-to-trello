import { distance } from 'fastest-levenshtein';

export function mapAssigneesToIds({ assignees = [], boardMembers = [] }) {
  const index = new Map(
    boardMembers.map((m) => [("@" + (m.username || '')).toLowerCase(), m.id])
  );
  return assignees
    .map((a) => index.get((a || '').toLowerCase()))
    .filter(Boolean);
}

export function mapLabelsToIds({ labels = [], boardLabels = [] }) {
  const normalize = (s) => (s || '').toLowerCase().trim();
  const wanted = labels.map(normalize);
  const out = [];
  for (const w of wanted) {
    let best = null,
      bestScore = 3;
    for (const bl of boardLabels) {
      const d = distance(w, normalize(bl.name));
      if (d < bestScore) {
        bestScore = d;
        best = bl;
      }
    }
    if (best) out.push(best.id);
  }
  return Array.from(new Set(out));
}
