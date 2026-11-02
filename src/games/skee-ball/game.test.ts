import { describe, expect, it } from 'vitest';
import {
  BALLS_PER_ROUND,
  LANE,
  LAUNCH_Y,
  MAX_TRAVEL,
  METER_PERIOD,
  POCKETS,
  RINGS,
  ROLL_TIME,
  clampBallX,
  createState,
  meterPower,
  moveBall,
  release,
  rollBall,
  scoreAt,
  startCharge,
  step,
} from './game';

/** The power that rolls a ball up to `y`. */
const powerFor = (y: number) => (LAUNCH_Y - y) / MAX_TRAVEL;

/** Charges the meter for `seconds`, releases, and lets the ball land. */
function rollWithCharge(state: ReturnType<typeof createState>, seconds: number) {
  startCharge(state);
  step(state, seconds);
  release(state);
  step(state, ROLL_TIME);
}

describe('skee-ball', () => {
  it('starts with nine balls and no score', () => {
    const state = createState();
    expect(state.ballsLeft).toBe(BALLS_PER_ROUND);
    expect(BALLS_PER_ROUND).toBe(9);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('swings the power meter up to full and back down', () => {
    expect(meterPower(0)).toBe(0);
    expect(meterPower(METER_PERIOD / 4)).toBeCloseTo(0.5);
    expect(meterPower(METER_PERIOD / 2)).toBeCloseTo(1);
    expect(meterPower((METER_PERIOD * 3) / 4)).toBeCloseTo(0.5);
    expect(meterPower(METER_PERIOD)).toBeCloseTo(0);
  });

  it('rolls further with more power', () => {
    const near = rollBall(400, 0.5);
    const far = rollBall(400, 0.7);
    expect(far.y).toBeLessThan(near.y);
  });

  it('sends a weak roll back into the gutter for 0', () => {
    expect(rollBall(400, 0.1)).toMatchObject({ outcome: 'gutter', points: 0 });
    expect(rollBall(400, 0)).toMatchObject({ outcome: 'gutter', points: 0 });
  });

  it('bounces a too-strong roll over the rings for 0', () => {
    expect(rollBall(400, 1)).toMatchObject({ outcome: 'over', points: 0 });
  });

  it('scores 50 for a perfect roll into the top ring', () => {
    const top = RINGS[RINGS.length - 1];
    expect(rollBall(top.x, powerFor(top.y))).toMatchObject({ outcome: 'ring', points: 50 });
  });

  it('scores each ring for a ball that lands in it and none smaller', () => {
    expect(RINGS.map((r) => r.points)).toEqual([10, 20, 30, 40, 50]);
    RINGS.forEach((ring, i) => {
      // Just inside the bottom edge of this ring, which is below every smaller ring.
      const y = ring.y + ring.radius - 2;
      const smaller = RINGS.slice(i + 1);
      expect(smaller.every((r) => Math.hypot(ring.x - r.x, y - r.y) > r.radius)).toBe(true);
      expect(scoreAt(ring.x, y)).toEqual({ outcome: 'ring', points: ring.points });
      expect(rollBall(ring.x, powerFor(y)).points).toBe(ring.points);
    });
  });

  it('scores a bonus in each corner pocket', () => {
    for (const pocket of POCKETS) {
      expect(rollBall(pocket.x, powerFor(pocket.y))).toMatchObject({
        outcome: 'pocket',
        points: 100,
      });
    }
  });

  it('scores 0 for a ball that reaches the board but misses every ring', () => {
    expect(scoreAt(LANE.left + 12, 200)).toEqual({ outcome: 'miss', points: 0 });
  });

  it('keeps the ball on the lane', () => {
    expect(clampBallX(0)).toBeGreaterThan(LANE.left);
    expect(clampBallX(10_000)).toBeLessThan(LANE.right);
    const state = createState();
    moveBall(state, 300);
    expect(state.ballX).toBe(300);
  });

  it('uses the meter power at release to decide the roll', () => {
    const state = createState();
    const top = RINGS[RINGS.length - 1];
    // Charge until the meter reads the perfect power on its way up.
    rollWithCharge(state, (powerFor(top.y) * METER_PERIOD) / 2);
    expect(state.score).toBe(50);
    expect(state.ballsLeft).toBe(BALLS_PER_ROUND - 1);
  });

  it('cannot roll a second ball while one is rolling', () => {
    const state = createState();
    startCharge(state);
    release(state);
    expect(startCharge(state)).toBe(false);
    expect(release(state)).toBe(false);
    expect(state.ballsLeft).toBe(BALLS_PER_ROUND - 1);
  });

  it('ends the round after the ninth ball lands', () => {
    const state = createState();
    for (let i = 0; i < BALLS_PER_ROUND - 1; i++) rollWithCharge(state, 0);
    expect(state.phase).toBe('playing');
    startCharge(state);
    release(state);
    step(state, 0);
    expect(state.phase).toBe('playing');
    step(state, ROLL_TIME);
    expect(state.phase).toBe('over');
    expect(startCharge(state)).toBe(false);
  });

  it('adds every ball to the total', () => {
    const state = createState();
    const top = RINGS[RINGS.length - 1];
    for (let i = 0; i < BALLS_PER_ROUND; i++) {
      rollWithCharge(state, (powerFor(top.y) * METER_PERIOD) / 2);
    }
    expect(state.phase).toBe('over');
    expect(state.score).toBe(50 * BALLS_PER_ROUND);
  });
});
