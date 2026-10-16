(() => {
  "use strict";

  const WORLD = 4200;
  const FOOD_COUNT = 420;
  const AI_COUNT = 10;
  const BASE_SPEED = 2.55;
  const BOOST_SPEED = 4.35;
  const TURN_RATE = 0.085;
  const SEG_SPACING = 6.5;
  const MIN_LENGTH = 12;
  const BOOST_COST_INTERVAL = 8;
  const NAMES = [
    "Viper",
    "Nexus",
    "Drift",
    "Kite",
    "Moss",
    "Pulse",
    "Reef",
    "Nova",
    "Ash",
    "Bloom",
    "Glint",
    "Rook",
  ];
  const COLORS = [
    "#5dffc4",
    "#ff8a4c",
    "#6eb6ff",
    "#ffd166",
    "#ff5c6a",
    "#c3a6ff",
    "#7dffb3",
    "#ffa36c",
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");
  const rankEl = document.getElementById("rank");
  const leaderboard = document.getElementById("leaderboard");
  const leaderList = document.getElementById("leader-list");
  const startScreen = document.getElementById("start-screen");
  const overScreen = document.getElementById("over-screen");
  const playBtn = document.getElementById("play-btn");
  const retryBtn = document.getElementById("retry-btn");
  const finalScoreEl = document.getElementById("final-score");
  const overMessage = document.getElementById("over-message");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let snakes = [];
  let foods = [];
  let player = null;
  let mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
  let boosting = false;
  let cam = { x: WORLD / 2, y: WORLD / 2 };
  let lastTs = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clampWorld(v) {
    return Math.max(20, Math.min(WORLD - 20, v));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeFood(x, y, value = 1, color) {
    return {
      x: x ?? rand(80, WORLD - 80),
      y: y ?? rand(80, WORLD - 80),
      r: value > 2 ? 5.5 : rand(2.2, 3.6),
      value,
      color:
        color ||
        (Math.random() < 0.22
          ? "#ff8a4c"
          : pick(["#5dffc4", "#ffd166", "#6eb6ff", "#ffb087", "#7dffb3"])),
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function createSnake({ isPlayer, name, color, x, y }) {
    const angle = rand(0, Math.PI * 2);
    const length = isPlayer ? 18 : (10 + Math.random() * 28) | 0;
    const segments = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(angle) * i * SEG_SPACING,
        y: y - Math.sin(angle) * i * SEG_SPACING,
      });
    }
    return {
      id: Math.random().toString(36).slice(2),
      isPlayer: !!isPlayer,
      name: name || pick(NAMES),
      color: color || pick(COLORS),
      angle,
      targetAngle: angle,
      segments,
      len: length,
      alive: true,
      boost: false,
      boostTick: 0,
      aiTimer: 0,
      aiTarget: null,
    };
  }

  function snakeRadius(snake) {
    return 7 + Math.min(14, snake.len * 0.045);
  }

  function snakeScore(snake) {
    return snake.len;
  }

  function samplePath(path, count) {
    const out = [path[0]];
    let i = 0;
    let cur = path[0];
    while (out.length < count && i < path.length - 1) {
      const next = path[i + 1];
      const dx = next.x - cur.x;
      const dy = next.y - cur.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.0001) {
        i += 1;
        continue;
      }
      if (d >= SEG_SPACING) {
        const t = SEG_SPACING / d;
        cur = { x: cur.x + dx * t, y: cur.y + dy * t };
        out.push(cur);
      } else {
        cur = next;
        i += 1;
      }
    }
    while (out.length < count) {
      const last = out[out.length - 1];
      const prev = out[Math.max(0, out.length - 2)];
      const ang = Math.atan2(last.y - prev.y, last.x - prev.x) || 0;
      out.push({
        x: last.x - Math.cos(ang) * SEG_SPACING,
        y: last.y - Math.sin(ang) * SEG_SPACING,
      });
    }
    return out;
  }

  function resetGame() {
    foods = [];
    for (let i = 0; i < FOOD_COUNT; i++) foods.push(makeFood());

    snakes = [];
    player = createSnake({
      isPlayer: true,
      name: "You",
      color: "#5dffc4",
      x: WORLD / 2,
      y: WORLD / 2,
    });
    snakes.push(player);

    for (let i = 0; i < AI_COUNT; i++) {
      snakes.push(
        createSnake({
          name: pick(NAMES),
          color: pick(COLORS.filter((c) => c !== "#5dffc4")),
          x: rand(200, WORLD - 200),
          y: rand(200, WORLD - 200),
        })
      );
    }

    cam.x = player.segments[0].x;
    cam.y = player.segments[0].y;
    boosting = false;
    running = true;
    lastTs = performance.now();
  }

  function setPlayingUI(on) {
    document.getElementById("app").classList.toggle("playing", on);
    startScreen.hidden = on;
    overScreen.hidden = true;
    hud.hidden = !on;
    leaderboard.hidden = !on;
  }

  function showGameOver(msg) {
    running = false;
    document.getElementById("app").classList.remove("playing");
    overMessage.textContent = msg;
    finalScoreEl.textContent = String(snakeScore(player));
    overScreen.hidden = false;
    hud.hidden = true;
    leaderboard.hidden = true;
  }

  function steerToward(snake, tx, ty) {
    const head = snake.segments[0];
    snake.targetAngle = Math.atan2(ty - head.y, tx - head.x);
  }

  function turnToward(snake) {
    let diff = snake.targetAngle - snake.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = TURN_RATE * (snake.boost ? 0.85 : 1);
    if (Math.abs(diff) < maxTurn) snake.angle = snake.targetAngle;
    else snake.angle += Math.sign(diff) * maxTurn;
  }

  function updateAI(snake) {
    snake.aiTimer -= 1;
    const head = snake.segments[0];

    if (snake.aiTimer <= 0 || !snake.aiTarget) {
      snake.aiTimer = 40 + ((Math.random() * 80) | 0);
      if (Math.random() < 0.55 && foods.length) {
        let best = null;
        let bestD = Infinity;
        for (let i = 0; i < foods.length; i++) {
          const f = foods[i];
          const d = (f.x - head.x) ** 2 + (f.y - head.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        snake.aiTarget = best ? { x: best.x, y: best.y } : null;
      } else {
        snake.aiTarget = {
          x: clampWorld(head.x + rand(-500, 500)),
          y: clampWorld(head.y + rand(-500, 500)),
        };
      }
    }

    for (const other of snakes) {
      if (other === snake || !other.alive) continue;
      if (other.len < snake.len * 0.85) continue;
      const oh = other.segments[0];
      const d = dist(head, oh);
      if (d < 180) {
        snake.targetAngle = Math.atan2(head.y - oh.y, head.x - oh.x);
        snake.boost = d < 110 && snake.len > MIN_LENGTH + 4;
        return;
      }
    }

    if (snake.aiTarget) steerToward(snake, snake.aiTarget.x, snake.aiTarget.y);
    snake.boost = snake.len > MIN_LENGTH + 8 && Math.random() < 0.012;
  }

  function advanceSnake(snake) {
    turnToward(snake);
    const speed = snake.boost ? BOOST_SPEED : BASE_SPEED;
    const head = snake.segments[0];
    let nx = head.x + Math.cos(snake.angle) * speed;
    let ny = head.y + Math.sin(snake.angle) * speed;

    if (nx < 30 || nx > WORLD - 30 || ny < 30 || ny > WORLD - 30) {
      snake.targetAngle = Math.atan2(WORLD / 2 - head.y, WORLD / 2 - head.x);
      nx = clampWorld(nx);
      ny = clampWorld(ny);
    }

    snake.segments = samplePath([{ x: nx, y: ny }, ...snake.segments], snake.len);

    if (snake.boost && snake.len > MIN_LENGTH) {
      snake.boostTick += 1;
      if (snake.boostTick % BOOST_COST_INTERVAL === 0) {
        snake.len -= 1;
        const drop = snake.segments[snake.segments.length - 1];
        if (drop) foods.push(makeFood(drop.x, drop.y, 1, snake.color));
      }
    } else {
      snake.boostTick = 0;
    }
  }

  function eatFood(snake) {
    const head = snake.segments[0];
    const r = snakeRadius(snake) + 4;
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (Math.hypot(f.x - head.x, f.y - head.y) < r + f.r) {
        snake.len += f.value;
        foods.splice(i, 1);
      }
    }
  }

  function killSnake(snake, killerName) {
    if (!snake.alive) return;
    snake.alive = false;
    const drop = Math.min(80, Math.floor(snake.len * 0.55));
    for (let i = 0; i < drop; i++) {
      const s = snake.segments[(i * 2) % snake.segments.length];
      if (s) foods.push(makeFood(s.x + rand(-6, 6), s.y + rand(-6, 6), 1, snake.color));
    }
    if (snake.isPlayer) {
      showGameOver(killerName ? `Taken out by ${killerName}.` : "You crashed into a rival.");
    }
  }

  function checkCollisions() {
    for (const snake of snakes) {
      if (!snake.alive) continue;
      const head = snake.segments[0];
      const hr = snakeRadius(snake) * 0.65;

      for (const other of snakes) {
        if (!other.alive || other === snake) continue;
        const orad = snakeRadius(other);
        for (let i = 4; i < other.segments.length; i += 2) {
          const seg = other.segments[i];
          if (Math.hypot(seg.x - head.x, seg.y - head.y) < hr + orad * 0.7) {
            killSnake(snake, other.name);
            break;
          }
        }
        if (!snake.alive) break;
      }
    }
  }

  function maintainWorld() {
    while (foods.length < FOOD_COUNT) foods.push(makeFood());

    const aliveAI = snakes.filter((s) => s.alive && !s.isPlayer).length;
    for (let i = aliveAI; i < AI_COUNT; i++) {
      let x;
      let y;
      do {
        x = rand(200, WORLD - 200);
        y = rand(200, WORLD - 200);
      } while (player && Math.hypot(x - player.segments[0].x, y - player.segments[0].y) < 500);

      const taken = new Set(snakes.filter((s) => s.alive).map((s) => s.name));
      let name = pick(NAMES);
      for (let n = 0; n < NAMES.length; n++) {
        const candidate = NAMES[(NAMES.indexOf(name) + n) % NAMES.length];
        if (!taken.has(candidate)) {
          name = candidate;
          break;
        }
      }
      snakes.push(
        createSnake({
          name,
          color: pick(COLORS),
          x,
          y,
        })
      );
    }
    snakes = snakes.filter((s) => s.alive || s.isPlayer);
  }

  function updateLeaderboard() {
    const ranked = snakes
      .filter((s) => s.alive)
      .sort((a, b) => snakeScore(b) - snakeScore(a))
      .slice(0, 6);

    leaderList.innerHTML = ranked
      .map((s, i) => {
        const cls = s.isPlayer ? ' class="you"' : "";
        return `<li${cls}><span>${i + 1}. ${s.name}</span><span>${snakeScore(s)}</span></li>`;
      })
      .join("");

    if (player && player.alive) {
      scoreEl.textContent = String(snakeScore(player));
      const all = snakes.filter((s) => s.alive).sort((a, b) => snakeScore(b) - snakeScore(a));
      const rank = all.findIndex((s) => s.isPlayer) + 1;
      rankEl.textContent = `#${rank}`;
    }
  }

  function worldToScreen(x, y) {
    return {
      x: x - cam.x + width / 2,
      y: y - cam.y + height / 2,
    };
  }

  function drawBackground() {
    ctx.fillStyle = "#071210";
    ctx.fillRect(0, 0, width, height);

    const grid = 70;
    const ox = -((cam.x - width / 2) % grid);
    const oy = -((cam.y - height / 2) % grid);

    ctx.strokeStyle = "rgba(93, 255, 196, 0.045)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ox; x < width; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = oy; y < height; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFood(t) {
    for (const f of foods) {
      const p = worldToScreen(f.x, f.y);
      if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;
      const pulse = 1 + Math.sin(t * 0.004 + f.pulse) * 0.15;
      const r = f.r * pulse;
      ctx.beginPath();
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.9;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawSnake(snake) {
    const segs = snake.segments;
    if (!segs.length) return;
    const radius = snakeRadius(snake);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = snake.color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = radius * 2.6;
    ctx.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const p = worldToScreen(segs[i].x, segs[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const p = worldToScreen(segs[i].x, segs[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 2; i < segs.length; i += 3) {
      const p = worldToScreen(segs[i].x, segs[i].y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    const head = worldToScreen(segs[0].x, segs[0].y);
    ctx.fillStyle = snake.color;
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius * 1.05, 0, Math.PI * 2);
    ctx.fill();

    const ang = snake.angle;
    const eyeDist = radius * 0.45;
    const eyeR = Math.max(2.2, radius * 0.28);
    for (const side of [-1, 1]) {
      const ex =
        head.x +
        Math.cos(ang) * radius * 0.25 +
        Math.cos(ang + Math.PI / 2) * eyeDist * side;
      const ey =
        head.y +
        Math.sin(ang) * radius * 0.25 +
        Math.sin(ang + Math.PI / 2) * eyeDist * side;
      ctx.fillStyle = "#071210";
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8f5ef";
      ctx.beginPath();
      ctx.arc(
        ex + Math.cos(ang) * eyeR * 0.35,
        ey + Math.sin(ang) * eyeR * 0.35,
        eyeR * 0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (!snake.isPlayer) {
      ctx.font = "600 12px Manrope, sans-serif";
      ctx.fillStyle = "rgba(232,245,239,0.7)";
      ctx.textAlign = "center";
      ctx.fillText(snake.name, head.x, head.y - radius - 10);
    }
  }

  function drawCursor() {
    if (!running) return;
    const p = worldToScreen(mouse.worldX, mouse.worldY);
    ctx.strokeStyle = "rgba(93, 255, 196, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 12, p.y);
    ctx.lineTo(p.x - 4, p.y);
    ctx.moveTo(p.x + 4, p.y);
    ctx.lineTo(p.x + 12, p.y);
    ctx.moveTo(p.x, p.y - 12);
    ctx.lineTo(p.x, p.y - 4);
    ctx.moveTo(p.x, p.y + 4);
    ctx.lineTo(p.x, p.y + 12);
    ctx.stroke();
  }

  function updateMouseWorld() {
    mouse.worldX = mouse.x + cam.x - width / 2;
    mouse.worldY = mouse.y + cam.y - height / 2;
  }

  function drawMenuBackdrop(ts) {
    drawBackground();
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(ts * 0.0002 + i) * 0.5 + 0.5) * width;
      const y = (Math.cos(ts * 0.00015 + i * 1.7) * 0.5 + 0.5) * height;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = i % 3 === 0 ? "#ff8a4c" : "#5dffc4";
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    const dt = Math.min(32, ts - lastTs || 16);
    lastTs = ts;

    if (!running) {
      drawMenuBackdrop(ts);
      return;
    }

    const steps = Math.max(1, Math.round(dt / 16.67));
    for (let s = 0; s < steps; s++) {
      updateMouseWorld();
      if (player.alive) {
        steerToward(player, mouse.worldX, mouse.worldY);
        player.boost = boosting && player.len > MIN_LENGTH;
      }

      for (const snake of snakes) {
        if (!snake.alive) continue;
        if (!snake.isPlayer) updateAI(snake);
        advanceSnake(snake);
        eatFood(snake);
      }

      checkCollisions();
      maintainWorld();
    }

    if (player && player.alive) {
      const head = player.segments[0];
      cam.x += (head.x - cam.x) * 0.12;
      cam.y += (head.y - cam.y) * 0.12;
    }

    drawBackground();
    drawFood(ts);
    const drawOrder = [...snakes].filter((s) => s.alive).sort((a, b) => a.len - b.len);
    for (const snake of drawOrder) drawSnake(snake);
    drawCursor();
    updateLeaderboard();
  }

  function startGame() {
    if (running && player && player.alive) return;
    resetGame();
    setPlayingUI(true);
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  canvas.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      e.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener("mousedown", () => {
    boosting = true;
  });
  window.addEventListener("mouseup", () => {
    boosting = false;
  });
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (t) {
        mouse.x = t.clientX;
        mouse.y = t.clientY;
      }
      boosting = true;
    },
    { passive: true }
  );
  window.addEventListener("touchend", () => {
    boosting = false;
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      boosting = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") boosting = false;
  });

  playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });
  retryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startGame();
  });

  // Whole menu surface starts a run (helps when the CTA miss-clicks)
  startScreen.addEventListener("click", () => {
    if (!startScreen.hidden) startGame();
  });
  overScreen.addEventListener("click", () => {
    if (!overScreen.hidden) startGame();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Enter") return;
    if (!startScreen.hidden || !overScreen.hidden) {
      e.preventDefault();
      startGame();
    }
  });

  resize();
  mouse.x = width / 2;
  mouse.y = height / 2;
  requestAnimationFrame(tick);
})();
