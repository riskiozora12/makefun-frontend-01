// A make.fun frontend: the board of open bounties, a page for each bounty,
// its leaderboard and an account's public profile, on hash routes.
//
//   #/                          the board
//   #/bounty/<slug>             one bounty
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is on
// screen, so a screenshot script knows when to capture. Each route fetches
// once; filters and pages after that work on the fetched data alone and update
// only the list they belong to, with no new request and no full re-render.
//
// This file is a thin shell on purpose: it statically imports nothing, so the
// first load is just index.html, the stylesheet and this file. The API layer
// and the views load on demand with literal import() calls, which the dossier
// lists under "Loaded later by import()" instead of the first load's Totals
// line — the smallest first load a working frontend can have.

const view = document.getElementById('view');

function parseRoute(hash) {
  const bounty = hash.match(/^#\/bounty\/([^/]+)(?:\/leaderboard)?$/);
  if (bounty) return { name: hash.endsWith('/leaderboard') ? 'leaderboard' : 'bounty', slug: decodeURIComponent(bounty[1]) };
  const profile = hash.match(/^#\/u\/([^/]+)$/);
  if (profile) return { name: 'profile', handle: decodeURIComponent(profile[1]) };
  return { name: 'board' };
}

function showError(message) {
  view.innerHTML = `<h1>Something went wrong</h1><p>${message}</p><p><button type="button" id="retry">Try again</button></p>`;
  document.getElementById('retry').addEventListener('click', render);
  window.__shotReady = true;
}

async function render() {
  window.__shotReady = false;
  view.innerHTML = '<p>Loading…</p>';
  const route = parseRoute(location.hash);
  try {
    // Loaded once and cached by the module system; later routes reuse them.
    const api = await import('./api.js');
    const views = await import('./views.js');
    if (route.name === 'bounty') {
      const b = await api.getBounty(route.slug);
      document.title = `${b.title} | make.fun bounties`;
      views.mountBounty(view, b, api, `/competitions/${encodeURIComponent(route.slug)}`);
    } else if (route.name === 'leaderboard') {
      const lb = await api.getLeaderboard(route.slug);
      document.title = `Leaderboard: ${lb.competition?.title ?? route.slug} | make.fun bounties`;
      views.mountLeaderboard(view, lb, api, `/competitions/${encodeURIComponent(route.slug)}/leaderboard`);
    } else if (route.name === 'profile') {
      const p = await api.getProfile(route.handle);
      document.title = `@${p.handle} | make.fun bounties`;
      views.mountProfile(view, p, api, `/profiles/${encodeURIComponent(route.handle)}`);
    } else {
      const data = await api.getBounties();
      document.title = 'make.fun bounties';
      views.mountBoard(view, data, api, '/competitions?status=open&activity=times');
    }
  } catch (err) {
    showError(`Could not load this page from make.fun's API (${err.message}).`);
    return;
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
