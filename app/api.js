// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json, and the
// site's agent docs at https://make.fun/llms.txt. No sign-in, no writes.

const API = 'https://make.fun/api';

// One cache entry per URL: the ETag the API sent and the body it went with.
// make.fun's ETags are bound to the minute: an If-None-Match inside the same
// minute answers 304 (the body is unchanged, so nothing is downloaded), and
// once the minute turns the API answers 200 with a fresh tag even when
// nothing changed. A revalidation therefore costs one small request and no
// download while the data is current, and every view reuses what the last
// view already fetched instead of asking again.
const cache = new Map(); // url -> { etag, body, at }

/** GET one API path, revalidating the cached copy with its ETag. */
async function apiGet(path) {
  const url = API + path;
  const hit = cache.get(url);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) return hit.body;
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  const body = await res.json();
  cache.set(url, { etag: res.headers.get('ETag'), body, at: Date.now() });
  return body;
}

/** When the last good copy of a URL was fetched, for the "updated" note. */
export function cachedAt(path) {
  const hit = cache.get(API + path);
  return hit ? hit.at : null;
}

/** An image path the API points at (avatars, share cards) as a full URL. */
export function apiImage(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://make.fun${path}`;
}

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export async function getBounties() {
  const first = await apiGet('/competitions?status=open&activity=times');
  const items = [...(first.items ?? [])];
  // The list is one page today; follow the cursor if the API ever pages it.
  let cursor = first.next_cursor;
  while (cursor) {
    const page = await apiGet(`/competitions?status=open&activity=times&cursor=${encodeURIComponent(cursor)}`);
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  }
  return { items };
}

/** One bounty, by its slug. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { competition, phase, columns, entries: [...] }. */
export const getLeaderboard = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by its handle. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);
