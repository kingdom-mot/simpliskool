/** Returns the school slug when the request is for a school subdomain, otherwise null. */
export function schoolSlugFromHost(host: string | null, rootDomain: string): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const reserved = new Set(["www", "app", "api", "admin"]);

  // Local development: brightfuture.localhost
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(/\.localhost$/, "");
    return reserved.has(sub) ? null : sub;
  }
  if (hostname === rootDomain || !hostname.endsWith(`.${rootDomain}`)) return null;
  const sub = hostname.slice(0, -(rootDomain.length + 1));
  if (!sub || sub.includes(".") || reserved.has(sub)) return null;
  return sub;
}
