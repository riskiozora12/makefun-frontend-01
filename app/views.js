// The four pages, each a function from API data to HTML.
// The router (main.js) fetches once per view and hands the data here; the
// leaderboard's paging and the board's filters then work on that data alone,
// with no further request, updating only the list they belong to.

import { apiImage } from './api.js';
import { date, esc, isLive, money, rate, shortAddr, size, timeAgo, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} fee` : 'no fee');

/** 'Live' while the deadline is ahead, 'Closed' once it has passed. */
const statusBadge = (b) => (isLive(b) ? '<span class="badge live">Live</span>' : '<span class="badge closed">Closed</span>');

/* ---------------- the board ---------------- */

export function boardRows(items, filter, query) {
  const q = query.trim().toLowerCase();
  const rows = items
    .filter((b) => {
      if (filter === 'live' && !isLive(b)) return false;
      if (filter === 'closed' && isLive(b)) return false;
      if (q && !`${b.title} ${b.slug}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      // Live bounties first, soonest deadline first; closed ones after, latest first.
      const la = isLive(a) ? 0 : 1;
      const lb = isLive(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      const d = new Date(a.deadline) - new Date(b.deadline);
      return la === 0 ? d : -d;
    })
    .map(
      (b) => `
      <li>
        <a class="row-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <span class="row-meta">${statusBadge(b)} ${esc(b.category ?? '')}</span>
        <span class="row-pot">${pot(b)}</span>
        <span>${fee(b)}</span>
        <span>${timeLeft(b.deadline)}</span>
        <span>${b.submissionCount} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
      </li>`,
    )
    .join('');
  return rows || '<li class="empty">No bounties match.</li>';
}

export function boardView(items, filter, query, counts) {
  const btn = (f, label) => `<button data-filter="${f}" class="${filter === f ? 'on' : ''}" type="button">${label}</button>`;
  return `
    <h1>Open bounties</h1>
    <p class="lede">Live bounties first, soonest deadline first. A bounty past its deadline
    reads Closed — whether it still takes entries is judged by its deadline, not its status.</p>
    <div class="toolbar">
      <div class="filters" role="group" aria-label="Filter bounties">
        ${btn('all', `All (${counts.all})`)}${btn('live', `Live (${counts.live})`)}${btn('closed', `Closed (${counts.closed})`)}
      </div>
      <input id="board-search" type="search" placeholder="Search bounties…" value="${esc(query)}" aria-label="Search bounties">
    </div>
    <ul class="board" id="board-list">${boardRows(items, filter, query)}</ul>`;
}

/* ---------------- one bounty ---------------- */

function rewardTable(b) {
  const now = b.rewardsNow ?? [];
  const rows = (now.length ? now : Object.entries(b.rewards ?? {}).map(([place, amount]) => ({ place: Number(place), amountUsd: String(amount) })))
    .map(
      (r) => `
      <tr>
        <td>${r.place}</td>
        <td>${money(r.baseUsd ?? r.amountUsd)}</td>
        <td>${r.feeShareUsd !== undefined ? money(r.feeShareUsd) : '—'}</td>
        <td><strong>${money(r.amountUsd)}</strong></td>
      </tr>`,
    )
    .join('');
  return `
    <table class="rewards">
      <thead><tr><th>Place</th><th>Base prize</th><th>Fee share</th><th>Total now</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">The live pot is ${pot(b)} — the $500 base prize plus $${Number(b.entryFeesUsd ?? 0).toLocaleString('en-US')} in entry fees
    from ${b.entryFeePayers ?? 0} payers. Fee shares grow as more fees are paid, split over the places in proportion to their prizes.</p>`;
}

export function bountyView(b) {
  const subs = (b.submissions ?? []).slice(0, 8);
  return `
    <p class="crumb"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary ?? '')}</p>
    <dl class="facts">
      <dt>Reward</dt><dd><strong>${pot(b)}</strong> ${statusBadge(b)}</dd>
      ${b.entryFeeUsd ? `<dt>Entry fee</dt><dd>${money(b.entryFeeUsd)} (paid once per account)</dd>` : ''}
      <dt>Deadline</dt><dd>${date(b.deadline)} (${timeLeft(b.deadline)})</dd>
      <dt>Opened</dt><dd>${date(b.opensAt ?? b.publishedAt)}</dd>
      <dt>Entries</dt><dd>${b.submissionCount}</dd>
      <dt>Category</dt><dd>${esc(b.category ?? '—')}${(b.skills ?? []).length ? ` · ${b.skills.map(esc).join(', ')}` : ''}</dd>
      <dt>Sponsor</dt><dd>${esc(b.sponsor?.name ?? '—')}</dd>
    </dl>
    <h2>Rewards</h2>
    ${rewardTable(b)}
    <h2>Description</h2>
    <div class="description">${esc(b.description ?? '')}</div>
    ${b.rules ? `<details><summary>Rules</summary><div class="description">${esc(b.rules)}</div></details>` : ''}
    ${subs.length ? `
    <h2>Recent entries</h2>
    <ul class="subs">${subs.map((s) => `<li><a href="#/u/${encodeURIComponent(s.hunter)}">${esc(s.hunter)}</a> — ${esc(s.title ?? '')} <span class="muted">${timeAgo(s.createdAt)}</span></li>`).join('')}</ul>` : ''}`;
}

