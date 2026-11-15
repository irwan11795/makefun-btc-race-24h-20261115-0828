# makefun-btc-race-24h-20261115-0828

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/irwan11795/makefun-btc-race-24h-20261115-0828/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/irwan11795/makefun-btc-race-24h-20261115-0828/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Single-leg washout scalp bot for make.fun `btc-race-24h-20261115-0828` (race a BTC trading bot live for 24 hours, $250 in USDC, top 10 paid). It buys cbBTC when the 240-bar (4h) return falls to −3.00% or worse, sells at +0.80% net over cost, stops at −3.00%, or after 500 bars. Long only, one position, whole equity per trade, bigint integer math, deterministic, no network, no clock.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=2wht1jqa&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>

## Strategy

| Parameter | Value |
|---|---|
| Trigger | 240-bar return ≤ −300 bps (−3.00%) |
| Take profit | +80 bps net over cost |
| Stop loss | −300 bps net |
| Max hold | 500 bars |
| Position | Whole equity, long only, one position at a time |
| Slippage cap | 100 bps |

No rebuy, no range leg: on this competition's dev window the v15 structure (washout + rebuy + range) scores −$12.85, its rebuy leg alone loses ~−$32 and its range leg ~−$10. The single washout leg is the only one that wins here.

## Calibration — real live market, not just the frozen dev window

The −3.00% trigger was calibrated against real market data fetched 2026-11-15 ~08:50 UTC: Coinbase BTC-USD 1m candles (last 24h + previous 24h) and Kraken XBTUSD 1m (721 bars), plus the frozen dev window and the previous race's dev window (5 windows total). The 1.5%–2.2% triggers suggested by the previous race LOSE on every washout day (wd200: −$53.25 dev / −$49.60 real; turn confirmation, tighter stop and shorter hold do not rescue them) — they buy every leg of a grinding decline. −3.00% is positive on all five windows and 13/13 positive in the noise/shift suite on both the dev window (avg +$24.42, worst +$21.01) and the real Coinbase window (avg +$26.98, worst +$24.16).

## Verification

- **Official harness (`grade-local --driver process`, this competition's kit): net PnL +$22.543809, 6 trades, win rate 1.0, max drawdown 1.37%, fees $2.43 (at 2x fees +$20.11). L1 regrade reproduced byte for byte.** action_log_sha256 `b787da15d3ebdd02a8b51f8aca12255f17f99f872612f442619b48df9a4310cf`, result_sha256 `02221928b4db053f4a0571a3615f62a3447c7411dbbef24f2ce16afd3ed8390b`.
- Backtester (faithful net-value sim): dev clean +$22.46, 6 trades; real Coinbase last-24h +$26.69, 8 trades.
- Dev gate (net PnL > $0 after fees): PASSED.
