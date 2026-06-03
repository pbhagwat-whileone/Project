export function normalizeCompanySize(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  let s = val.toLowerCase().trim();
  if (s === "unknown") return null;

  s = s.replace(/,/g, "");
  const match = s.match(/(\d+)(?:\+|-.*)?/);
  if (match) {
    let num = parseInt(match[1]);
    if (num >= 10000) return "10,000+";
    if (num >= 5000) return "5,000-10,000";
    if (num >= 1000) return "1,000-5,000";
    if (num >= 500) return "500-1,000";
    if (num >= 200) return "200-500";
    if (num >= 50) return "50-200";
    return "1-50";
  }
  return val.trim();
}

export function normalizeIndustry(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  let s = val.toLowerCase().trim();
  if (s === "unknown") return null;
  s = s.replace(/\s+industry$/, "");
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function normalizeCountry(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  let s = val.toLowerCase().trim();
  if (s === "unknown") return null;
  if (s === "usa" || s === "us" || s === "united states" || s === "united states of america") return "United States";
  if (s === "uk" || s === "united kingdom" || s === "great britain") return "United Kingdom";
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function normalizeRevenueBand(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  let s = val.toLowerCase().trim();
  if (s === "unknown") return null;

  const match = s.match(/(\d+)\s*(b|billion|m|million)/);
  if (match) {
    const num = match[1];
    const unit = match[2].startsWith('b') ? 'B' : 'M';
    return `$${num}${unit}+`;
  }
  
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