/* ---------------- a leaderboard ---------------- */

export const LB_PER_PAGE = 25;

export function leaderboardRows(entries, page, query) {
  const q = query.trim().toLowerCase();
  const list = entries.filter(
    (e) => !q || `${e.handle} ${e.title ?? ''}`.toLowerCase().includes(q),
  );
  const pages = Math.max(1, Math.ceil(list.length / LB_PER_PAGE));
  const safe = Math.min(Math.max(1, page), pages);
  const slice = list.slice((safe - 1) * LB_PER_PAGE, safe * LB_PER_PAGE);
  const rows = slice
    .map((e) => {
      const img = e.image ? `<img class="avatar" src="${esc(apiImage(e.image))}" crossorigin="anonymous" alt="" loading="lazy" width="28" height="28">` : '<span class="avatar none"></span>';
      const badges = [
        e.house ? '<span class="badge">house</span>' : '',
        e.judge?.provisional ? '<span class="badge">provisional</span>' : '',
        e.ranked === false ? '<span class="badge">unranked</span>' : '',
      ].join(' ');
      const wl = e.judge ? `${e.judge.wins}W–${e.judge.losses}L` : '—';
      return `
      <tr>
        <td>${e.rank ?? '—'}</td>
        <td><span class="entrant">${img}<span><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a><span class="entry-title">${esc(e.title ?? '')}</span></span></span> ${badges}</td>
        <td class="num">${rate(e.values?.judge)}</td>
        <td class="num">${rate(e.values?.judge_low)} – ${rate(e.values?.judge_high)}</td>
        <td class="num">${wl}</td>
        <td class="num">${size(e.values?.bytes)}</td>
      </tr>`;
    })
    .join('');
  return { rows: rows || '<tr><td colspan="6" class="empty">No entries match.</td></tr>', pages, page: safe, total: list.length };
}

export function leaderboardView(lb) {
  const c = lb.competition ?? {};
  const total = lb.entries?.length ?? 0;
  return `
    <p class="crumb"><a href="#/">All bounties</a> · <a href="#/bounty/${encodeURIComponent(c.slug ?? '')}">${esc(c.title ?? '')}</a></p>
    <h1>Leaderboard: ${esc(c.title ?? '')}</h1>
    <p class="lede">${total} entries · ${esc(lb.phase?.title ?? '')} phase · rates shown to the millionth,
    each with its 90% interval (rate ± 1.6449 × standard error, kept within 0 and 1). Places follow the
    point estimate; a displayed tie never moves a place. The Size column is each entry's dossier bytes.</p>
    <div class="toolbar">
      <input id="lb-search" type="search" placeholder="Search handle or title…" aria-label="Search entries">
      <div class="pager" id="lb-pager"></div>
    </div>
    <table class="lb">
      <thead><tr><th>#</th><th>Entrant</th><th>Win rate</th><th>90% interval</th><th>W–L</th><th>Size</th></tr></thead>
      <tbody id="lb-body"></tbody>
    </table>`;
}

/* ---------------- mounting: render a view and wire its interactions ---------------- */
// Each mount renders its view once, then wires the filter/search/pager controls
// to the data already fetched: no new request, and only the list itself is
// re-drawn, never the whole page.

/** When the last good copy of a URL was fetched, for the "updated" note. */
function updatedNote(api, path) {
  const at = api.cachedAt(path);
  return at ? `<p class="muted">Updated ${date(new Date(at).toISOString())} · cached, revalidated each minute.</p>` : '';
}

export function mountBoard(viewEl, data, api, path) {
  const counts = {
    all: data.items.length,
    live: data.items.filter(isLive).length,
    closed: data.items.filter((b) => !isLive(b)).length,
  };
  let filter = 'all';
  let query = '';
  viewEl.innerHTML = boardView(data.items, filter, query, counts) + updatedNote(api, path);
  const draw = () => {
    const list = document.getElementById('board-list');
    if (list) list.innerHTML = boardRows(data.items, filter, query);
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
  };
  document.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      filter = b.dataset.filter;
      draw();
    }),
  );
  document.getElementById('board-search').addEventListener('input', (e) => {
    query = e.target.value;
    draw();
  });
}

export function mountBounty(viewEl, b, api, path) {
  viewEl.innerHTML = bountyView(b) + updatedNote(api, path);
}

