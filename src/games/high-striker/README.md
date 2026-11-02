# High Striker

Swing the mallet, send the puck up the tower and ring the bell.

## How to play

- The power meter on the left sweeps up and down.
- Press Space or click to stop it and swing the mallet. The closer to the top
  of the meter you stop it, the higher the puck flies.
- The gold band at the very top of the meter is the sweet spot: stop it there
  and the puck rings the bell.
- You get 3 swings per round. Press Space or click on the end screen to play
  another round.

## Scoring

The meter goes from 0 at the bottom to 1 at the top. A swing sends the puck to
a height of `100 × level²`, rounded, so a press near the bottom barely moves it:

| Meter level            | Height | Bonus |
| ---------------------- | ------ | ----- |
| 0 (bottom)             | 0      | 0     |
| 0.5 (middle)           | 25     | 0     |
| 0.94                   | 88     | 0     |
| 0.95 to 1 (sweet spot) | 100    | 50    |

Only the sweet spot reaches the bell at 100, and ringing it adds a 50 point
bonus. The round's score is the sum of the three swings' heights plus any
bell bonuses.

The scale up the side of the tower ranks each height:

| Height   | Rank        |
| -------- | ----------- |
| 0 to 19  | Weakling    |
| 20 to 39 | Lightweight |
| 40 to 59 | Not Bad     |
| 60 to 79 | Strongman   |
| 80 to 99 | Hercules    |
| 100      | Champion    |

The end screen shows the rank of your highest swing. Your score is saved to the
carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `meterLevel`, `swingHeight`,
  `isSweetSpot`, `bellBonus`, `rankFor`, `bestRank`, `swing`, `step`,
  `puckHeight`) and the `highStriker` entry, the default export the midway
  finds.
- `game.test.ts`: tests for the game logic.
