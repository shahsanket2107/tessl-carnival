import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const GRID_SIZE = 3;
export const HOLE_COUNT = GRID_SIZE * GRID_SIZE;
export const MOLE_POINTS = 1;
export const GOLDEN_POINTS = 5;
export const GOLDEN_CHANCE = 0.1;
/** Every this many whacks in a row adds one more bonus point to each whack. */
export const COMBO_STEP = 3;
const FIRST_SPAWN = 0.5;
const HIT_FLASH = 0.25;

const HOLE_SPACING_X = 200;
const HOLE_SPACING_Y = 120;
const HOLE_RADIUS = 50;
const GRID_TOP = 140;

/** Returns a number in [0, 1), like Math.random. Tests pass their own. */
export type Random = () => number;

export interface Mole {
  golden: boolean;
  /** Seconds before the mole ducks back down. */
  timeLeft: number;
}

export interface Flash {
  hole: number;
  points: number;
  age: number;
}

export interface WhackAMoleState {
  /** One entry per hole, left to right and top to bottom; null when empty. */
  holes: (Mole | null)[];
  flashes: Flash[];
  elapsed: number;
  spawnTimer: number;
  score: number;
  streak: number;
  /** The hole Space whacks; the arrow keys move it. */
  cursor: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  return {
    holes: Array.from({ length: HOLE_COUNT }, () => null),
    flashes: [],
    elapsed: 0,
    spawnTimer: FIRST_SPAWN,
    score: 0,
    streak: 0,
    cursor: Math.floor(HOLE_COUNT / 2),
    phase: 'playing',
  };
}

/** How far through the round we are, from 0 at the start to 1 at the end. */
function progress(elapsed: number): number {
  return Math.min(Math.max(elapsed / ROUND_SECONDS, 0), 1);
}

/** Seconds between moles: 0.9 at the start of the round, down to 0.4 at the end. */
export function spawnInterval(elapsed: number): number {
  return 0.9 - 0.5 * progress(elapsed);
}

/** Seconds a mole stays up: 1.2 at the start of the round, down to 0.6 at the end. Golden moles stay up half as long. */
export function upTime(elapsed: number, golden = false): number {
  const time = 1.2 - 0.6 * progress(elapsed);
  return golden ? time / 2 : time;
}

/** Points for a whack that makes the streak `streak` long. */
export function scoreForWhack(golden: boolean, streak: number): number {
  return (golden ? GOLDEN_POINTS : MOLE_POINTS) + Math.floor(streak / COMBO_STEP);
}

/** Pops a mole up from a random empty hole. Returns the hole, or -1 if every hole is taken. */
export function spawnMole(state: WhackAMoleState, random: Random): number {
  const empty = state.holes.flatMap((mole, i) => (mole ? [] : [i]));
  if (empty.length === 0) return -1;
  const hole = empty[Math.floor(random() * empty.length)];
  const golden = random() < GOLDEN_CHANCE;
  state.holes[hole] = { golden, timeLeft: upTime(state.elapsed, golden) };
  return hole;
}

/** Whacks a hole. Returns the points scored; an empty hole scores 0 and breaks the streak. */
export function whack(state: WhackAMoleState, hole: number): number {
  if (state.phase !== 'playing' || hole < 0 || hole >= HOLE_COUNT) return 0;
  const mole = state.holes[hole];
  if (!mole) {
    state.streak = 0;
    return 0;
  }
  state.streak += 1;
  const points = scoreForWhack(mole.golden, state.streak);
  state.score += points;
  state.holes[hole] = null;
  state.flashes.push({ hole, points, age: 0 });
  return points;
}

