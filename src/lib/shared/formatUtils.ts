export function normalizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  
  let urlStr = url.trim();
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }
  
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return urlStr.replace(/\/$/, "").toLowerCase();
  }
}

export function createUrlPattern(profileUrl: string | undefined | null): string {
  if (!profileUrl) return "";
  try {
    const urlObj = new URL(profileUrl);
    const pathname = urlObj.pathname.replace(/\/$/, "").toLowerCase();
    return `%${pathname}%`;
  } catch {
    const url = profileUrl.replace(/\/$/, "").toLowerCase();
    return `%${url}%`;
  }
}

export function parseConnectedOn(value: string | undefined | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
