// Token Radar's dashboard. Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, the filters, and a detail view
// for every protocol. No network: every byte it shows is in data.js.
//
// The page recomputes a row's implied value from the snapshot figures with
// impliedOf, the same arithmetic lib/model.ts runs, and shows the result
// beside the value board.json carries, so the page and the board visibly
// agree. Farm plans come from the board rows themselves.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var root = document.getElementById('board');
  if (!root) return;

  var state = { tab: 'pre', q: '', cat: 'all', chain: 'all', sort: 'implied', watch: false, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The model, in one function: implied = TVL x 0.30 x growth x age x chain.
  function impliedOf(row, model) {
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(model.growth_cap, Math.max(model.growth_floor, g));
    var growth = 1 + (g / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var ageMult = model.age_floor + (Math.min(Math.max(age, 0), model.age_cap_days) / model.age_cap_days) * model.age_range;
    var chain = 1 + Math.min(Math.max((row.chains || []).length - 1, 0), model.chain_max_steps) * model.chain_step;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growth * ageMult * chain));
  }

  function pctClass(n) {
    if (n === null || n === undefined) return 'flat';
    if (n > 0.5) return 'up';
    if (n < -0.5) return 'down';
    return 'flat';
  }

  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }
  var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
  fillSelect('cat', cats);
  fillSelect('chain', chains);

  document.getElementById('asof').textContent = DATA.as_of;
  document.getElementById('src').textContent = DATA.source;
  document.getElementById('model-line').innerHTML =
    'Model <code>radar-2</code>: implied = TVL &times; 0.30 &times; growth &times; age &times; chain &middot; ' +
    esc(DATA.board_size) + ' rows &middot; watchlist ' + esc(DATA.watchlist_size) + ' &middot; ' +
    esc(DATA.early_size) + ' early finds below the $50M floor &middot; ' + esc(DATA.live_size) + ' already trading, set aside.';
  var stats = document.getElementById('stats');
  var top = DATA.rows[0];
  var med = DATA.rows[Math.floor(DATA.rows.length / 2)];
  stats.innerHTML =
    '<div class="stat"><b>' + esc(DATA.board_size) + '</b><span>Protocols ranked</span></div>' +
    '<div class="stat"><b>' + esc(DATA.watchlist_size) + ' / ' + esc(DATA.watchlist_size) + '</b><span>Watchlist covered</span></div>' +
    '<div class="stat"><b>' + esc(top ? fmtUsd(top.implied_value_usd) : '—') + '</b><span>Top implied value</span></div>' +
    '<div class="stat"><b>' + esc(med ? fmtUsd(med.implied_value_usd) : '—') + '</b><span>Median implied value</span></div>' +
    '<div class="stat"><b>' + esc(DATA.live_size) + '</b><span>Already trading</span></div>';

  var tbody = document.getElementById('rows');
  var detail = document.getElementById('detail');
  var countEl = document.getElementById('count');
  var liveNote = document.getElementById('live-note');

  function sortRows(list) {
    var s = state.sort;
    var copy = list.slice();
    if (s === 'tvl') copy.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (s === 'growth') copy.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); });
    else if (s === 'age') copy.sort(function (a, b) { return (b.age_days || 0) - (a.age_days || 0); });
    else if (s === 'name') copy.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else copy.sort(function (a, b) { return (b.implied_value_usd || 0) - (a.implied_value_usd || 0); });
    return copy;
  }

  function filtered() {
    if (state.tab === 'live') {
      return DATA.live.map(function (r, i) {
        return { rank: i + 1, slug: r.slug, name: r.name, category: r.category, chains: r.chains, tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, implied_value_usd: r.mcap_usd, age_days: null, farm_steps: null };
      });
    }
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderRows() {
    var list = sortRows(filtered());
    liveNote.hidden = state.tab !== 'live';
    countEl.textContent = state.tab === 'live'
      ? list.length + ' protocols already trading — shown by market cap, never ranked.'
      : 'Showing ' + list.length + ' of ' + DATA.rows.length + ' pre-token protocols.';
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No protocol matches this filter. Clear the search or widen the category.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (r) {
      var val = state.tab === 'live' ? r.mcap_usd : r.implied_value_usd;
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.selected === r.slug ? 'sel' : '') + '">' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</span><small>' + esc(r.slug) + '</small></td>' +
        '<td class="cat">' + esc(r.category || '—') + '</td>' +
        '<td class="chn">' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num val">' + fmtUsd(val) + '</td></tr>';
    }).join('');
  }

  function bar(label, mult, max) {
    var pct = Math.max(4, Math.min(100, Math.round((mult / max) * 100)));
    return '<div class="bar-row"><span>' + esc(label) + '</span><div class="bar"><i style="width:' + pct + '%"></i></div><span>' + mult.toFixed(2) + '×</span></div>';
  }

  function renderDetail(slug) {
    var row = null;
    var i;
    for (i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    if (!row) {
      detail.innerHTML = '<h2>Pick a protocol</h2><p class="sub">Click any row on the board to see its model breakdown and its six farm steps.</p>' +
        '<h3>How to read the board</h3><p class="sub">Rank 1 is the highest implied value. The amber badge marks the 40 watchlist protocols at or above the $50M floor. Rows without it are the early finds below the floor.</p>';
      return;
    }
    var check = impliedOf(row, DATA.model);
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, g));
    var age = row.age_days === null || row.age_days === undefined ? DATA.model.unknown_age_days : row.age_days;
    var ageMult = DATA.model.age_floor + (Math.min(Math.max(age, 0), DATA.model.age_cap_days) / DATA.model.age_cap_days) * DATA.model.age_range;
    var chainMult = 1 + Math.min(Math.max((row.chains || []).length - 1, 0), DATA.model.chain_max_steps) * DATA.model.chain_step;
    var steps = (row.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    detail.innerHTML =
      '<h2>#' + row.rank + ' ' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.slug) + ' · ' + esc(row.category || 'Uncategorised') + ' · ' + esc((row.chains || []).join(', ') || '—') + (row.watchlist ? ' · <span class="badge">WATCHLIST</span>' : '') + '</p>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd class="val">' + fmtUsd(row.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(row.tvl_usd) + '</dd>' +
      '<dt>7-day change</dt><dd class="' + pctClass(row.change_7d) + '">' + fmtPct(row.change_7d) + '</dd>' +
      '<dt>Tracked since</dt><dd>' + esc(row.listed_at || 'unknown') + ' (' + fmtAge(row.age_days) + ')</dd>' +
      '<dt>Token recorded</dt><dd>None in snapshot</dd>' +
      '</dl>' +
      '<h3>Why this value</h3>' +
      bar('Growth ×' + (g > 0 ? '+' : '') + g.toFixed(1) + '%', row.growth_multiplier, 1.9) +
      bar('Age ' + fmtAge(row.age_days), row.age_multiplier, 1) +
      bar('Chains ×' + (row.chains || []).length, row.chain_multiplier, 1.1) +
      '<p class="sub">Recomputed here from the same figures: ' + fmtUsd(check) + ' — ' + (check === row.implied_value_usd ? 'matches the board.' : 'differs from the board; the board is the model\'s claim.') + '</p>' +
      '<h3>How to farm it — 6 steps</h3><ol class="steps">' + steps + '</ol>';
  }

  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderRows();
    renderDetail(state.selected);
  });

  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var map = { tvl: 'tvl', growth: 'growth', age: 'age', name: 'name', implied: 'implied' };
      state.sort = map[th.getAttribute('data-sort')] || 'implied';
      document.getElementById('sort').value = state.sort;
      renderRows();
    });
  });

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = b.getAttribute('data-tab');
      state.selected = null;
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('on', t === b);
        t.setAttribute('aria-selected', t === b ? 'true' : 'false');
      });
      renderRows();
      renderDetail(null);
    });
  });

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderRows(); });
  document.getElementById('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderRows(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderRows(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderRows(); });
  document.getElementById('watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderRows(); });

  renderRows();
  renderDetail(DATA.rows.length > 0 ? DATA.rows[0].slug : null);
})();
