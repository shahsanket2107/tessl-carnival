import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const SWINGS_PER_ROUND = 3;
/** Seconds for the meter to sweep from the bottom to the top and back. */
export const METER_PERIOD = 1.6;
/** Meter levels at or above this ring the bell. */
export const SWEET_SPOT = 0.95;
export const BELL_HEIGHT = 100;
export const BELL_BONUS = 50;
/** Seconds the puck takes to rise and fall back. */
export const FLIGHT_TIME = 1.2;

/** Lowest height for each rank, from the top of the tower down. */
export const RANKS = [
  { min: 100, label: 'Champion' },
  { min: 80, label: 'Hercules' },
  { min: 60, label: 'Strongman' },
  { min: 40, label: 'Not Bad' },
  { min: 20, label: 'Lightweight' },
  { min: 0, label: 'Weakling' },
] as const;

export interface Swing {
  /** Where the meter stopped, 0 at the bottom and 1 at the top. */
  level: number;
  height: number;
  bell: boolean;
  score: number;
}

export interface HighStrikerState {
  /** Seconds the meter has been sweeping. */
  meterTime: number;
  swings: Swing[];
  /** Seconds since the last swing, while the puck is in the air. */
  flight: number;
  score: number;
  phase: 'aiming' | 'flying' | 'over';
}

export function createState(): HighStrikerState {
  return { meterTime: 0, swings: [], flight: 0, score: 0, phase: 'aiming' };
}

