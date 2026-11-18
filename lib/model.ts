// Token Radar: the value model and the farm plans.
//
// The board ranks pre-token protocols only. A protocol is pre-token when the
// snapshot records no token for it at all: no market cap, no CoinGecko id and
// no symbol. Protocols whose token already trades are never ranked; they are
// set aside as the Live set and shown with the market's own capitalisation,
// never with a model's number.
//
// Implied value is derived only from the snapshot's own figures, per row:
//
//   sector      = the sector multiple for the protocol's category:
//                 the median mcap/TVL of the snapshot's live-token
//                 protocols in that category, where at least 5 of them
//                 carry both a market cap and a TVL; otherwise the global
//                 median over all 129 live protocols. Clamped to 0.05..1.50,
//                 so one wild outlier (the snapshot holds a 400x row) cannot
//                 set a sector's price by itself. The multiple is the
//                 market's own pricing of comparable tokens, not a constant
//                 the author picked: a Dex is priced like Dexes, a lender
//                 like lenders, and a category with too few live tokens
//                 falls back to the whole market's median.
//   base        = tvl_usd x sector
//   growth      = clamp(change_7d, -50, +150) per cent (null counts as 0)
//   growthMult  = 1 + growth / 100 x 0.60
//   ageDays     = days from listed_at to the snapshot's as_of (null -> 180)
//   ageMult     = 0.55 + 0.45 x min(ageDays, 1460) / 1460
//   chainMult   = 1 + 0.02 x min(chains.length - 1, 5)
//   implied     = round(base x growthMult x ageMult x chainMult), at least $1
//
// Why each factor: TVL is the size of the business a token would price;
// the sector multiple is what the market already pays per dollar of TVL
// for that kind of business; seven-day growth is its momentum, clamped so
// one wild week (the snapshot holds a +4,448% row) cannot crown a protocol
// by itself; age is survival with no token, so a protocol tracked for four
// years counts more than one tracked for four weeks; chain breadth is a
// small diversification bonus. No protocol name is ever special-cased: the
// same function scores every row, and the dashboard recomputes it from the
// same figures so the page and board.json always agree.
//
// The board covers the whole watchlist (the floor, never the ceiling) plus
// every other rankable pre-token protocol below the floor. Rankable means
// pre-token, not a centralised exchange, bridge, liquid-staking or restaking
// product, not a versioned pool (a name ending in V2, v2, 2.0 and the like),
// carrying no whole word wrapped, staked or staking, and not beginning with
// an exchange's name. Those are the watchlist rule's own exclusions,
// applied to the early rows too, so a wrapped or staked product of a token
// that already trades never poses as a launch that has not happened.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  sector_min_live: number;
  sector_multiple_min: number;
  sector_multiple_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  age_floor: number;
  age_range: number;
  age_cap_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_steps: number;
}

export const MODEL: ModelConstants = {
  sector_min_live: 5,
  sector_multiple_min: 0.05,
  sector_multiple_max: 1.5,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  age_floor: 0.55,
  age_range: 0.45,
  age_cap_days: 1460,
  unknown_age_days: 180,
  chain_step: 0.02,
  chain_max_steps: 5,
};

export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Already trading view carries, by market cap. */
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    sector_multiple: number;
    sector_source: 'category' | 'global';
    sector_live_n: number;
    growth_pct: number;
    growth_multiplier: number;
    age_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  sector_multiple: number;
  sector_source: 'category' | 'global';
  sector_live_n: number;
  growth_multiplier: number;
  age_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface SectorMultiple {
  category: string;
  median: number;
  live_n: number;
}

export interface SectorMultiples {
  global_median: number;
  global_live_n: number;
  by_category: SectorMultiple[];
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  multiples: SectorMultiples;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * The sector multiples, derived from the snapshot's own live-token
 * protocols: for each category, the median mcap/TVL of its live protocols
 * that carry both figures, where at least `sector_min_live` of them do;
 * plus the global median over every live protocol. A category with too
 * few live tokens has no median of its own and falls back to the global
 * one. The median (not the mean) is used because the snapshot's ratios
 * run from 0.003x to 400x: one outlier must not set a sector's price.
 */
export function sectorMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): SectorMultiples {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio)) continue;
    all.push(ratio);
    const key = p.category ?? 'Uncategorised';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const global = all.length > 0 ? median(all) : 1;
  const rows: SectorMultiple[] = [];
  for (const [category, values] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (values.length >= model.sector_min_live) rows.push({ category, median: round4(median(values)), live_n: values.length });
  }
  return { global_median: round4(global), global_live_n: all.length, by_category: rows };
}

