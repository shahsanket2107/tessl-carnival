import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BALLS_PER_ROUND = 9;
export const BALL_RADIUS = 10;
export const LANE = { left: 250, right: 550 } as const;
/** Where every ball starts its roll. */
export const LAUNCH_Y = 470;
/** How far a ball at full power rolls up the lane, in pixels. */
export const MAX_TRAVEL = 450;
/** The lip of the ramp. A ball that stops below it rolls back into the gutter. */
export const RAMP_Y = 320;
/** The top of the board. A ball that would roll past it bounces over the rings. */
export const BOARD_TOP = 40;
/** Seconds for the power meter to swing from empty to full and back. */
export const METER_PERIOD = 1.6;
export const ROLL_TIME = 0.7;
const MOVE_SPEED = 320;

export interface Ring {
  x: number;
  y: number;
  radius: number;
  points: number;
}

/**
 * The scoring rings, biggest first. Each smaller ring sits higher up the
 * board, so the 50 is a small ring at the top.
 */
export const RINGS: readonly Ring[] = [
  { x: 400, y: 190, radius: 120, points: 10 },
  { x: 400, y: 170, radius: 90, points: 20 },
  { x: 400, y: 150, radius: 62, points: 30 },
  { x: 400, y: 128, radius: 38, points: 40 },
  { x: 400, y: 108, radius: 16, points: 50 },
];

/** The two bonus pockets in the top corners. */
export const POCKETS: readonly Ring[] = [
  { x: 290, y: 60, radius: 16, points: 100 },
  { x: 510, y: 60, radius: 16, points: 100 },
];

export type RollOutcome = 'gutter' | 'over' | 'miss' | 'ring' | 'pocket';

export interface RollResult {
  x: number;
  y: number;
  outcome: RollOutcome;
  points: number;
}

export interface Roll {
  /** Seconds since the ball was released. */
  t: number;
  result: RollResult;
}

export interface SkeeBallState {
  ballX: number;
  charging: boolean;
  /** Seconds the power meter has been charging. */
  chargeTime: number;
  ballsLeft: number;
  score: number;
  roll: Roll | null;
  last: RollResult | null;
  phase: 'playing' | 'over';
}

export function createState(): SkeeBallState {
  return {
    ballX: WIDTH / 2,
    charging: false,
    chargeTime: 0,
    ballsLeft: BALLS_PER_ROUND,
    score: 0,
    roll: null,
    last: null,
    phase: 'playing',
  };
}