export function mountLeaderboard(viewEl, lb, api, path) {
  let page = 1;
  let query = '';
  viewEl.innerHTML = leaderboardView(lb) + updatedNote(api, path);
  const draw = () => {
    const body = document.getElementById('lb-body');
    const pager = document.getElementById('lb-pager');
    if (!body) return;
    const result = leaderboardRows(lb.entries ?? [], page, query);
    page = result.page;
    body.innerHTML = result.rows;
    pager.innerHTML = `
      <button type="button" id="lb-prev" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span>Page ${page} of ${result.pages} · ${result.total} entries</span>
      <button type="button" id="lb-next" ${page >= result.pages ? 'disabled' : ''}>Next ›</button>`;
    document.getElementById('lb-prev').addEventListener('click', () => {
      page -= 1;
      draw();
    });
    document.getElementById('lb-next').addEventListener('click', () => {
      page += 1;
      draw();
    });
  };
  draw();
  document.getElementById('lb-search').addEventListener('input', (e) => {
    query = e.target.value;
    page = 1;
    draw();
  });
}

export function mountProfile(viewEl, p, api, path) {
  viewEl.innerHTML = profileView(p) + updatedNote(api, path);
}

function stat(label, value) {
  return `<div class="stat"><span class="stat-num">${esc(value)}</span><span class="stat-label">${label}</span></div>`;
}

export function profileView(p) {
  const r = p.record ?? {};
  const avatarUrl = p.image ?? p.avatar?.url ?? '';
  const img = avatarUrl
    ? `<img class="avatar big" src="${esc(apiImage(avatarUrl))}" crossorigin="anonymous" alt="Avatar of ${esc(p.handle)}" width="72" height="72">`
    : '<span class="avatar big none"></span>';
  const wallet = p.wallet?.address
    ? `<dt>Wallet</dt><dd><a href="${esc(p.wallet.explorer_url ?? `https://solscan.io/account/${p.wallet.address}`)}">${shortAddr(p.wallet.address)}</a></dd>`
    : '';
  const links = [
    p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub ${esc(p.github_login)}</a>` : '',
    p.x ? `<a href="https://x.com/${encodeURIComponent(p.x)}">X @${esc(p.x)}</a>` : '',
    p.discord ? `<span>Discord ${esc(p.discord)}</span>` : '',
  ].filter(Boolean).join(' · ');
  const solutions = (p.solutions ?? []).map((s) => {
    const comp = s.competition ?? {};
    return `
      <tr>
        <td><a href="#/bounty/${encodeURIComponent(comp.slug ?? '')}">${esc(comp.title ?? comp.slug ?? '')}</a></td>
        <td>${esc(s.title ?? '')}</td>
        <td class="num">${s.placement ?? '—'}</td>
        <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td class="num">${s.score ? rate(s.score.value) : '—'}</td>
        <td>${timeAgo(s.entered_at)}</td>
      </tr>`;
  }).join('');
  const payouts = (p.payouts ?? []).map((x) => `
      <li>${money(x.amount_usd)} · place ${x.place} · <a href="#/bounty/${encodeURIComponent(x.competition?.slug ?? '')}">${esc(x.competition?.title ?? '')}</a>
      <span class="muted">${timeAgo(x.paid_at)}</span> ${x.signature ? `<a class="muted" href="https://solscan.io/tx/${encodeURIComponent(x.signature)}">tx</a>` : ''}</li>`).join('');
  return `
    <div class="profile-head">${img}
      <div>
        <h1>@${esc(p.handle)}</h1>
        ${p.display_name ? `<p class="lede">${esc(p.display_name)}</p>` : ''}
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <p class="muted">Joined ${date(p.joined_at)}${links ? ` · ${links}` : ''}</p>
      </div>
    </div>
    <dl class="facts">${wallet}</dl>
    <div class="stats">
      ${stat('Entered', String(r.competitions_entered ?? 0))}
      ${stat('Placed', String(r.competitions_placed ?? 0))}
      ${stat('Won', String(r.competitions_won ?? 0))}
      ${stat('Podium', String(r.podium_finishes ?? 0))}
      ${stat('Best place', r.best_placement ? `#${r.best_placement}` : '—')}
      ${stat('Prize money', money(r.prize_usd ?? 0))}
    </div>
    <h2>Entries (${(p.solutions ?? []).length})</h2>
    ${solutions ? `
    <table class="lb">
      <thead><tr><th>Bounty</th><th>Entry</th><th>Place</th><th>Prize</th><th>Score</th><th>Entered</th></tr></thead>
      <tbody>${solutions}</tbody>
    </table>` : '<p class="muted">No entries yet.</p>'}
    ${payouts ? `<h2>Payouts</h2><ul class="subs">${payouts}</ul>` : ''}`;
}
