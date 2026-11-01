import { citiesByCountry } from "./location-cities";

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-’']/g, " ").replace(/\s+/g, " ").trim();
}

// Optimal string alignment also catches adjacent transpositions. This small
// bounded comparison is enough for a local list of thirty city names.
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let before = previous;
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
    }
    before = previous; previous = row;
  }
  return previous[b.length];
}

export function locationSuggestions(value: string, countryCode: string): string[] {
  const cities = Object.hasOwn(citiesByCountry, countryCode) ? citiesByCountry[countryCode] : [];
  const comma = value.indexOf(",");
  const query = normalize(comma < 0 ? value : value.slice(0, comma));
  // Correct only the city. A neighbourhood or landmark is never discarded.
  const suffix = comma < 0 ? "" : value.slice(comma);
  const matches = cities.map((city, order) => {
    const name = normalize(city);
    let score = Infinity;
    if (!query || name === query) score = 0;
    else if (name.startsWith(query)) score = 1;
    else if (query.length >= 2 && name.split(" ").some(word => word.startsWith(query))) score = 2;
    else if (query.length >= 3 && name.includes(query)) score = 3;
    else if (query.length >= 4) {
      const limit = query.length < 7 ? 1 : 2;
      const edits = distance(query, name, limit);
      if (edits <= limit) score = 4 + edits;
    }
    return { label: city + suffix, score, order };
  });
  return matches.filter(item => Number.isFinite(item.score) && item.label.length <= 180)
    .sort((a, b) => a.score - b.score || a.order - b.order).slice(0, 5).map(item => item.label);
}
