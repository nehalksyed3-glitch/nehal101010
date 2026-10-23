/** Validates a registered URL. Blocks schemes and hosts that must never be fetched server-side (SSRF). */
export function validateUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, error: "Enter a full URL such as https://example.com" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Only http(s) URLs are allowed." };
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (u.username || u.password) return { ok: false, error: "URLs with embedded credentials are not allowed." };
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return { ok: false, error: "Local hostnames are blocked." };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return { ok: false, error: "Private or reserved IP ranges are blocked." };
  }
  if (h.includes(":") && (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80"))) return { ok: false, error: "Private IPv6 ranges are blocked." };
  if (!h.includes(".") && !h.includes(":")) return { ok: false, error: "Hostname must be a public domain." };
  return { ok: true, url: u.toString() };
}
