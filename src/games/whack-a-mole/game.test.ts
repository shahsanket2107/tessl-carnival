import { describe, expect, it } from 'vitest';
import {
  COMBO_STEP,
  GOLDEN_POINTS,
  HOLE_COUNT,
  MOLE_POINTS,
  ROUND_SECONDS,
  createState,
  holeAt,
  holeCenter,
  moveCursor,
  scoreForWhack,
  spawnInterval,
  spawnMole,
  step,
  upTime,
  whack,
  whackAMole,
  type Random,
} from './game';

/** A random source that returns the given values in turn, then repeats the last. */
function sequence(...values: number[]): Random {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const plainMole = { golden: false, timeLeft: 1 };
const goldenMole = { golden: true, timeLeft: 1 };

describe('whack-a-mole', () => {
  it('uses its folder name as its id', () => {
    expect(whackAMole.id).toBe('whack-a-mole');
  });

  it('starts with empty holes, no score and the full round ahead', () => {
    const state = createState();
    expect(state.holes).toHaveLength(HOLE_COUNT);
    expect(state.holes.every((mole) => mole === null)).toBe(true);
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.elapsed).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('ends the round after 30 seconds and clears the holes', () => {
    const state = createState();
    const random = sequence(0.5, 0.9);
    for (let t = 0; t < ROUND_SECONDS - 0.05; t += 0.05) step(state, 0.05, random);
    expect(state.phase).toBe('playing');
    step(state, 0.1, random);
    expect(state.phase).toBe('over');
    expect(state.elapsed).toBe(ROUND_SECONDS);
    expect(state.holes.every((mole) => mole === null)).toBe(true);
  });

  it('spawns moles faster and keeps them up for less time as the round goes on', () => {
    expect(spawnInterval(0)).toBeCloseTo(0.9);
    expect(spawnInterval(ROUND_SECONDS)).toBeCloseTo(0.4);
    expect(spawnInterval(20)).toBeLessThan(spawnInterval(10));
    expect(upTime(0)).toBeCloseTo(1.2);
    expect(upTime(ROUND_SECONDS)).toBeCloseTo(0.6);
    expect(upTime(20)).toBeLessThan(upTime(10));
  });

  it('keeps golden moles up for the shortest time', () => {
    expect(upTime(0, true)).toBeLessThan(upTime(0));
    expect(upTime(ROUND_SECONDS, true)).toBeLessThan(upTime(ROUND_SECONDS));
  });

  it('pops a mole up from a random empty hole', () => {
    const state = createState();
    expect(spawnMole(state, sequence(0, 0.9))).toBe(0);
    expect(state.holes[0]).toEqual({ golden: false, timeLeft: upTime(0) });
    // Hole 0 is taken, so the lowest roll now lands on hole 1.
    expect(spawnMole(state, sequence(0, 0.9))).toBe(1);
  });

  it('makes a mole golden on a low roll', () => {
    const state = createState();
    const hole = spawnMole(state, sequence(0.99, 0));
    expect(hole).toBe(HOLE_COUNT - 1);
    expect(state.holes[hole]).toEqual({ golden: true, timeLeft: upTime(0, true) });
  });

  it('spawns nothing when every hole is taken', () => {
    const state = createState();
    state.holes = state.holes.map(() => ({ ...plainMole }));
    expect(spawnMole(state, sequence(0.5))).toBe(-1);
  });

  it('spawns the first mole half a second into the round', () => {
    const state = createState();
    const random = sequence(0.5, 0.9);
    step(state, 0.4, random);
    expect(state.holes.filter(Boolean)).toHaveLength(0);
    step(state, 0.2, random);
    expect(state.holes.filter(Boolean)).toHaveLength(1);
  });

  it('ducks a mole back down when its time is up', () => {
    const state = createState();
    state.spawnTimer = 100;
    state.holes[4] = { golden: false, timeLeft: 0.3 };
    step(state, 0.2, sequence(0.5));
    expect(state.holes[4]).not.toBeNull();
    step(state, 0.2, sequence(0.5));
    expect(state.holes[4]).toBeNull();
  });

  it('scores a point for a whack and clears the hole', () => {
    const state = createState();
    state.holes[2] = { ...plainMole };
    expect(whack(state, 2)).toBe(MOLE_POINTS);
    expect(state.score).toBe(MOLE_POINTS);
    expect(state.streak).toBe(1);
    expect(state.holes[2]).toBeNull();
  });

  it('scores extra for a golden mole', () => {
    const state = createState();
    state.holes[2] = { ...goldenMole };
    expect(whack(state, 2)).toBe(GOLDEN_POINTS);
    expect(GOLDEN_POINTS).toBeGreaterThan(MOLE_POINTS);
  });

  it('adds a combo bonus for every three whacks in a row', () => {
    expect(scoreForWhack(false, 1)).toBe(MOLE_POINTS);
    expect(scoreForWhack(false, COMBO_STEP - 1)).toBe(MOLE_POINTS);
    expect(scoreForWhack(false, COMBO_STEP)).toBe(MOLE_POINTS + 1);
    expect(scoreForWhack(false, COMBO_STEP * 2)).toBe(MOLE_POINTS + 2);
    expect(scoreForWhack(true, COMBO_STEP)).toBe(GOLDEN_POINTS + 1);

    const state = createState();
    for (let hole = 0; hole < 3; hole++) {
      state.holes[hole] = { ...plainMole };
      whack(state, hole);
    }
    expect(state.score).toBe(1 + 1 + 2);
  });

  it('breaks the streak when an empty hole is whacked', () => {
    const state = createState();
    state.holes[0] = { ...plainMole };
    state.holes[1] = { ...plainMole };
    whack(state, 0);
    whack(state, 1);
    expect(state.streak).toBe(2);
    expect(whack(state, 5)).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.score).toBe(2);
  });

  it('ignores whacks once the round is over', () => {
    const state = createState();
    state.holes[0] = { ...plainMole };
    state.phase = 'over';
    expect(whack(state, 0)).toBe(0);
    expect(state.score).toBe(0);
  });

  it('moves the keyboard cursor around the grid and stops at the edges', () => {
    const state = createState();
    expect(state.cursor).toBe(4);
    moveCursor(state, 1, 0);
    expect(state.cursor).toBe(5);
    moveCursor(state, 1, 0);
    expect(state.cursor).toBe(5);
    moveCursor(state, 0, -1);
    expect(state.cursor).toBe(2);
    moveCursor(state, -1, 1);
    expect(state.cursor).toBe(4);
  });

  it('finds the hole under a click', () => {
    for (let hole = 0; hole < HOLE_COUNT; hole++) {
      const { x, y } = holeCenter(hole);
      expect(holeAt(x, y)).toBe(hole);
    }
    expect(holeAt(0, 0)).toBe(-1);
  });
});
