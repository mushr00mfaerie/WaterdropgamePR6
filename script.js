// Core game state
let gameRunning = false;
let dropInterval = null;
let timerInterval = null;
let timeLeft = 60;
let score = 0;
const SPAWN_MS = 750;

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("game-container");
  const startBtn = document.getElementById("start-btn");
  const resetBtn = document.getElementById("reset-btn");
  const scoreEl = document.getElementById("score");
  const timerEl = document.getElementById("timer");
  const messageEl = document.getElementById("message");
  const logoImg = document.getElementById("logo-img");
  const logoFallback = document.getElementById("logo-fallback");
  const imgCan = document.getElementById("water-can");

  // Inject runtime styles to apply requested colors & gradient
  (function injectStyles(){
    const s = document.createElement("style");
    s.type = "text/css";
    s.textContent = `
      /* Page background */
      body {
        background: #4FCB53;
        margin: 0;
      }

      /* Game container (play area) — gradient */
      #game-container {
        background: linear-gradient(180deg, #FFFFFF 0%, #159A48 100%);
        border-radius: 12px;
        overflow: hidden;
        position: relative;
      }

      /* Start button color & typography (inherits font-family from styles.css) */
      #start-btn {
        background-color: #FFC907 !important;
        color: #000 !important;
        border: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        cursor: pointer;
        font-weight: 700;
      }

      /* Reset button typography */
      #reset-btn {
        background-color: #ffffff;
        color: #000;
        border: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        cursor: pointer;
        font-weight: 700;
      }

      /* Message, HUD and fallbacks use inherited fonts */
      #message, #score, #timer, .water-can-fallback {
        /* inherit from page */
      }

      /* Fallback can styling to match the palette */
      .water-can-fallback {
        background: linear-gradient(180deg,#FFC907 0%, #FFB000 100%);
        color: #000;
        border-radius: 8px;
        padding: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      }

      /* Difficulty buttons */
      .difficulty-group {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 16px 0;
      }
      .difficulty-label {
        font-weight: 700;
        margin-right: 8px;
        color: #fff;
      }
      .difficulty-btn {
        background-color: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        margin: 0 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.3s;
      }
      .difficulty-btn.active {
        background-color: rgba(255, 255, 255, 0.4);
      }
      .difficulty-btn:hover {
        background-color: rgba(255, 255, 255, 0.3);
      }

      /* Danger drop styling */
      .drop.danger {
        background-color: #000 !important;
        color: #fff !important;
      }
      .splash.danger {
        background: radial-gradient(circle, rgba(255,255,255,0.6), rgba(0,0,0,0.95) 30%, rgba(0,0,0,0.5) 90%);
      }
    `;
    document.head.appendChild(s);
  })();

  // helper: try to load a sequence of candidate URLs, call onSuccess/onFail
  function tryLoadImage(element, candidates, onSuccess, onFail){
    let i = 0;
    function next(){
      if (i >= candidates.length) { onFail && onFail(); return; }
      const url = candidates[i++].trim();
      if (!url) return next();
      const tester = new Image();
      tester.onload = () => {
        element.src = url;
        onSuccess && onSuccess(url);
      };
      tester.onerror = next;
      tester.src = url;
    }
    next();
  }

  // build candidate list from data-srcs (or the single src)
  function candidatesFromImg(img){
    const list = [];
    if (img.getAttribute("src")) list.push(img.getAttribute("src"));
    const data = img.dataset && img.dataset.srcs;
    if (data) data.split(",").forEach(s => { if (s.trim()) list.push(s.trim()); });
    return list;
  }

  // Attempt to load logo from multiple paths before showing fallback
  tryLoadImage(logoImg, candidatesFromImg(logoImg),
    () => { logoImg.classList.remove("hidden"); logoFallback.classList.add("hidden"); },
    () => { logoImg.classList.add("hidden"); logoFallback.classList.remove("hidden"); }
  );

  // can fallback creator
  let canEl = imgCan;
  function createCanFallback(){
    const fb = document.createElement("div");
    fb.className = "water-can-fallback";
    fb.textContent = "CAN";
    imgCan.replaceWith(fb);
    canEl = fb;
  }

  // Attempt to load can image from candidates; if none load, use fallback
  tryLoadImage(imgCan, candidatesFromImg(imgCan),
    () => { /* success, use imgCan as canEl */ canEl = imgCan; },
    () => { createCanFallback(); }
  );

  // ensure we also swap to fallback if image later errors (edge cases)
  imgCan.addEventListener && imgCan.addEventListener("error", () => {
    if (canEl === imgCan) createCanFallback();
  });

  // center can on load / resize (no CSS translateX so left/top are exact)
  function centerCan(){
    const rect = container.getBoundingClientRect();
    const w = (canEl && canEl.clientWidth) || 160;
    const h = (canEl && canEl.clientHeight) || 110;
    const left = Math.round(rect.width/2 - w/2);
    const top = Math.round(rect.height - h - 12);
    if (canEl) { canEl.style.left = left + "px"; canEl.style.top = top + "px"; }
  }
  centerCan();
  window.addEventListener("resize", centerCan);

  // add footer with charity links
  (function addFooter(){
    if (document.querySelector(".site-footer")) return;
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    const txt = document.createElement("div");
    txt.className = "site-footer-text";
    txt.textContent = "Support clean water:";
    const links = document.createElement("div");
    links.className = "links";
    const a1 = document.createElement("a");
    a1.href = "https://www.charitywater.org/";
    a1.target = "_blank";
    a1.rel = "noopener noreferrer";
    a1.textContent = "charity: water";
    const a2 = document.createElement("a");
    a2.href = "https://www.charitywater.org/donate/the-spring";
    a2.target = "_blank";
    a2.rel = "noopener noreferrer";
    a2.textContent = "Give access to clean water";
    links.appendChild(a1);
    links.appendChild(a2);
    footer.appendChild(txt);
    footer.appendChild(links);
    // append to body after main content
    document.body.appendChild(footer);
  })();

  // updateCanPosition now uses canEl (not imgCan)
  function updateCanPosition(clientX, clientY){
    if (!canEl) return;
    const rect = container.getBoundingClientRect();
    const w = canEl.clientWidth || 160;
    const h = canEl.clientHeight || 110;
    const left = clamp(clientX - rect.left - w/2, 0, rect.width - w);
    const top = clamp((clientY !== undefined ? clientY - rect.top - h/2 : parseFloat(canEl.style.top || 0)), 0, rect.height - h);
    canEl.style.left = left + "px";
    if (clientY !== undefined) canEl.style.top = top + "px";
  }
  // update existing event listeners that previously referenced waterCan to use canEl
  container.addEventListener("mousemove", e => updateCanPosition(e.clientX, e.clientY));
  container.addEventListener("touchmove", e => {
    if (e.touches && e.touches[0]) updateCanPosition(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    const step = 20;
    const rect = container.getBoundingClientRect();
    const w = (canEl && canEl.clientWidth) || 160;
    const h = (canEl && canEl.clientHeight) || 110;
    const curLeft = parseFloat(getComputedStyle(canEl).left || 0);
    const curTop = parseFloat(getComputedStyle(canEl).top || 0);
    if (e.key === "ArrowLeft") canEl.style.left = clamp(curLeft - step, 0, rect.width - w) + "px";
    if (e.key === "ArrowRight") canEl.style.left = clamp(curLeft + step, 0, rect.width - w) + "px";
    if (e.key === "ArrowUp") canEl.style.top = clamp(curTop - step, 0, rect.height - h) + "px";
    if (e.key === "ArrowDown") canEl.style.top = clamp(curTop + step, 0, rect.height - h) + "px";
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); collectOverlappingDrops(); }
  });

  // UI updates
  function updateScoreUI(){
    scoreEl.textContent = score;
    // if currently flashing, don't override the temporary red color
    if (!scoreEl.classList.contains("score-flash")) {
      scoreEl.style.color = score < 0 ? "#b30000" : "#000000";
    }
  }
  function updateTimerUI(){ timerEl.textContent = timeLeft; }

  // Add difficulty UI (Easy / Medium / Hard)
  let difficulty = "easy"; // default
  (function insertDifficultyUI(){
    const group = document.createElement("div");
    group.className = "difficulty-group";
    const label = document.createElement("div");
    label.className = "difficulty-label";
    label.textContent = "Difficulty:";
    group.appendChild(label);
    ["easy","medium","hard"].forEach(level => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "difficulty-btn" + (level === "easy" ? " active" : "");
      b.dataset.level = level;
      b.textContent = level[0].toUpperCase() + level.slice(1);
      b.addEventListener("click", () => {
        if (gameRunning) return;
        difficulty = level;
        group.querySelectorAll(".difficulty-btn").forEach(n => n.classList.remove("active"));
        b.classList.add("active");
      });
      group.appendChild(b);
    });
    // insert near start button if possible, otherwise append to top of body
    if (startBtn && startBtn.parentNode) startBtn.parentNode.insertBefore(group, startBtn);
    else document.body.insertBefore(group, document.body.firstChild);
  })();

  // Start game
  startBtn.addEventListener("click", () => {
    if (gameRunning) return;
    gameRunning = true;
    // hide start/reset and difficulty controls
    startBtn.classList.add("hidden");
    resetBtn.classList.add("hidden");
    const dg = document.querySelector(".difficulty-group"); if (dg) dg.classList.add("hidden");
    messageEl.classList.add("hidden");
    // set timer based on difficulty: hard => 30s, otherwise 60s
    timeLeft = (difficulty === "hard") ? 30 : 60;
    score = 0;
    updateScoreUI();
    updateTimerUI();
    // spawn drops periodically
    dropInterval = setInterval(() => spawnDrop(container), SPAWN_MS);
    // countdown timer
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerUI();
      if (timeLeft <= 0) endGame(false);
    }, 1000);
  });

  // Clicking container triggers can "click" (can collects overlapping drops)
  container.addEventListener("click", (e) => {
    if (!gameRunning) return;
    collectOverlappingDrops();
  });

  resetBtn.addEventListener("click", resetGame);

  function endGame(won){
    gameRunning = false;
    clearInterval(dropInterval);
    clearInterval(timerInterval);
    dropInterval = null;
    timerInterval = null;
    container.querySelectorAll(".drop, .splash").forEach(n => n.remove());
    resetBtn.classList.remove("hidden");
    startBtn.classList.add("hidden");
    // reveal difficulty controls after game over
    const dg = document.querySelector(".difficulty-group"); if (dg) dg.classList.remove("hidden");
    if (won){
      messageEl.textContent = "You win! 🎉";
      messageEl.classList.remove("hidden");
      if (window.confetti) confetti({ particleCount: 300, spread: 160, origin: { y: 0.4 } });
    } else {
      messageEl.textContent = score <= -25 ? "Game Over — Reached -25 points" : "Time's up — Try again!";
      messageEl.classList.remove("hidden");
    }
  }

  function resetGame(){
    clearInterval(dropInterval);
    clearInterval(timerInterval);
    dropInterval = null;
    timerInterval = null;
    container.querySelectorAll(".drop, .splash").forEach(n => n.remove());
    score = 0;
    timeLeft = 60;
    updateScoreUI();
    updateTimerUI();
    messageEl.classList.add("hidden");
    resetBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    gameRunning = false;
    // make difficulty selectable again
    const dg = document.querySelector(".difficulty-group"); if (dg) dg.classList.remove("hidden");
    centerCan();
  }

  // Spawn drops (no per-drop click handler any more)
  function spawnDrop(containerEl){
    if (!gameRunning) return;
    const drop = document.createElement("div");
    drop.className = "drop";
    const size = 36 + Math.random()*28;
    drop.style.width = drop.style.height = size + "px";
    const left = Math.random() * (containerEl.clientWidth - size - 8) + 4;
    drop.style.left = left + "px";
    drop.style.top = "-80px";

    // adjust speed by difficulty:
    // - Easy: original slow speed
    // - Medium: use previous 'hard' speed (faster)
    // - Hard: even faster than previous 'hard'
    let animDurationSec;
    if (difficulty === "hard") {
      // even faster for hard (~1.2 - 2.0s)
      animDurationSec = (1.2 + Math.random()*0.8);
    } else if (difficulty === "medium") {
      // medium uses the prior 'hard' pacing (~2.0 - 3.0s)
      animDurationSec = (2.0 + Math.random()*1.0);
    } else {
      // easy/default (~3.5 - 5.2s)
      animDurationSec = (3.5 + Math.random()*1.7);
    }
    drop.style.animationDuration = animDurationSec + "s";

    // determine drop type probabilities including danger in medium+hard
    const r = Math.random();
    if (difficulty === "easy") {
      if (r < 0.65) { drop.classList.add("good"); drop.dataset.type = "good"; }
      else if (r < 0.9) { drop.classList.add("bad"); drop.dataset.type = "bad"; }
      else { drop.classList.add("coin"); drop.dataset.type = "coin"; const span = document.createElement("span"); span.className = "coin-icon material-icons"; span.textContent = "casino"; drop.appendChild(span); }
    } else if (difficulty === "medium") {
      if (r < 0.55) { drop.classList.add("good"); drop.dataset.type = "good"; }
      else if (r < 0.8) { drop.classList.add("bad"); drop.dataset.type = "bad"; }
      else if (r < 0.9) { drop.classList.add("coin"); drop.dataset.type = "coin"; const span = document.createElement("span"); span.className = "coin-icon material-icons"; span.textContent = "casino"; drop.appendChild(span); }
      else { drop.classList.add("danger"); drop.dataset.type = "danger"; }
    } else { // hard
      if (r < 0.5) { drop.classList.add("good"); drop.dataset.type = "good"; }
      else if (r < 0.75) { drop.classList.add("bad"); drop.dataset.type = "bad"; }
      else if (r < 0.85) { drop.classList.add("coin"); drop.dataset.type = "coin"; const span = document.createElement("span"); span.className = "coin-icon material-icons"; span.textContent = "casino"; drop.appendChild(span); }
      else { drop.classList.add("danger"); drop.dataset.type = "danger"; }
    }

    // remove on end
    drop.addEventListener("animationend", () => drop.remove());
    containerEl.appendChild(drop);
  }

  // When the can is clicked (via container click, keyboard space, etc.) collect overlapping drops
  function collectOverlappingDrops(){
    const canRect = canEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const drops = Array.from(container.querySelectorAll(".drop"));
    // collect any drop that overlaps the can (any overlap)
    const toCollect = drops.filter(drop => {
      const d = drop.getBoundingClientRect();
      return !(canRect.right < d.left || canRect.left > d.right || canRect.bottom < d.top || canRect.top > d.bottom);
    });
    if (toCollect.length === 0) return;
    toCollect.forEach(drop => handleCollectedDrop(drop, canRect, containerRect));
  }

  function handleCollectedDrop(drop, canRect, containerRect){
    const dropRect = drop.getBoundingClientRect();
    const cx = dropRect.left + dropRect.width/2 - containerRect.left;
    const cy = dropRect.top + dropRect.height/2 - containerRect.top;
    const type = drop.dataset.type;
    createSplash(type, cx, cy, dropRect.width, container);
    if (type === "good") {
      score += 10;
    } else if (type === "bad") {
      score -= 5;
      scoreEl.style.color = "#ff0000";
      scoreEl.classList.add("score-flash");
      setTimeout(() => {
        scoreEl.classList.remove("score-flash");
        scoreEl.style.color = score < 0 ? "#b30000" : "#000000";
      }, 700);
    } else if (type === "coin") {
      score += 5;
      if (window.confetti) confetti({
        particleCount: 60,
        spread: 80,
        origin: { x: Math.min(0.98, Math.max(0.02, cx/container.clientWidth)), y: Math.max(0.02, (cy/container.clientHeight)-0.2) }
      });
    } else if (type === "danger") {
      score -= 10;
      // highlight score in red for danger (same visual feedback as bad)
      scoreEl.style.color = "#ff0000";
      scoreEl.classList.add("score-flash");
      setTimeout(() => {
        scoreEl.classList.remove("score-flash");
        scoreEl.style.color = score < 0 ? "#b30000" : "#000000";
      }, 700);
    }
    updateScoreUI();
    drop.remove();

    if (score <= -25) endGame(false);
    if (score >= 200) endGame(true);
  }

  // splash
  function createSplash(type, x, y, size, containerEl){
    const s = document.createElement("div");
    s.className = "splash";
    s.style.width = s.style.height = (size * 1.6) + "px";
    s.style.left = x + "px";
    s.style.top = y + "px";
    if (type === "good") {
      s.style.background = "radial-gradient(circle, rgba(255,255,255,0.6), rgba(61,168,255,0.95) 30%, rgba(61,168,255,0.35) 90%)";
    } else if (type === "bad") {
      s.style.background = "radial-gradient(circle, rgba(255,255,255,0.6), rgba(191,108,70,0.95) 30%, rgba(191,108,70,0.35) 90%)";
    } else if (type === "danger") {
      s.style.background = "radial-gradient(circle, rgba(255,255,255,0.6), rgba(0,0,0,0.95) 30%, rgba(0,0,0,0.5) 90%)";
    } else {
      s.style.background = "radial-gradient(circle, rgba(255,255,255,0.6), rgba(255,201,7,0.95) 30%, rgba(255,201,7,0.35) 90%)";
    }
    containerEl.appendChild(s);
    requestAnimationFrame(()=> s.classList.add("animate"));
    setTimeout(()=> { if (s.parentNode) s.remove(); }, 700);
  }
});