/** The sector multiple one protocol is priced at: its category's median where one exists, else the global median, clamped. */
export function sectorMultipleFor(
  category: string | null,
  multiples: SectorMultiples,
  model: ModelConstants = MODEL,
): { multiple: number; source: 'category' | 'global'; live_n: number } {
  const hit = category === null ? undefined : multiples.by_category.find((m) => m.category === category);
  const raw = hit !== undefined ? hit.median : multiples.global_median;
  const multiple = Math.min(model.sector_multiple_max, Math.max(model.sector_multiple_min, raw));
  return hit !== undefined
    ? { multiple, source: 'category', live_n: hit.live_n }
    : { multiple, source: 'global', live_n: multiples.global_live_n };
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: SectorMultiples,
): { implied: number; sectorMultiple: number; sectorSource: 'category' | 'global'; sectorLiveN: number; growthPct: number; growthMult: number; ageMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const sector = sectorMultipleFor(protocol.category, multiples, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const ageMult =
    model.age_floor +
    (Math.min(Math.max(ageForModel, 0), model.age_cap_days) / model.age_cap_days) * model.age_range;
  const chainMult = 1 + Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_steps) * model.chain_step;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * sector.multiple * growthMult * ageMult * chainMult));
  return { implied, sectorMultiple: sector.multiple, sectorSource: sector.source, sectorLiveN: sector.live_n, growthPct, growthMult, ageMult, chainMult, age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether the snapshot records no token for this protocol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether the board may rank this protocol: pre-token, and none of the
 * watchlist rule's exclusions (exchange, bridge, liquid staking or
 * restaking, a versioned pool, a wrapped or staked product, an exchange's
 * own product).
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Early radar: every other rankable pre-token protocol below the floor,
  // by TVL. A chosen protocol stays chosen; nothing here replaces a
  // watchlist row.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const multiples = sectorMultiples(snapshot, model);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, multiples);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: snapshot.watchlist.includes(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      sector_multiple: s.sectorMultiple,
      sector_source: s.sectorSource,
      sector_live_n: s.sectorLiveN,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      age_multiplier: round4(s.ageMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** One farm step as a single string: action, then its cost and time. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main farming action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('borrow')) {
    return `Supply $${capital} of USDC as collateral to ${name} on ${chain}, borrow a small amount against it, and keep both legs open.`;
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('amm')) {
    return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} in a tight range and keep the position open.`;
  }
  if (c.includes('yield') || c.includes('leveraged farm')) {
    return `Deposit $${capital} into ${name}'s highest-yield vault on ${chain} and let the yield compound in the vault.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged trade, then close it the same week.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC into ${chain} through ${name} and use the bridged funds inside the destination app.`;
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the farming wallet.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it for the full period.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the farming wallet.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} on ${name} on ${chain} and place one small market position each week.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole period.`;
  }
  if (c.includes('risk')) {
    return `Deposit $${capital} into a ${name} risk vault on ${chain} and keep the shares for the full period.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, category-specific weekly action, so the plan is not one generic list. */
function weeklyActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('borrow')) {
    return `Each week, repay a little of the borrow and re-supply the same amount so the position shows fresh activity.`;
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('amm')) {
    return `Each week, collect the pool fees and re-add them to the position instead of withdrawing them.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Each week, open and close one small trade on ${chain} so the account shows regular use.`;
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return `Each week, check the vault's points or rewards page and top up the deposit by a few dollars.`;
  }
  if (c.includes('prediction')) {
    return `Each week, settle one market position and open the next one on ${chain}.`;
  }
  return `Each week, make one qualifying action on ${chain}: a deposit, a swap, a vote or a claim.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const extraChain = p.chains.length > 1 ? ` Repeat the deposit on ${p.chains[1]} with half the amount so both chains count.` : '';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)}${extraChain}`,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyActionFor(p, chain),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot window.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from the link the protocol itself publishes and claim only there.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    sector_multiple: row.model.sector_multiple,
    sector_source: row.model.sector_source,
    sector_live_n: row.model.sector_live_n,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: row.watchlist,
    farm_steps: row.farm_steps,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    multiples: sectorMultiples(snapshot, model),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