/** Moves the keyboard cursor one hole in a direction, stopping at the edge of the grid. */
export function moveCursor(state: WhackAMoleState, dx: number, dy: number): void {
  const col = Math.min(Math.max((state.cursor % GRID_SIZE) + dx, 0), GRID_SIZE - 1);
  const row = Math.min(Math.max(Math.floor(state.cursor / GRID_SIZE) + dy, 0), GRID_SIZE - 1);
  state.cursor = row * GRID_SIZE + col;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: Random): void {
  for (const flash of state.flashes) flash.age += dt;
  state.flashes = state.flashes.filter((f) => f.age < HIT_FLASH);
  if (state.phase !== 'playing') return;

  state.elapsed = Math.min(state.elapsed + dt, ROUND_SECONDS);
  if (state.elapsed >= ROUND_SECONDS) {
    state.holes = state.holes.map(() => null);
    state.phase = 'over';
    return;
  }

  state.holes = state.holes.map((mole) => {
    if (!mole) return null;
    mole.timeLeft -= dt;
    return mole.timeLeft > 0 ? mole : null;
  });

  state.spawnTimer -= dt;
  while (state.spawnTimer <= 0) {
    spawnMole(state, random);
    state.spawnTimer += spawnInterval(state.elapsed);
  }
}

/** The centre of a hole on the canvas. */
export function holeCenter(hole: number): { x: number; y: number } {
  const col = hole % GRID_SIZE;
  const row = Math.floor(hole / GRID_SIZE);
  return {
    x: WIDTH / 2 + (col - 1) * HOLE_SPACING_X,
    y: GRID_TOP + row * HOLE_SPACING_Y,
  };
}

/** The hole under a canvas point, or -1 if the point misses every hole. */
export function holeAt(x: number, y: number): number {
  for (let hole = 0; hole < HOLE_COUNT; hole++) {
    const center = holeCenter(hole);
    if (Math.hypot(x - center.x, y - center.y) <= HOLE_RADIUS) return hole;
  }
  return -1;
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (let hole = 0; hole < HOLE_COUNT; hole++) {
    const { x, y } = holeCenter(hole);
    const mole = state.holes[hole];

    // The hole's rim and its dark opening.
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.ellipse(x, y + 20, HOLE_RADIUS, HOLE_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(x, y + 20, HOLE_RADIUS * 0.8, HOLE_RADIUS * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (mole) {
      ctx.fillStyle = mole.golden ? colors.accent : colors.wood;
      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS * 0.6, Math.PI, 0);
      ctx.lineTo(x + HOLE_RADIUS * 0.6, y + 20);
      ctx.lineTo(x - HOLE_RADIUS * 0.6, y + 20);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(x - 10, y - 8, 5, 0, Math.PI * 2);
      ctx.arc(x + 10, y - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(x, y + 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = colors.muted;
    ctx.font = canvasFont('small');
    ctx.textAlign = 'center';
    ctx.fillText(String(hole + 1), x, y + 56);

    if (hole === state.cursor && state.phase === 'playing') {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 10, HOLE_RADIUS + 6, HOLE_RADIUS * 0.9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  for (const flash of state.flashes) {
    const { x, y } = holeCenter(flash.hole);
    ctx.globalAlpha = 1 - flash.age / HIT_FLASH;
    ctx.fillStyle = colors.danger;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`+${flash.points}`, x, y - 30 - flash.age * 80);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'center';
  ctx.fillText(`Streak ${state.streak}`, WIDTH / 2, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(ROUND_SECONDS - state.elapsed)}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the moles before they duck. Streaks build a combo, and golden moles score big.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const restart = () => {
      state = createState();
      scoreRecorded = false;
    };

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        restart();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      const hole = holeAt(x, y);
      if (hole >= 0) {
        state.cursor = hole;
        whack(state, hole);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const move = KEY_MOVES[event.key];
      if (move) {
        event.preventDefault();
        moveCursor(state, move[0], move[1]);
      } else if (event.key === ' ') {
        event.preventDefault();
        if (state.phase === 'over') restart();
        else whack(state, state.cursor);
      } else if (/^[1-9]$/.test(event.key)) {
        state.cursor = Number(event.key) - 1;
        whack(state, state.cursor);
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt, Math.random);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default whackAMole;
