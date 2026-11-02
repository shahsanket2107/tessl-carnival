# Skee-Ball

Roll the ball up the lane and into the rings. The small rings at the top score
the most.

## How to play

- Move the ball left and right with the arrow keys or the mouse. Each ball rolls
  straight up the lane from where you put it.
- Hold Space or the mouse button to charge the power meter. It swings up to full
  and back down again while you hold. Let go to roll the ball.
- Power sets how far the ball goes:
  - Too weak, and the ball doesn't make it up the ramp. It rolls back into the
    gutter for 0.
  - Too strong (more than about 95% power), and it bounces over the rings for 0.
  - In between, it lands on the board and scores the ring it lands in.
- A round is 9 balls. The round ends when the ninth ball lands.
- Click or press Space on the end screen to play another round.

## Scoring

A ball scores the smallest ring it lands in. The rings stack up the board, so
the smaller ones sit higher and need more power:

| Target                   | Points |
| ------------------------ | ------ |
| Big outer ring           | 10     |
| Second ring              | 20     |
| Third ring               | 30     |
| Fourth ring              | 40     |
| Small top ring           | 50     |
| Either top corner pocket | 100    |
| Gutter, over, or no ring | 0      |

Your score is the total of all 9 balls. It is saved to the carnival's score
board once, when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `meterPower`, `rollBall`, `scoreAt`,
  `startCharge`, `release`, `step`) and the `skeeBall` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
