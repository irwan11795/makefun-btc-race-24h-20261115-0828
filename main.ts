// Single-leg washout scalp BTC bot v1 for make.fun btc-race-24h-20261115-0828.
//
// Lineage: a descendant of v15 (btc-race-24h-20261113-2314, dev +$41.65,
// live final #399 -$12.85). v15's full structure (washout scalp + higher-low
// rebuy + range scalp/rebuy) LOSES on this competition's dev window:
// v15-as-is scores -$12.85 on the new window (4 trades), and -$1.07 on the
// real Coinbase BTC-USD last-24h window. Its rebuy leg alone loses ~-$32
// (buy 654 -> sell 823 in the grinding decline) and its range-dip leg loses
// ~-$10 (buy 767 -> sell 944). This v1 therefore ships ONLY the leg that
// wins on this window: the washout scalp, re-tuned.
//
// Strategy (long only, one position, whole equity per trade, bigint integer
// math only, no floats, no clock, no network, no randomness):
//
// 1. WASHOUT (scalp) -- the 240-bar (4h) return falls to -3.00% or worse:
//    buy the washout, sell at +0.80% over cost (net value), stop at -3.00%,
//    or after 500 bars. No rebuy, no range leg: on this window both add
//    losing trades (see above).
//
// Why -3.00% and not the 1.5%-2.2% the previous race suggested:
// the threshold was calibrated against REAL live market, per the standing
// rule -- Coinbase BTC-USD 1m candles (public REST, fetched 2026-11-15
// ~08:50 UTC: last 24h + previous 24h, 2,999 bars) and Kraken XBTUSD 1m
// (721 bars), plus the frozen dev window and the previous race's dev window
// (5 windows total). In the W-only structure the 1.5%-2.2% triggers LOSE
// on every washout day: wd150 -$58.90 dev / -$47.57 real, wd180 -$48.78 /
// -$45.22, wd200 -$53.25 / -$49.60, wd220 -$55.90 / -$52.11. Rescue variants
// (turn-up confirmation, tighter stop -1.50%, shorter hold 120 bars) all
// still lose -$21 to -$60 on both washout days. A 1.5%-2.2% trigger buys
// every leg of a grinding decline -- a falling knife, not a washout.
// The -3.00% trigger only fires on genuine washouts: it is positive on
// ALL five windows (dev +$22.46, real CB24 +$26.69, real CBPREV $0.00 with
// no trade on the quiet -2.39% day, real KR12 +$6.28, old window +$1.05)
// and 13/13 positive in the noise/shift suite on BOTH the dev window
// (avg +$24.42, worst +$21.01) and the real CB24 window (avg +$26.98,
// worst +$24.16). TP +0.80% (not +1.00%): +1.00% is fragile on noise
// (dev suite worst -$55.17, holdout -$48.66 on one seed); +0.80% never
// loses a scenario. Hold 500 bars is a backstop only -- every clean-window
// exit hits the TP or the stop first.
//
// Verification (faithful net-value backtester, same fill model as the
// official harness: 4 bps fee + 2 bps slippage + depth impact):
// dev window clean +$22.46, 6 trades, max DD 1.37%; real Coinbase last-24h
// clean +$26.69, 8 trades, max DD 1.51%. Trades (decision bars, dev):
// buy 422 -> sell 551, buy 821 -> sell 945, buy 1015 -> sell 1059
// (3 round trips, all TP exits). Official harness grade to follow in
// ../v1-grade/ (grade-local --driver process on this competition's kit).
//
// Risk control: at most one open position, whole-equity buys only (never
// leveraged, never short), every order capped at 100 bps of slippage from
// the latest close, and every position carries a stop (-3.00%) and a
// maximum hold (500 bars).
//
// ENTRYPOINT: this repository ships ONLY main.ts. There is NO main.py --
// v5 was REJECTED by the server ("the snapshot has both main.ts and main.py
// at its root: keep one entrypoint"). When pushing, VERIFY main.py is still
// absent from the remote repo.

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// --- washout trigger: 240-bar return at or below -300 bps ------------------
// Calibrated to real live market (see header): -300 bps is the shallowest
// trigger that is positive on all five test windows (dev, real CB24, real
// CBPREV, real KR12, old dev window). Shallower triggers (150-250 bps)
// lose on every washout day -- they buy every leg of a grinding decline.
const WASH_LOOKBACK = 240;
const WASH_DROP_BPS = 300n;
const WASH_EXIT_BPS = 80n;
const WASH_STOP_BPS = 300n;
const WASH_MAX_HOLD = 500;

const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first (raw price bigints; null on a missing bar). */
const closes: (bigint | null)[] = [];
/** Whether the washout position is open. */
let mode: 'W' | null = null;
/** Batches held (counted from the first batch that reports the position). */
let heldBars = 0;

/** The 240-bar return in bps, or null before 241 closes (integer math). */
function ret240(): bigint | null {
  if (closes.length < WASH_LOOKBACK + 1) return null;
  const now = closes[closes.length - 1]!;
  const then = closes[closes.length - 1 - WASH_LOOKBACK]!;
  if (now === null || then === null) return null;
  return ((now - then) * BPS) / then;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    // Only decide on a batch that carries a fresh bar for our symbol.
    let bar = undefined;
    for (const b of batch.bars) {
      if (b.symbol === SYMBOL) bar = b;
    }
    if (bar === undefined) return [];
    closes.push(BigInt(bar.c));
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held === undefined) {
      mode = null;
      heldBars = 0;
    } else {
      heldBars += 1;
    }

    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    if (held !== undefined) {
      // --- exit the open position --------------------------------------
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      const isTP = value * BPS >= cost * (BPS + WASH_EXIT_BPS);
      const isStop = value * BPS <= cost * (BPS - WASH_STOP_BPS);
      const isHold = heldBars >= WASH_MAX_HOLD;
      if (isTP || isStop || isHold) {
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // --- entry (flat): buy the washout -----------------------------------
    const r240 = ret240();
    if (r240 === null || r240 > -WASH_DROP_BPS) return [];

    const room = state.weightRoom(SYMBOL);
    const spend = state.cash < room ? state.cash : room;
    if (spend < minNotional) return [];
    mode = 'W';
    heldBars = 0;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
