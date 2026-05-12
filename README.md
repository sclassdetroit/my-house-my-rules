# My House My Rules

A runnable browser multiplayer party card game built with React, Vite, Node.js, Express, Socket.IO, and local JSON card packs.

## Setup

1. Install Node.js 20 or newer.
2. From this folder, run:

```bash
npm install
npm run install:all
npm run dev
```

3. Add your uploaded card images to:

```text
client/public/assets/cards/
```

Use these filenames:

- `blank-black-card.png`
- `blank-white-card.png`
- `black-logo-card.png`
- `adult-warning-card.png` optional

4. Open the frontend at:

```text
http://localhost:5173
```

5. Test multiplayer by opening multiple browser tabs. The backend runs at:

```text
http://localhost:3001
```

## Gameplay

- Host creates a room and receives a 5-character room code.
- Players join with the room code and display name.
- Host selects Main, After Dark, and/or Couples packs.
- Selecting After Dark shows an 18+ warning modal.
- Each player receives 7 answer cards.
- One player is judge each round and does not submit.
- Submissions are anonymous until the result.
- The judge picks the winner, points are awarded, and the judge rotates.
- First player to 7 points wins.

## House Rules

The host can activate one random house rule for the next/current round:

- Double points
- Everyone submits two cards
- Judge must pick the worst answer
- 30-second speed round timer
- Winner becomes judge again
- Silent round
- Steal one point
- Reverse winner

## Project Structure

```text
my-house-my-rules/
  client/
    src/
      components/
      App.jsx
      main.jsx
      styles.css
    public/assets/cards/
  server/
    cards/
    utils/gameLogic.js
    index.js
```
