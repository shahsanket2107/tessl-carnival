import { describe, expect, it } from 'vitest';
import {
  BELL_BONUS,
  BELL_HEIGHT,
  FLIGHT_TIME,
  METER_PERIOD,
  SWEET_SPOT,
  SWINGS_PER_ROUND,
  bellBonus,
  bestRank,
  createState,
  isSweetSpot,
  meterLevel,
  puckHeight,
  rankFor,
  step,
  swing,
  swingHeight,
} from './game';

/** Sets the meter so the next swing lands at `level` on the way up. */
function aimAt(state: ReturnType<typeof createState>, level: number) {
  state.meterTime = (level * METER_PERIOD) / 2;
}

function swingAt(state: ReturnType<typeof createState>, level: number) {
  aimAt(state, level);
  swing(state);
  step(state, FLIGHT_TIME);
}

describe('high striker', () => {
  it('starts aiming with no swings and no score', () => {
    const state = createState();
    expect(state.phase).toBe('aiming');
    expect(state.swings).toHaveLength(0);
    expect(state.score).toBe(0);
  });

  describe('the meter', () => {
    it('sweeps from the bottom to the top and back', () => {
      expect(meterLevel(0)).toBe(0);
      expect(meterLevel(METER_PERIOD / 4)).toBeCloseTo(0.5);
      expect(meterLevel(METER_PERIOD / 2)).toBeCloseTo(1);
      expect(meterLevel((METER_PERIOD * 3) / 4)).toBeCloseTo(0.5);
      expect(meterLevel(METER_PERIOD)).toBeCloseTo(0);
    });

    it('keeps sweeping while the player aims', () => {
      const state = createState();
      step(state, METER_PERIOD / 4);
      expect(meterLevel(state.meterTime)).toBeCloseTo(0.5);
    });
  });

  describe('swing height', () => {
    it('barely moves the puck from the bottom of the meter', () => {
      expect(swingHeight(0)).toBe(0);
      expect(swingHeight(0.1)).toBe(1);
    });

    it('sends the puck a quarter of the way from the middle', () => {
      expect(swingHeight(0.5)).toBe(25);
    });

    it('gets close to the bell just below the sweet spot', () => {
      expect(swingHeight(0.94)).toBe(88);
      expect(swingHeight(0.94)).toBeLessThan(BELL_HEIGHT);
    });

    it('reaches the bell from the sweet spot and the top', () => {
      expect(swingHeight(SWEET_SPOT)).toBe(BELL_HEIGHT);
      expect(swingHeight(1)).toBe(BELL_HEIGHT);
    });

    it('goes higher the closer to the top the press lands', () => {
      const heights = [0, 0.25, 0.5, 0.75, 1].map(swingHeight);
      expect(heights).toEqual([...heights].sort((a, b) => a - b));
    });
  });

  describe('the bell', () => {
    it('only rings in the sweet spot at the very top', () => {
      expect(isSweetSpot(1)).toBe(true);
      expect(isSweetSpot(SWEET_SPOT)).toBe(true);
      expect(isSweetSpot(0.94)).toBe(false);
      expect(isSweetSpot(0.5)).toBe(false);
      expect(isSweetSpot(0)).toBe(false);
    });

    it('gives a bonus only in the sweet spot', () => {
      expect(bellBonus(1)).toBe(BELL_BONUS);
      expect(bellBonus(0.94)).toBe(0);
      expect(bellBonus(0)).toBe(0);
    });

    it('adds the bonus to a sweet-spot swing', () => {
      const state = createState();
      aimAt(state, 1);
      swing(state);
      expect(state.swings[0]).toMatchObject({ height: BELL_HEIGHT, bell: true });
      expect(state.score).toBe(BELL_HEIGHT + BELL_BONUS);
    });
  });

  describe('ranks', () => {
    it('labels each height on the tower', () => {
      expect(rankFor(0)).toBe('Weakling');
      expect(rankFor(19)).toBe('Weakling');
      expect(rankFor(20)).toBe('Lightweight');
      expect(rankFor(25)).toBe('Lightweight');
      expect(rankFor(40)).toBe('Not Bad');
      expect(rankFor(60)).toBe('Strongman');
      expect(rankFor(88)).toBe('Hercules');
      expect(rankFor(BELL_HEIGHT)).toBe('Champion');
    });

    it('matches the height the meter gives', () => {
      expect(rankFor(swingHeight(0))).toBe('Weakling');
      expect(rankFor(swingHeight(0.5))).toBe('Lightweight');
      expect(rankFor(swingHeight(1))).toBe('Champion');
    });

    it('uses the highest swing for the round', () => {
      const state = createState();
      expect(bestRank(state)).toBeUndefined();
      swingAt(state, 0.5);
      swingAt(state, 1);
      swingAt(state, 0);
      expect(bestRank(state)).toBe('Champion');
    });
  });

  describe('a round', () => {
    it('flies the puck up and back down after a swing', () => {
      const state = createState();
      aimAt(state, 0.5);
      swing(state);
      expect(state.phase).toBe('flying');
      step(state, FLIGHT_TIME / 2);
      expect(puckHeight(state)).toBeCloseTo(25);
      step(state, FLIGHT_TIME / 2);
      expect(state.phase).toBe('aiming');
      expect(puckHeight(state)).toBe(0);
    });

    it('ignores a swing while the puck is in the air', () => {
      const state = createState();
      swing(state);
      expect(swing(state)).toBe(false);
      expect(state.swings).toHaveLength(1);
    });

    it('ends after three swings, scoring the sum of the heights plus bonuses', () => {
      const state = createState();
      swingAt(state, 0.5);
      swingAt(state, 1);
      expect(state.phase).toBe('aiming');
      swingAt(state, 0.1);
      expect(state.swings).toHaveLength(SWINGS_PER_ROUND);
      expect(state.phase).toBe('over');
      expect(state.score).toBe(25 + BELL_HEIGHT + BELL_BONUS + 1);
    });

    it('cannot swing once the round is over', () => {
      const state = createState();
      for (let i = 0; i < SWINGS_PER_ROUND; i++) swingAt(state, 1);
      expect(swing(state)).toBe(false);
      expect(state.swings).toHaveLength(SWINGS_PER_ROUND);
    });
  });
});
