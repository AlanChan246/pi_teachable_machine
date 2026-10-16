# COIL — Snake.io

A browser snake.io-style arena game. Steer with the mouse, eat glowing orbs to grow, and outlast AI rivals.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
cd snake-io
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

| Action | Input |
|--------|--------|
| Steer | Mouse / touch |
| Boost | Hold click, touch, or Space |

Boost burns length and drops pellets behind you.

## Features

- Large scrolling arena with camera follow
- Pulsing food orbs and colorful rival snakes
- AI bots that hunt food and dodge larger snakes
- Live leaderboard and length score
- Touch-friendly controls
