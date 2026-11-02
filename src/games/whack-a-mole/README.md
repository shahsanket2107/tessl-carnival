# Whack-a-Mole

Moles pop up from a 3x3 grid of holes. Whack as many as you can before the
30 second timer runs out.

## How to play

- Click or tap a mole to whack it.
- Or play with the keyboard: the arrow keys move the highlight between holes and
  Space whacks the highlighted hole. The number keys 1 to 9 whack a hole
  directly, numbered left to right and top to bottom.
- A round lasts 30 seconds. Moles pop up faster and duck down sooner as the
  round goes on: a new mole every 0.9 seconds at the start, down to every 0.4
  seconds at the end, and each one stays up for 1.2 seconds at the start, down
  to 0.6 seconds at the end.
- One mole in ten is golden. A golden mole stays up for half as long as a
  plain one.
- Click or press Space on the game over screen to play another round.

## Scoring

- A mole is worth 1 point, and a golden mole is worth 5.
- Your streak counts whacks in a row. Every 3 in the streak adds 1 bonus point
  to each whack: the 3rd to 5th whacks in a row get +1, the 6th to 8th get +2,
  and so on.
- Whacking an empty hole scores nothing and breaks the streak. A mole that
  ducks down before you whack it does not break the streak.

Your final score is saved to the carnival's score board when the timer runs out.

## Files

- `game.ts`: the game logic (`createState`, `step`, `spawnMole`, `whack`,
  `scoreForWhack`, `spawnInterval`, `upTime`, `moveCursor`, `holeAt`) and the
  `whackAMole` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic, with a fixed random source so they
  are deterministic.