/** The meter's level at a time: sweeps 0 → 1 → 0 once every METER_PERIOD. */
export function meterLevel(time: number): number {
  const t = (((time / METER_PERIOD) % 1) + 1) % 1;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

export function isSweetSpot(level: number): boolean {
  return level >= SWEET_SPOT;
}

/**
 * How high the puck flies for a meter level, from 0 to BELL_HEIGHT. The curve
 * is squared, so a press near the bottom barely moves the puck, and only the
 * sweet spot reaches the bell.
 */
export function swingHeight(level: number): number {
  const clamped = Math.min(Math.max(level, 0), 1);
  if (isSweetSpot(clamped)) return BELL_HEIGHT;
  return Math.round(BELL_HEIGHT * clamped * clamped);
}

export function bellBonus(level: number): number {
  return isSweetSpot(level) ? BELL_BONUS : 0;
}

export function rankFor(height: number): string {
  return (RANKS.find((rank) => height >= rank.min) ?? RANKS[RANKS.length - 1]).label;
}

/** The rank of the round's highest swing, or undefined before the first swing. */
export function bestRank(state: HighStrikerState): string | undefined {
  if (state.swings.length === 0) return undefined;
  return rankFor(Math.max(...state.swings.map((s) => s.height)));
}

/** Stops the meter and swings the mallet. Returns false if no swing happened. */
export function swing(state: HighStrikerState): boolean {
  if (state.phase !== 'aiming') return false;
  const level = meterLevel(state.meterTime);
  const height = swingHeight(level);
  const bonus = bellBonus(level);
  const result = { level, height, bell: bonus > 0, score: height + bonus };
  state.swings.push(result);
  state.score += result.score;
  state.flight = 0;
  state.phase = 'flying';
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: HighStrikerState, dt: number): void {
  if (state.phase === 'aiming') {
    state.meterTime += dt;
  } else if (state.phase === 'flying') {
    state.flight += dt;
    if (state.flight >= FLIGHT_TIME) {
      state.phase = state.swings.length >= SWINGS_PER_ROUND ? 'over' : 'aiming';
      state.meterTime = 0;
    }
  }
}

/** The puck's height right now, from 0 to BELL_HEIGHT. */
export function puckHeight(state: HighStrikerState): number {
  const last = state.swings[state.swings.length - 1];
  if (state.phase !== 'flying' || !last) return 0;
  // Up and back down along a parabola that peaks at the swing's height.
  const t = Math.min(state.flight / FLIGHT_TIME, 1);
  return last.height * 4 * t * (1 - t);
}

const TOWER = { x: 360, top: 90, bottom: HEIGHT - 70, width: 24 };
const METER = { x: 120, top: 110, bottom: HEIGHT - 90, width: 36 };

function towerY(height: number) {
  return TOWER.bottom - (height / BELL_HEIGHT) * (TOWER.bottom - TOWER.top);
}

function draw(ctx: CanvasRenderingContext2D, state: HighStrikerState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Ground and base.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, TOWER.bottom, WIDTH, HEIGHT - TOWER.bottom);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(TOWER.x - 50, TOWER.bottom - 14, 100, 14);

  // Tower and its scale.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(TOWER.x - TOWER.width / 2, TOWER.top, TOWER.width, TOWER.bottom - TOWER.top);
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'left';
  for (const rank of RANKS) {
    const y = towerY(rank.min);
    ctx.fillStyle = colors.muted;
    ctx.fillRect(TOWER.x + TOWER.width / 2, y - 1, 14, 2);
    ctx.fillStyle = rank.min === BELL_HEIGHT ? colors.accent : colors.text;
    ctx.fillText(rank.label, TOWER.x + TOWER.width / 2 + 20, y + 5);
  }

  // Bell, lit when the last swing rang it.
  const last = state.swings[state.swings.length - 1];
  const ringing = state.phase === 'flying' && last?.bell && state.flight > FLIGHT_TIME / 2 - 0.1;
  ctx.fillStyle = ringing ? colors.accent : colors.muted;
  ctx.beginPath();
  ctx.arc(TOWER.x, TOWER.top - 4, 26, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(TOWER.x - 30, TOWER.top - 6, 60, 6);
  if (ringing) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    for (const r of [40, 54]) {
      ctx.beginPath();
      ctx.arc(TOWER.x, TOWER.top - 14, r, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`DING! +${BELL_BONUS}`, TOWER.x + 220, TOWER.top + 20);
  }

  // Puck.
  ctx.fillStyle = colors.danger;
  ctx.fillRect(TOWER.x - 18, towerY(puckHeight(state)) - 16, 36, 16);

  // Mallet, raised while aiming and down on the pad after a swing.
  ctx.save();
  ctx.translate(TOWER.x + 80, TOWER.bottom - 10);
  ctx.rotate(state.phase === 'aiming' ? -0.9 : -0.1);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(-4, -110, 8, 110);
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(-26, -130, 52, 28);
  ctx.restore();

  // Power meter, with the sweet spot at the top.
  const meterHeight = METER.bottom - METER.top;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(METER.x, METER.top, METER.width, meterHeight);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(METER.x, METER.top, METER.width, meterHeight * (1 - SWEET_SPOT));
  const level = state.phase === 'aiming' ? meterLevel(state.meterTime) : (last?.level ?? 0);
  ctx.fillStyle = colors.water;
  ctx.fillRect(METER.x, METER.bottom - meterHeight * level, METER.width, meterHeight * level);
  ctx.fillStyle = colors.text;
  ctx.fillRect(METER.x - 8, METER.bottom - meterHeight * level - 2, METER.width + 16, 4);
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'center';
  ctx.fillText('POWER', METER.x + METER.width / 2, METER.bottom + 24);

  // Swings so far.
  ctx.textAlign = 'right';
  ctx.font = canvasFont('body');
  state.swings.forEach((s, i) => {
    ctx.fillStyle = s.bell ? colors.accent : colors.text;
    ctx.fillText(
      `Swing ${i + 1}: ${s.height}${s.bell ? ` + ${BELL_BONUS}` : ''}`,
      WIDTH - 24,
      80 + i * 28,
    );
  });

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  const swingsLeft = SWINGS_PER_ROUND - state.swings.length;
  ctx.fillText(`Swings ${swingsLeft}/${SWINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);
  if (state.phase === 'aiming') {
    ctx.textAlign = 'center';
    ctx.font = canvasFont('body');
    ctx.fillText('Press Space or click to swing', WIDTH / 2, HEIGHT - 20);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`${bestRank(state)}! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Press Space or click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const highStriker: CarnivalGame = {
  id: 'high-striker',
  name: 'High Striker',
  description: 'Stop the power meter at the top to send the puck up the tower and ring the bell.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const act = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        swing(state);
      }
    };
    const onDown = () => act();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      // Keep Space from scrolling the page.
      event.preventDefault();
      if (!event.repeat) act();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the meter ahead.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(highStriker.id, state.score);
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

export default highStriker;
