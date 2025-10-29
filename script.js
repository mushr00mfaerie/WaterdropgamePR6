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
    scoreEl.style.color = score < 0 ? "#b30000" : "#000000";
  }
  function updateTimerUI(){ timerEl.textContent = timeLeft; }

  // Start game
  startBtn.addEventListener("click", () => {
    if (gameRunning) return;
    gameRunning = true;
    startBtn.classList.add("hidden");
    resetBtn.classList.add("hidden");
    messageEl.classList.add("hidden");
    timeLeft = 60;
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
    drop.style.animationDuration = (3.5 + Math.random()*1.7) + "s";

    const r = Math.random();
    if (r < 0.65) { drop.classList.add("good"); drop.dataset.type = "good"; }
    else if (r < 0.9) { drop.classList.add("bad"); drop.dataset.type = "bad"; }
    else {
      drop.classList.add("coin"); drop.dataset.type = "coin";
      const span = document.createElement("span");
      span.className = "coin-icon material-icons";
      span.textContent = "casino";
      drop.appendChild(span);
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
    } else {
      s.style.background = "radial-gradient(circle, rgba(255,255,255,0.6), rgba(255,201,7,0.95) 30%, rgba(255,201,7,0.35) 90%)";
    }
    containerEl.appendChild(s);
    requestAnimationFrame(()=> s.classList.add("animate"));
    setTimeout(()=> { if (s.parentNode) s.remove(); }, 700);
  }
});
