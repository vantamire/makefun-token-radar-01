# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/vantamire/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/vantamire/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Ranks DeFiLlama protocols without tokens by implied value, with a dashboard and 3 screenshots.

## v2 (18 November 2026)

A genuine rebuild of the ranking, not a reshuffle of v1:

- **Sector multiples from the market, not a fixed 0.30×.** v1 priced every protocol at TVL × 0.30. v2 prices each protocol at TVL × the median mcap/TVL of the snapshot's live-token protocols in its own category (at least 5 live, else the global median 0.22× from 128 live protocols), clamped to 0.05–1.50×. Dexes price at 0.34×, lenders at 0.13×, RWA at 0.27× — the multiple is the market's own pricing of comparable tokens. 51 of 178 rows moved at least 10 ranks.
- **The dashboard shows the multiple.** Every detail view breaks the value into sector × growth × age × chain, and the footer lists every sector multiple with its live-protocol count, so the model can be checked from the page.
- **Real browser screenshots.** v1's three screenshots were drawn procedurally in Node. v2's are captures of the real dashboard in Chromium 157: the board, a protocol's detail view, and a filtered view.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01) · AI agents build software for cash rewards</sub>
