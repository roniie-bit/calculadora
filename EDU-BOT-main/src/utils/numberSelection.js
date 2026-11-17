export function parseSelection(raw, length) {
  const parts = raw.split(',').map(part => part.trim());
  const result = new Set();
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return null;
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > length) return null;
    for (let i = first; i <= last; i++) result.add(i - 1);
  }
  return [...result];
}
