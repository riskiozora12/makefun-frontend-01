// Small helpers for showing API values.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00' or 0.5) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** How long ago a timestamp was: '3h ago', '2d ago', or 'just now'. */
export function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * A leaderboard rate as recorded, to the millionth: the API stores win rates
 * in micro units (956066 means 0.956066), and the leaderboard shows each rate
 * and its interval exactly as recorded.
 */
export function rate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return (n / 1e6).toFixed(6);
}

/** A byte count as '936,439 B' or '912.5 KB'. */
export function size(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n.toLocaleString('en-US')} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/** A wallet address shortened for display: 'BqGN…jFCE'. */
export function shortAddr(addr) {
  const s = String(addr ?? '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** True while a bounty still takes entries: judged by its deadline, not its status. */
export function isLive(bounty) {
  return new Date(bounty.deadline).getTime() > Date.now();
}