/** The power meter swings from 0 up to 1 and back down again, over and over. */
export function meterPower(chargeTime: number): number {
  const phase = (chargeTime % METER_PERIOD) / METER_PERIOD;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/** The ball's start keeps it on the lane. */
export function clampBallX(x: number): number {
  return Math.min(Math.max(x, LANE.left + BALL_RADIUS), LANE.right - BALL_RADIUS);
}

/** Points for a ball that comes to rest at (x, y): the smallest ring or pocket it lands in. */
export function scoreAt(x: number, y: number): { outcome: RollOutcome; points: number } {
  const inside = (r: Ring) => Math.hypot(x - r.x, y - r.y) <= r.radius;
  const pocket = POCKETS.find(inside);
  if (pocket) return { outcome: 'pocket', points: pocket.points };
  const rings = RINGS.filter(inside);
  if (rings.length > 0) return { outcome: 'ring', points: rings[rings.length - 1].points };
  return { outcome: 'miss', points: 0 };
}

/**
 * Where a ball rolled from `x` with `power` (0 to 1) ends up. The ball rolls
 * straight up the lane, and power sets how far it goes.
 */
export function rollBall(x: number, power: number): RollResult {
  const p = Math.min(Math.max(power, 0), 1);
  const y = LAUNCH_Y - p * MAX_TRAVEL;
  if (y > RAMP_Y) return { x, y: LAUNCH_Y, outcome: 'gutter', points: 0 };
  if (y < BOARD_TOP) return { x, y: 0, outcome: 'over', points: 0 };
  return { x, y, ...scoreAt(x, y) };
}

export function moveBall(state: SkeeBallState, x: number): void {
  if (state.roll || state.phase !== 'playing') return;
  state.ballX = clampBallX(x);
}

/** Starts charging the power meter. Returns false if there is no ball to roll. */
export function startCharge(state: SkeeBallState): boolean {
  if (state.phase !== 'playing' || state.roll || state.charging || state.ballsLeft === 0) {
    return false;
  }
  state.charging = true;
  state.chargeTime = 0;
  return true;
}

/** Rolls the ball with the meter's current power. Returns false if nothing rolled. */
export function release(state: SkeeBallState): boolean {
  if (!state.charging) return false;
  state.charging = false;
  state.roll = { t: 0, result: rollBall(state.ballX, meterPower(state.chargeTime)) };
  state.ballsLeft -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: SkeeBallState, dt: number): void {
  if (state.charging) state.chargeTime += dt;
  if (state.roll) {
    state.roll.t += dt;
    if (state.roll.t >= ROLL_TIME) {
      state.score += state.roll.result.points;
      state.last = state.roll.result;
      state.roll = null;
    }
  }
  if (state.ballsLeft === 0 && !state.roll) state.phase = 'over';
}

const OUTCOME_TEXT: Record<RollOutcome, string> = {
  gutter: 'Too weak: gutter',
  over: 'Too strong: over the rings',
  miss: 'Missed the rings',
  ring: 'Ring',
  pocket: 'Corner pocket!',
};

function describeRoll(result: RollResult): string {
  return result.points > 0
    ? `${OUTCOME_TEXT[result.outcome]} +${result.points}`
    : OUTCOME_TEXT[result.outcome];
}

/** Where the ball is drawn: on the lane, or part way through its roll. */
function ballPosition(state: SkeeBallState): { x: number; y: number } {
  if (!state.roll) return { x: state.ballX, y: LAUNCH_Y };
  const { result, t } = state.roll;
  const k = Math.min(t / ROLL_TIME, 1);
  if (result.outcome === 'gutter') {
    // Up the lane and back down again.
    const peak = LAUNCH_Y - (LAUNCH_Y - RAMP_Y) * 0.8;
    const up = Math.sin(k * Math.PI);
    return { x: result.x, y: LAUNCH_Y - (LAUNCH_Y - peak) * up };
  }
  const eased = 1 - (1 - k) * (1 - k);
  return { x: result.x, y: LAUNCH_Y + (result.y - LAUNCH_Y) * eased };
}

function draw(ctx: CanvasRenderingContext2D, state: SkeeBallState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 24);
  }

  // The board above the ramp, and the lane below it.
  const laneWidth = LANE.right - LANE.left;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(LANE.left, BOARD_TOP, laneWidth, RAMP_Y - BOARD_TOP);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(LANE.left, RAMP_Y, laneWidth, HEIGHT - RAMP_Y);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(LANE.left, RAMP_Y - 3, laneWidth, 6);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = canvasFont('small', 'bold');
  RINGS.forEach((ring, i) => {
    ctx.fillStyle = i % 2 === 0 ? colors.background : colors.surface;
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  RINGS.forEach((ring, i) => {
    const last = i === RINGS.length - 1;
    ctx.fillStyle = last ? colors.accent : colors.text;
    ctx.fillText(String(ring.points), ring.x, last ? ring.y : ring.y + ring.radius - 12);
  });
  for (const pocket of POCKETS) {
    ctx.fillStyle = colors.stripeA;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.text;
    ctx.fillText(String(pocket.points), pocket.x, pocket.y);
  }

  // The ball.
  if (state.phase === 'playing') {
    const ball = ballPosition(state);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power meter.
  const meter = { x: LANE.right + 40, y: RAMP_Y, w: 22, h: HEIGHT - RAMP_Y - 30 };
  ctx.fillStyle = colors.surface;
  ctx.fillRect(meter.x, meter.y, meter.w, meter.h);
  const power = state.charging ? meterPower(state.chargeTime) : 0;
  ctx.fillStyle = colors.danger;
  ctx.fillRect(meter.x, meter.y + meter.h * (1 - power), meter.w, meter.h * power);
  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.fillText('Power', meter.x + meter.w / 2, meter.y - 14);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.fillText(`Balls ${state.ballsLeft}/${BALLS_PER_ROUND}`, 16, HEIGHT - 48);
  if (state.last) {
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('body');
    ctx.fillText(describeRoll(state.last), 16, 60);
  }
  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.textAlign = 'right';
  ctx.fillText('Arrows or mouse to aim', WIDTH - 16, 60);
  ctx.fillText('Hold Space or the mouse', WIDTH - 16, 82);
  ctx.fillText('button, release to roll', WIDTH - 16, 100);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Nine balls rolled! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const skeeBall: CarnivalGame = {
  id: 'skee-ball',
  name: 'Skee-Ball',
  description: 'Roll nine balls up the lane. The small rings at the top score the most.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const held = { left: false, right: false };

    const restart = () => {
      state = createState();
      scoreRecorded = false;
    };
    const toCanvasX = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * WIDTH;
    };
    const onPointerMove = (event: PointerEvent) => moveBall(state, toCanvasX(event));
    const onPointerDown = (event: PointerEvent) => {
      if (state.phase === 'over') return restart();
      moveBall(state, toCanvasX(event));
      startCharge(state);
    };
    const onPointerUp = () => release(state);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.left = true;
      else if (event.key === 'ArrowRight') held.right = true;
      else if (event.key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        if (state.phase === 'over') restart();
        else startCharge(state);
      } else return;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.left = false;
      else if (event.key === 'ArrowRight') held.right = false;
      else if (event.key === ' ') release(state);
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      const direction = Number(held.right) - Number(held.left);
      if (direction !== 0) moveBall(state, state.ballX + direction * MOVE_SPEED * dt);
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(skeeBall.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  },
};

export default skeeBall;
