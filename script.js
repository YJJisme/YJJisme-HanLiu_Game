const input = document.getElementById('playerName');
const btn = document.getElementById('startBtn');
const intro = document.querySelector('.intro');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const backdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const rankHan = document.getElementById('rankHan');
const rankLiu = document.getElementById('rankLiu');
const rankAll = document.getElementById('rankAll');
const aboutBtn = document.getElementById('aboutBtn');
const debugLevelInput = document.getElementById('debugLevelInput');
const debugStartBtn = document.getElementById('debugStartBtn');

let matchScore = 0;
let errorCount = 0;
let errorLock = false;
let currentRoute = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentLevel = 1;
let startTime;
let currentProgress = 'Level 1';
let currentExamAttempt = 1;
let examQuestions = [];
let hpMax = 2;
const gameFlow = [1, 2, 3, 'Dream', 4, 5, 6, 'Dream', 7, 8, 9, 'Dream', 10, 'Review'];
let currentLevelIndex = -1;
let currentLetterGoal = 1;
let blockingModalOpen = false;
let customNumberFailText = null;
let mismatchCounter = 0;
let bgmAudio = null;
let bgmEnabled = true;

function initBgm() {
  if (bgmAudio) return;
  bgmAudio = new Audio('music1.mp3');
  bgmAudio.loop = true;
  bgmAudio.preload = 'auto';
  bgmAudio.volume = 0.35;
}

function playBgm() {
  if (!bgmEnabled) return;
  if (!bgmAudio) initBgm();
  const p = bgmAudio.play();
  if (p && typeof p.catch === 'function') { p.catch(() => {}); }
}

function pauseBgm() {
  if (bgmAudio) { try { bgmAudio.pause(); } catch {} }
}

function toggleBgm() {
  bgmEnabled = !bgmEnabled;
  if (bgmEnabled) playBgm(); else pauseBgm();
  const btn = document.getElementById('bgmToggle');
  if (btn) btn.textContent = bgmEnabled ? '♪' : '🔇';
}

function setupBgmAutoplay() {
  if (window.__bgmSetup) return;
  window.__bgmSetup = true;
  const handler = () => {
    initBgm();
    playBgm();
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('click', handler, { once: true });
  document.addEventListener('keydown', handler, { once: true });
}

let isGameOver = false;
const timerRegistry = { intervals: new Set(), timeouts: new Set() };
function trackedSetInterval(fn, ms) { const id = setInterval(fn, ms); timerRegistry.intervals.add(id); return id; }
function trackedSetTimeout(fn, ms) { const id = setTimeout(fn, ms); timerRegistry.timeouts.add(id); return id; }
function clearAllTimers() { timerRegistry.intervals.forEach((id) => clearInterval(id)); timerRegistry.timeouts.forEach((id) => clearTimeout(id)); timerRegistry.intervals.clear(); timerRegistry.timeouts.clear(); }
function systemCleanup(lockGame) { clearAllTimers(); if (lockGame === true) isGameOver = true; }

function getLevelType(item) {
  if (typeof item === 'number') return 'Number';
  if (item === 'Dream') return 'Dream';
  if (item === 'Review') return 'Review';
  return 'Unknown';
}

function getCharacterVersion() {
  if (currentLevel === 5) return 'youth';
  if (currentLevel <= 3) return 'youth';
  if (currentLevel <= 6) return 'middle';
  return 'aged';
}

function applyLevelStyle(levelType) {
  const root = document.documentElement;
  if (levelType === 'Number') {
    root.style.setProperty('--bg', '#f0f8ff');
    root.style.setProperty('--fg', '#333333');
    root.style.setProperty('--muted', '#555555');
    root.style.setProperty('--title', '#0b1f3a');
  } else if (levelType === 'Dream') {
    root.style.setProperty('--bg', '#000000');
    root.style.setProperty('--fg', '#ffffff');
    root.style.setProperty('--muted', '#cfcfcf');
    root.style.setProperty('--title', '#ffffff');
  } else if (levelType === 'Review') {
    root.style.setProperty('--bg', '#1a1a1a');
    root.style.setProperty('--fg', '#cfcfcf');
    root.style.setProperty('--muted', '#9aa0a6');
    root.style.setProperty('--title', '#f7fbff');
  }
}

function updateCharacterDisplay() {
  const wrap = document.getElementById('characterDisplay');
  if (!wrap) return;
  const img = document.getElementById('characterImage') || wrap.querySelector('img');
  const ver = getCharacterVersion();
  const src = ver === 'youth' ? 'han_yu_youth.png' : ver === 'middle' ? 'han_yu_middle.png' : 'han_yu_aged.png';
  if (img) img.src = src;
  wrap.hidden = false;
}

function hideCharacterDisplay() {
  const wrap = document.getElementById('characterDisplay');
  if (wrap) wrap.hidden = true;
}

function finalizeGame() {
  systemCleanup(true);
  const playerName = localStorage.getItem('hanliu_player_name') || '無名';
  currentProgress = 'Completed';
  saveScore(playerName, matchScore, currentRoute || 'HanYu');
  renderLeaderboardPage(currentRoute || 'HanYu', '結算：本局結果如下');
}

function handleError(levelType) {
  if (levelType === 'Dream') {
    const main = document.querySelector('main.container');
    const sec = document.createElement('section');
    sec.className = 'dialog-container';
    const p = document.createElement('p');
    p.className = 'dialog-text';
    p.textContent = '夢醒了，進入下一關';
    const next = document.createElement('button');
    next.className = 'button';
    next.type = 'button';
    next.textContent = '下一關';
    next.addEventListener('click', () => { sec.remove(); goToNextLevel(); });
    sec.appendChild(p);
    sec.appendChild(next);
    main.appendChild(sec);
    return;
  }
  if (levelType === 'Number') {
    if (errorLock) return;
    errorLock = true;
    errorCount += 1;
    updateHpBar();
  if (errorCount === 1) {
    showPunishOverlay();
    setTimeout(() => {
      errorLock = false;
      if (currentLevel === 8 && typeof window.level8Reset === 'function') { window.level8Reset(); }
      if (currentLevel === 9 && typeof window.level9Reset === 'function') { window.level9Reset(); }
      if (currentLevel === 10 && typeof window.level10Reset === 'function') { window.level10Reset(); }
    }, 2000);
    return;
  }
    systemCleanup(true);
    clearMainContent(true);
    hideCharacterDisplay();
    hideHpBar();
    if (currentLevel === 8) {
      const overlay = document.createElement('div');
      overlay.className = 'punish-overlay';
      const sym = document.createElement('div');
      sym.className = 'punish-symbol';
      sym.textContent = '🐊';
      overlay.appendChild(sym);
      document.body.appendChild(overlay);
      sym.addEventListener('animationend', () => { overlay.remove(); });
    }
    const main = document.querySelector('main.container');
    const death = document.createElement('section');
    death.className = 'dialog-container';
    const stage = getCharacterVersion();
    const img = document.createElement('img');
    img.alt = '死亡畫面';
    img.src = stage === 'youth' ? 'han_yu_youth_dead.png' : stage === 'middle' ? 'han_yu_middle_dead.png' : 'han_yu_aged_dead.png';
    img.style.maxWidth = '280px';
    img.style.border = '1px solid #2a2a2a';
    img.style.borderRadius = '10px';
    const text = document.createElement('p');
    text.className = 'dialog-text';
    text.textContent = customNumberFailText || '你終究未能完成兄嫂的囑託，遺憾地結束了這段困頓的求仕之旅...';
    death.appendChild(img);
    death.appendChild(text);
    main.appendChild(death);
    setTimeout(() => {
      death.remove();
      currentProgress = `Failed at Level ${currentLevel}`;
      const playerName = localStorage.getItem('hanliu_player_name') || '無名';
      saveScore(playerName, matchScore, currentRoute || 'HanYu');
      renderLeaderboardPage(currentRoute || 'HanYu', '遺憾地結束了這段困頓的求仕之旅...');
      errorLock = false;
      customNumberFailText = null;
    }, 2500);
  }
}

function goToNextLevel() {
  systemCleanup(false);
  currentLevelIndex += 1;
  const item = gameFlow[currentLevelIndex];
  if (item === undefined) { finalizeGame(); return; }
  const type = getLevelType(item);
  if (type === 'Number') currentLevel = item;
  if (type === 'Review') currentLevel = 10;
  applyLevelStyle(type);
  if (type === 'Number') currentProgress = `Level ${currentLevel}`;
  if (type === 'Dream') currentProgress = 'Dream';
  if (type === 'Review') currentProgress = 'Review';
  if (type === 'Number' || type === 'Dream') updateCharacterDisplay();
  if (type === 'Number' || type === 'Dream') { showHpBar(); updateHpBar(); }
  if (type === 'Number') {
    startNumberLevel(item);
  } else if (type === 'Dream') {
    startDreamLevel();
  } else if (type === 'Review') {
    startReviewLevel();
  }
}

function startNumberLevel(n) {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  if (n === 1) { startSentenceLevel(); return; }
  if (n === 2) { startExamLevel(); return; }
  if (n === 3) { startLetterMazeLevel(); return; }
  if (n === 4) { startPoetryLevel(); return; }
  if (n === 5) { startFiveOriginalsLevel(); return; }
  if (n === 6) { startHuaiXiLevel(); return; }
  if (n === 7) { startBuddhaBoneLevel(); return; }
  if (n === 8) { startCrocodileLevel(); return; }
  if (n === 9) { startEpitaphLevel(); return; }
  if (n === 10) { startLevel10(); return; }
  const main = document.querySelector('main.container');
  const sec = document.createElement('section');
  sec.className = 'dialog-container';
  const p = document.createElement('p');
  p.className = 'dialog-text';
  p.textContent = `第 ${n} 關即將開始...`;
  const next = document.createElement('button');
  next.className = 'button';
  next.type = 'button';
  next.textContent = '下一關';
  next.addEventListener('click', () => { sec.remove(); goToNextLevel(); });
  sec.appendChild(p);
  sec.appendChild(next);
  main.appendChild(sec);
}

function startBuddhaBoneLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const img = document.getElementById('characterImage');
  if (img) img.src = 'han_yu_aged.png';
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelAdmonish');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelAdmonish';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第七關：諫迎佛骨';
  level.appendChild(title);

  let rageValue = 0;
  let pleaPoint = 0;
  let willpowerDebuff = false;

  const p1 = document.createElement('div');
  p1.className = 'catch-stage';
  const catcher = document.createElement('div');
  catcher.className = 'catcher';
  p1.appendChild(catcher);
  level.appendChild(p1);

  let running = false;
  const items = [];
  const rng = () => Math.random();
  const nowMs = () => performance.now();
  const ctrl = { x: 0.5, speed: 0.7 };
  function setCatcherX(nx) { ctrl.x = Math.max(0, Math.min(1, nx)); catcher.style.left = (ctrl.x * 100) + '%'; }
  setCatcherX(0.5);
  let lastTs = nowMs();
  let misses = 0;
  let p1Ended = false;
  function activeItems() { return items.filter(it => !it.removed && !it.caught); }
  function rectsIntersect(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }

  function clearTokens() { tokens.forEach(t => { if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); }); tokens.length = 0; }
  function updateNextTokenHighlight() {
    tokens.forEach(t => {
      if (t.removed || !t.el) return;
      if (t.idx === nextIndex) t.el.classList.add('next');
      else t.el.classList.remove('next');
    });
  }
  function scatterTokens() {
    clearTokens();
    const placed = [];
    for (let i = 0; i < chars.length; i++) {
      const el = document.createElement('div');
      el.className = 'croc-token';
      el.textContent = chars[i];
      stage.appendChild(el);
      let x = 0, y = 0; let ok = false; let tries = 0;
      while (!ok && tries < 100) {
        x = 0.08 + rng() * 0.84;
        y = 0.10 + rng() * 0.76;
        const farFromHead = Math.hypot(ctrl.x - x, ctrl.y - y) > 0.16;
        ok = farFromHead && placed.every(p => Math.hypot(p.x - x, p.y - y) > 0.12);
        tries++;
      }
      el.style.left = (x * 100) + '%';
      el.style.top = (y * 100) + '%';
      const token = { el, x, y, idx: i, removed: false };
      tokens.push(token); placed.push({ x, y });
    }
    updateNextTokenHighlight();
  }

  function clearTokens() { tokens.forEach(t => { if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el); }); tokens.length = 0; }
  function updateNextTokenHighlight() {
    tokens.forEach(t => {
      if (t.removed || !t.el) return;
      if (t.idx === nextIndex) t.el.classList.add('next');
      else t.el.classList.remove('next');
    });
  }
  function scatterTokens() {
    clearTokens();
    const placed = [];
    for (let i = 0; i < chars.length; i++) {
      const el = document.createElement('div');
      el.className = 'croc-token';
      el.textContent = chars[i];
      stage.appendChild(el);
      let x = 0, y = 0; let ok = false; let tries = 0;
      while (!ok && tries < 100) {
        x = 0.08 + rng() * 0.84;
        y = 0.10 + rng() * 0.76;
        const farFromHead = Math.hypot(ctrl.x - x, ctrl.y - y) > 0.16;
        ok = farFromHead && placed.every(p => Math.hypot(p.x - x, p.y - y) > 0.12);
        tries++;
      }
      el.style.left = (x * 100) + '%';
      el.style.top = (y * 100) + '%';
      const token = { el, x, y, idx: i, removed: false };
      tokens.push(token); placed.push({ x, y });
    }
    updateNextTokenHighlight();
  }

  function clearTokens() { tokens.forEach(t => { if (t.el.parentNode) t.el.parentNode.removeChild(t.el); }); tokens.length = 0; }
  function scatterTokens() {
    clearTokens();
    const placed = [];
    for (let i = 0; i < chars.length; i++) {
      const el = document.createElement('div');
      el.className = 'croc-token';
      el.textContent = chars[i];
      stage.appendChild(el);
      let x = 0, y = 0; let ok = false; let tries = 0;
      while (!ok && tries < 100) {
        x = 0.08 + rng() * 0.84;
        y = 0.10 + rng() * 0.76;
        const farFromHead = Math.hypot(ctrl.x - x, ctrl.y - y) > 0.16;
        ok = farFromHead && placed.every(p => Math.hypot(p.x - x, p.y - y) > 0.12);
        tries++;
      }
      el.style.left = (x * 100) + '%';
      el.style.top = (y * 100) + '%';
      const token = { el, x, y, idx: i, removed: false };
      tokens.push(token); placed.push({ x, y });
    }
    updateNextTokenHighlight();
  }

  function updateNextTokenHighlight() {
    tokens.forEach(t => {
      if (t.removed || !t.el) return;
      if (t.idx === nextIndex) t.el.classList.add('next');
      else t.el.classList.remove('next');
    });
  }

  function clearTokens() { tokens.forEach(t => { if (t.el.parentNode) t.el.parentNode.removeChild(t.el); }); tokens.length = 0; }
  function scatterTokens() {
    clearTokens();
    const placed = [];
    for (let i = 0; i < chars.length; i++) {
      const el = document.createElement('div');
      el.className = 'croc-token';
      el.textContent = chars[i];
      stage.appendChild(el);
      let x = 0, y = 0; let ok = false; let tries = 0;
      while (!ok && tries < 100) {
        x = 0.08 + rng() * 0.84;
        y = 0.10 + rng() * 0.76;
        const farFromHead = Math.hypot(ctrl.x - x, ctrl.y - y) > 0.16;
        ok = farFromHead && placed.every(p => Math.hypot(p.x - x, p.y - y) > 0.12);
        tries++;
      }
      el.style.left = (x * 100) + '%';
      el.style.top = (y * 100) + '%';
      const token = { el, x, y, idx: i, removed: false };
      tokens.push(token); placed.push({ x, y });
    }
  }
  function endP1(success) {
    if (p1Ended) return;
    p1Ended = true;
    running = false;
    clearInterval(spawnTimer);
    if (endTimer) clearTimeout(endTimer);
    activeItems().forEach(it => { if (!it.removed) { it.removed = true; p1.removeChild(it.el); } });
    willpowerDebuff = !success;
    const msg = success ? '意志阻擋成功' : '意志阻擋失敗';
    if (success) {
      const count = 28;
      let done = 0;
      const rainItems = [];
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'fall-item';
        el.textContent = '佛';
        el.style.pointerEvents = 'none';
        p1.appendChild(el);
        const v = 0.12 + Math.random() * 0.18;
        const it = { el, x: Math.random(), y: -0.1, v, reached: false };
        el.style.left = (it.x * 100) + '%';
        el.style.top = (it.y * 100) + '%';
        rainItems.push(it);
      }
      let last = nowMs();
      function rainLoop() {
        const ts = nowMs();
        const dt = Math.min(0.033, (ts - last) / 1000);
        last = ts;
        rainItems.forEach(it => {
          if (it.reached) return;
          it.y += it.v * dt;
          it.el.style.top = (it.y * 100) + '%';
          if (it.y >= 0.92) {
            it.reached = true;
            done += 1;
            if (it.el.parentNode) p1.removeChild(it.el);
          }
        });
        if (done < count) {
          requestAnimationFrame(rainLoop);
        } else {
          showConfirmModal('提示', '佛骨進宮', '準備勸諫', () => { renderP2(); });
        }
      }
      requestAnimationFrame(rainLoop);
    } else {
      showConfirmModal('提示', msg, '進入下一階段', () => { renderP2(); });
    }
  }
  function spawnFo() {
    const el = document.createElement('div');
    el.className = 'fall-item';
    el.textContent = '佛';
    p1.appendChild(el);
    const minSepMs = 1200;
    let v = 0.12 + rng() * 0.18;
    let ok = false;
    for (let tries = 0; tries < 6; tries++) {
      const tBottom = nowMs() + ((1.05 - (-0.1)) / v) * 1000;
      const conflict = activeItems().some(it => Math.abs((it.tBottom || 0) - tBottom) < minSepMs);
      if (!conflict) { ok = true; break; }
      v = 0.12 + rng() * 0.18;
    }
    const obj = { el, x: rng(), y: -0.1, v, caught: false, removed: false, tBottom: nowMs() + ((1.05 - (-0.1)) / v) * 1000 };
    el.style.left = (obj.x * 100) + '%';
    el.style.top = (obj.y * 100) + '%';
    items.push(obj);
  }
  function gameLoop() {
    if (!running || isGameOver) return;
    const ts = nowMs();
    const dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    const cRect = catcher.getBoundingClientRect();
    items.forEach(it => {
      it.y += it.v * dt;
      it.el.style.top = (it.y * 100) + '%';
      if (!it.caught && !it.removed) {
        const iRect = it.el.getBoundingClientRect();
        if (rectsIntersect(iRect, cRect)) {
          it.caught = true;
          it.removed = true;
          p1.removeChild(it.el);
        }
      }
      if (it.y > 1.05 && !it.removed) {
        it.removed = true;
        if (!it.caught) {
          misses += 1;
          handleError('Number');
          willpowerDebuff = true;
          endP1(false);
          return;
        }
        p1.removeChild(it.el);
      }
    });
    trackedSetTimeout(() => requestAnimationFrame(gameLoop), 0);
  }
  const spawnTimer = trackedSetInterval(() => { if (running && activeItems().length < 4) spawnFo(); }, 900);
  let endTimer = null;
  document.addEventListener('keydown', (ev) => { if (!running || isGameOver) return; if (ev.key === 'ArrowLeft' || ev.key === 'a') setCatcherX(ctrl.x - ctrl.speed); if (ev.key === 'ArrowRight' || ev.key === 'd') setCatcherX(ctrl.x + ctrl.speed); });
  p1.addEventListener('mousemove', (ev) => { const r = p1.getBoundingClientRect(); setCatcherX((ev.clientX - r.left) / r.width); });
  p1.addEventListener('touchmove', (ev) => { const t = ev.touches[0]; if (!t) return; const r = p1.getBoundingClientRect(); setCatcherX((t.clientX - r.left) / r.width); }, { passive: true });
  showConfirmModal('提示', '準備好了嗎？', '準備好了', () => { running = true; lastTs = nowMs(); requestAnimationFrame(gameLoop); });

  function renderP2() {
    level.innerHTML = '';
    const t2 = document.createElement('h2');
    t2.className = 'modal-title';
    t2.textContent = '第七關：諫迎佛骨';
    level.appendChild(t2);
    rageValue = willpowerDebuff ? 50 : 30;
    pleaPoint = 0;
    let courtOpinionValue = 50;
    let courtDebuffNext = false;
    const stats = document.createElement('p');
    stats.className = 'dialog-text';
    stats.textContent = `怒氣：${rageValue} / 100　勸諫：${pleaPoint} / 4　朝臣：${courtOpinionValue} / 100`;
    level.appendChild(stats);
    const cards = document.createElement('div');
    cards.className = 'options';
    function updateStats() { stats.textContent = `怒氣：${rageValue} / 100　勸諫：${pleaPoint} / 4　朝臣：${courtOpinionValue} / 100`; }
    let locked = false;
    function applyAction(kind) {
      if (locked || blockingModalOpen || isGameOver) return;
      const base = rageValue;
      const debuffNow = courtDebuffNext === true;
      courtDebuffNext = false;
      let rageDelta = 0;
      let pleaDelta = 0;
      let courtDelta = 0;
      if (kind === 'A') { rageDelta += 35; pleaDelta += (base <= 40 ? 2 : 1); if (base > 70) rageDelta += 15; courtDelta -= 15; }
      else if (kind === 'B') { rageDelta -= 25; if (willpowerDebuff) rageDelta += 5; if (base < 30) rageDelta += 5; courtDelta -= 5; }
      else if (kind === 'C') { rageDelta += 20; pleaDelta += 1; if (base > 80) rageDelta += 15; courtDelta += 15; }
      else if (kind === 'D') { rageDelta -= 10; if (base > 85) rageDelta += 10; courtDelta -= 10; }
      if (debuffNow) rageDelta += 10;
      rageValue = Math.max(0, Math.min(100, rageValue + rageDelta));
      pleaPoint = Math.max(0, Math.min(4, pleaPoint + pleaDelta));
      courtOpinionValue = Math.max(0, Math.min(100, courtOpinionValue + courtDelta));
      updateStats();
      courtDebuffNext = courtOpinionValue < 20;
      if (rageValue >= 100) {
        locked = true;
        errorCount = Math.max(errorCount, 1);
        customNumberFailText = '遭斬';
        handleError('Number');
        return;
      }
      if (pleaPoint >= 4 && rageValue < 100 && courtOpinionValue >= 80) {
        locked = true;
        showBlockModal('通關', [{ text: '進入潮州貶謫' }], () => { level.style.display = 'none'; goToNextLevel(); });
      }
    }
    const a = document.createElement('button'); a.className = 'button option'; a.type = 'button'; a.textContent = '終極勸諫'; a.addEventListener('click', () => applyAction('A'));
    const b = document.createElement('button'); b.className = 'button option'; b.type = 'button'; b.textContent = '極度恭維'; b.addEventListener('click', () => applyAction('B'));
    const c = document.createElement('button'); c.className = 'button option'; c.type = 'button'; c.textContent = '溫和批判'; c.addEventListener('click', () => applyAction('C'));
    const d = document.createElement('button'); d.className = 'button option'; d.type = 'button'; d.textContent = '自謙求情'; d.addEventListener('click', () => applyAction('D'));
    cards.appendChild(a);
    cards.appendChild(b);
    cards.appendChild(c);
    cards.appendChild(d);
    level.appendChild(cards);
  }
}

function startCrocodileLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelCrocodile');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelCrocodile';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第八關：祭鱷魚文';
  level.appendChild(title);
  const stage = document.createElement('div');
  stage.className = 'croc-stage';
  level.appendChild(stage);
  stage.tabIndex = 0;

  stage.innerHTML = '';
  const ui = document.createElement('div'); ui.id = 'ui-layer'; stage.appendChild(ui);
  const target = document.createElement('div'); target.id = 'target-sentence'; target.className = 'dialog-text'; ui.appendChild(target);
  const canvas = document.createElement('canvas'); canvas.id = 'game-board';
  const rect = stage.getBoundingClientRect();
  canvas.width = Math.max(200, Math.floor(rect.width));
  canvas.height = Math.max(200, Math.floor(rect.height));
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const gridSize = 40;
  const tileCountX = Math.floor(canvas.width / gridSize);
  const tileCountY = Math.floor(canvas.height / gridSize);
  const rng = () => Math.random();
  const sentences = [
    '以與鱷魚食',
    '且承天子命',
    '雜處此土也',
    '其聽刺史言',
    '其率醜類',
    '四海之外',
    '朝發而夕至',
    '必盡殺乃止',
  ];
  const sentence = sentences[Math.floor(rng() * sentences.length)];
  const chars = Array.from(sentence).filter(c => /[\u4E00-\u9FFF]/.test(c));
  target.textContent = '';
  target.style.display = 'none';
  let snake = [{ x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }];
  let velocity = { x: 0, y: 0 };
  let gameLoop = null;
  let currentIndex = 0;
  const foodItems = [];
  const occupied = new Set([`${snake[0].x},${snake[0].y}`]);
  let hintShown = false;
  let lastProgressAt = performance.now();

  function spawnFoods() {
    foodItems.length = 0;
    occupied.clear();
    occupied.add(`${snake[0].x},${snake[0].y}`);
    const total = chars.length;
    const marginX = 1;
    const marginTop = 2;
    const marginBottom = 1;
    const candidates = [];
    for (let x = marginX; x <= tileCountX - 1 - marginX; x++) {
      for (let y = marginTop; y <= tileCountY - 1 - marginBottom; y++) {
        if (x === snake[0].x && y === snake[0].y) continue;
        candidates.push({ x, y });
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    const chosen = [];
    const minDist = 2;
    function farEnough(p) {
      for (let k = 0; k < chosen.length; k++) {
        const q = chosen[k];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        if (Math.abs(dx) + Math.abs(dy) < minDist) return false;
      }
      return true;
    }
    for (let i = 0; i < candidates.length && chosen.length < total; i++) {
      const p = candidates[i];
      if (!occupied.has(`${p.x},${p.y}`) && farEnough(p)) {
        chosen.push(p);
        occupied.add(`${p.x},${p.y}`);
      }
    }
    for (let i = 0; i < candidates.length && chosen.length < total; i++) {
      const p = candidates[i];
      if (!occupied.has(`${p.x},${p.y}`)) {
        chosen.push(p);
        occupied.add(`${p.x},${p.y}`);
      }
    }
    for (let i = 0; i < total; i++) {
      const pos = chosen[i] || { x: 0, y: 0 };
      foodItems.push({ x: pos.x, y: pos.y, idx: i, ch: chars[i] });
    }
  }
  spawnFoods();


  function resetLevelState() {
    if (gameLoop) { clearInterval(gameLoop); gameLoop = null; }
    velocity = { x: 0, y: 0 };
    currentIndex = 0;
    hintShown = false;
    lastProgressAt = performance.now();
    snake = [{ x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }];
    occupied.clear();
    occupied.add(`${snake[0].x},${snake[0].y}`);
    spawnFoods();
    drawBackground();
    drawFoods();
    drawSnake();
    document.addEventListener('keydown', keyListener, { passive: false });
    if (!gameLoop) gameLoop = trackedSetInterval(step, 150);
  }

  function drawBackground() {
    ctx.fillStyle = '#0d1108';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(80,120,60,0.15)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= tileCountX; gx++) { ctx.beginPath(); ctx.moveTo(gx * gridSize, 0); ctx.lineTo(gx * gridSize, canvas.height); ctx.stroke(); }
    for (let gy = 0; gy <= tileCountY; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * gridSize); ctx.lineTo(canvas.width, gy * gridSize); ctx.stroke(); }
  }


  function drawFoods() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px Noto Serif TC, serif';
    foodItems.forEach(item => {
      const hinted = hintShown && item.idx === currentIndex;
      ctx.fillStyle = hinted ? '#f8e78e' : '#b7b7b7';
      ctx.fillText(item.ch, item.x * gridSize + gridSize / 2, item.y * gridSize + gridSize / 2);
    });
  }

  function drawSnake() {
    ctx.fillStyle = '#2fb84f';
    snake.forEach(seg => { ctx.fillRect(seg.x * gridSize + 4, seg.y * gridSize + 4, gridSize - 8, gridSize - 8); });
  }
  function stopGame() {
    if (gameLoop) { clearInterval(gameLoop); gameLoop = null; }
    if (keyListener) { document.removeEventListener('keydown', keyListener, { passive: false }); }
  }
  function onFail() {
    if (gameLoop) { clearInterval(gameLoop); gameLoop = null; }
    velocity = { x: 0, y: 0 };
    handleError('Number');
  }
  function step() {
    if (velocity.x !== 0 || velocity.y !== 0) {
      const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
      if (head.x < 0 || head.y < 0 || head.x >= tileCountX || head.y >= tileCountY) { onFail(); return; }
      for (let i = 0; i < snake.length; i++) { if (snake[i].x === head.x && snake[i].y === head.y) { onFail(); return; } }
      snake.unshift(head);
      const hitIndex = foodItems.findIndex(f => f.x === head.x && f.y === head.y);
      if (hitIndex >= 0) {
        const item = foodItems[hitIndex];
        if (item.idx === currentIndex) {
          foodItems.splice(hitIndex, 1);
          currentIndex += 1;
          hintShown = false;
          lastProgressAt = performance.now();
          if (currentIndex >= chars.length) { stopGame(); showBlockModal('通關', [{ text: '鱷魚被驅逐，江岸重歸寧靜。' }], () => { level.style.display = 'none'; goToNextLevel(); }); return; }
        } else { onFail(); return; }
      } else { snake.pop(); }
    }
    drawBackground();
    drawFoods();
    drawSnake();
  }
  let keyListener = (ev) => {
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') ev.preventDefault();
    if (isGameOver || blockingModalOpen) return;
    if (k === 'ArrowLeft' || k === 'a') { if (velocity.x !== 1) velocity = { x: -1, y: 0 }; }
    else if (k === 'ArrowRight' || k === 'd') { if (velocity.x !== -1) velocity = { x: 1, y: 0 }; }
    else if (k === 'ArrowUp' || k === 'w') { if (velocity.y !== 1) velocity = { x: 0, y: -1 }; }
    else if (k === 'ArrowDown' || k === 's') { if (velocity.y !== -1) velocity = { x: 0, y: 1 }; }
  };
  document.addEventListener('keydown', keyListener, { passive: false });
  gameLoop = trackedSetInterval(step, 1000 / 8);
  trackedSetInterval(() => {
    const now = performance.now();
    const idleMs = now - lastProgressAt;
    if (!hintShown && idleMs >= 10000) hintShown = true;
  }, 500);

  window.level8Reset = resetLevelState;
}

function startEpitaphLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelEpitaph');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelEpitaph';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第九關：為友撰銘';
  level.appendChild(title);

  const intro = document.createElement('p');
  intro.className = 'dialog-text';
  intro.textContent = '請精確輸入下列文本（含標點）：';
  level.appendChild(intro);

  const targetText = '子厚，諱宗元。七世祖慶，為拓跋魏侍中，封濟陰公。曾伯祖奭，為唐宰相，與褚遂良、韓瑗俱得罪武后，死高宗朝。皇考諱鎮，以事母棄太常博士，求為縣令江南。其後以不能媚權貴，失禦史。權貴人死，乃複拜侍御史。號為剛直，所與遊皆當世名人。';
  const target = document.createElement('p');
  target.className = 'dialog-text';
  target.textContent = targetText;
  level.appendChild(target);
  target.style.userSelect = 'none';
  target.addEventListener('selectstart', (e) => e.preventDefault());
  target.addEventListener('copy', (e) => e.preventDefault());
  target.addEventListener('cut', (e) => e.preventDefault());
  target.addEventListener('contextmenu', (e) => e.preventDefault());

  const input = document.createElement('textarea');
  input.className = 'typing-input';
  input.rows = 6;
  input.placeholder = '從頭開始輸入…';
  level.appendChild(input);
  input.addEventListener('paste', (e) => { e.preventDefault(); });
  input.addEventListener('drop', (e) => { e.preventDefault(); });
  input.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); return; }
    if (e.shiftKey && e.key === 'Insert') { e.preventDefault(); return; }
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const submit = document.createElement('button');
  submit.className = 'button';
  submit.type = 'button';
  submit.textContent = '提交';
  actions.appendChild(submit);
  level.appendChild(actions);

  const status = document.createElement('p');
  status.className = 'dialog-text';
  status.textContent = `進度：0 / ${targetText.length}`;
  level.appendChild(status);

  let locked = false;
  function resetChallenge() {
    locked = false;
    input.disabled = false;
    input.value = '';
    status.textContent = `進度：0 / ${targetText.length}`;
    input.focus();
  }
  window.level9Reset = resetChallenge;

  input.addEventListener('input', () => {
    if (locked || isGameOver || blockingModalOpen) return;
    const len = input.value.length;
    status.textContent = `進度：${len} / ${targetText.length}`;
  });

  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    if (locked || isGameOver || blockingModalOpen) return;
    if (composing) return;
    const v = input.value;
    if (v === targetText) {
      locked = true;
      input.disabled = true;
      showBlockModal('通關', [
        { text: '墓誌銘完成，字跡剛勁有力，韓愈表情釋然。' },
        { text: '「文成！ 你明白了文以載道的真義，在公義與私情之間劃下了最完美的句點。你的道統，無人可撼動。」' },
      ], () => { level.style.display = 'none'; goToNextLevel(); });
    } else {
      locked = true;
      input.disabled = true;
      showPunishOverlay();
      handleError('Number');
    }
  });

  submit.addEventListener('click', () => {
    if (locked || isGameOver || blockingModalOpen) return;
    if (composing) return;
    const v = input.value;
    if (v === targetText) {
      locked = true;
      input.disabled = true;
      showBlockModal('通關', [
        { text: '墓誌銘完成，字跡剛勁有力，韓愈表情釋然。' },
        { text: '「文成！ 你明白了文以載道的真義，在公義與私情之間劃下了最完美的句點。你的道統，無人可撼動。」' },
      ], () => { level.style.display = 'none'; goToNextLevel(); });
    } else {
      locked = true;
      input.disabled = true;
      showPunishOverlay();
      handleError('Number');
    }
  });

  showConfirmModal('提示', '準備好了嗎？開始臨摹。', '開始', () => { input.focus(); });
}

function startFiveOriginalsLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  const img = document.getElementById('characterImage');
  if (img) img.src = 'han_yu_youth.png';
  showHpBar();
  updateHpBar();
  mismatchCounter = 0;
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelFiveOriginals');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelFiveOriginals';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第五關：五原立論';
  level.appendChild(title);

  const fiveOriginalsCards = [
    { title: '《原道》', doctrine: '弘揚仁義，驅逐佛老。' },
    { title: '《原性》', doctrine: '性有三品：上中下。' },
    { title: '《原人》', doctrine: '聖人合德，賢人弘道。' },
    { title: '《原毀》', doctrine: '不進則退，退則招毀。' },
    { title: '《原鬼》', doctrine: '鬼神之說，因人附會。' },
  ];

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  level.appendChild(grid);

  const cards = [];
  fiveOriginalsCards.forEach((it, idx) => {
    cards.push({ key: String(idx), type: 'title', text: it.title });
    cards.push({ key: String(idx), type: 'doctrine', text: it.doctrine });
  });

  const shuffled = sampleQuestions(cards, cards.length);
  const state = { open: [], matched: 0, previewing: true, lock: false };

  shuffled.forEach(info => {
    const card = document.createElement('button');
    card.className = 'match-card';
    card.type = 'button';
    card.dataset.key = info.key;
    card.dataset.type = info.type;
    const inner = document.createElement('div');
    inner.className = 'card-inner';
    const back = document.createElement('div');
    back.className = 'card-face card-back';
    back.textContent = '原';
    const front = document.createElement('div');
    front.className = 'card-face card-front';
    front.textContent = info.text;
    inner.appendChild(back);
    inner.appendChild(front);
    card.appendChild(inner);
    card.addEventListener('click', () => {
      if (state.previewing || state.lock) return;
      if (card.classList.contains('open')) return;
      card.classList.add('open');
      state.open.push(card);
      if (state.open.length === 2) {
        state.lock = true;
        const a = state.open[0];
        const b = state.open[1];
        const ok = a.dataset.key === b.dataset.key && a.dataset.type !== b.dataset.type;
        if (ok) {
          matchScore += 10;
          setTimeout(() => {
            a.classList.add('matched');
            b.classList.add('matched');
            a.classList.remove('open');
            b.classList.remove('open');
            state.open = [];
            state.matched += 1;
            mismatchCounter = 0;
            state.lock = false;
            if (state.matched === 5) {
              showBlockModal('通關', [{ text: '文成！你將重回京城，準備大展經綸！' }], () => { level.style.display = 'none'; goToNextLevel(); });
            }
          }, 200);
        } else {
          mismatchCounter += 1;
          setTimeout(() => {
            a.classList.remove('open');
            b.classList.remove('open');
            state.open = [];
            state.lock = false;
            if (mismatchCounter >= 5) {
              handleError('Number');
              showBlockModal('警告', [{ text: '身體與靈魂不匹配的警告...請再次感受文脈的邏輯...' }]);
              mismatchCounter = 0;
            }
          }, 1000);
        }
      }
    });
    grid.appendChild(card);
  });

  Array.from(grid.children).forEach(el => el.classList.add('open'));
  setTimeout(() => {
    state.previewing = false;
    Array.from(grid.children).forEach(el => el.classList.remove('open'));
    state.lock = false;
  }, 3000);
}

function startPoetryLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  customNumberFailText = '文氣渙散，精神不濟！...魂歸寒流。';
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelPoetry');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelPoetry';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第四關：結交孟郊';
  level.appendChild(title);

  const poetryLevelQuestions = [
    { title: '列女操', author: '孟郊', lines: ['梧桐相待老，鴛鴦會雙死。', '貞女貴徇夫，舍生亦如此。', '波瀾誓不起，妾心井中水。'], full_text: '梧桐相待老，鴛鴦會雙死。貞女貴徇夫，舍生亦如此。波瀾誓不起，妾心井中水。' },
    { title: '長安道', author: '孟郊', lines: ['胡風激秦樹，賤子風中泣。家家朱門開，得見不可入。', '長安十二衢，投樹鳥亦急。高閣何人家，笙簧正喧吸。'], full_text: '胡風激秦樹，賤子風中泣。家家朱門開，得見不可入。長安十二衢，投樹鳥亦急。高閣何人家，笙簧正喧吸。' },
    { title: '送遠吟', author: '孟郊', lines: ['河水昏複晨，河邊相送頻。離杯有淚飲，別柳無枝春。', '一笑忽然斂，萬愁俄已新。東波與西日，不惜遠行人。'], full_text: '河水昏複晨，河邊相送頻。離杯有淚飲，別柳無枝春。一笑忽然斂，萬愁俄已新。東波與西日，不惜遠行人。' },
    { title: '古離別（一作對景惜別）', author: '孟郊', lines: ['松山雲繚繞，萍路水分離。雲去有歸日，水分無合時。', '春芳役雙眼，春色柔四支。楊柳織別愁，千條萬條絲。'], full_text: '松山雲繚繞，萍路水分離。雲去有歸日，水分無合時。春芳役雙眼，春色柔四支。楊柳織別愁，千條萬條絲。' },
    { title: '靜女吟', author: '孟郊', lines: ['豔女皆妒色，靜女獨檢蹤。任禮恥任妝，嫁德不嫁容。', '君子易求聘，小人難自從。此志誰與諒，琴弦幽韻重。'], full_text: '豔女皆妒色，靜女獨檢蹤。任禮恥任妝，嫁德不嫁容。君子易求聘，小人難自從。此志誰與諒，琴弦幽韻重。' },
    { title: '歸信吟', author: '孟郊', lines: ['淚墨灑為書，將寄萬里親。書去魂亦去，兀然空一身。'], full_text: '淚墨灑為書，將寄萬里親。書去魂亦去，兀然空一身。' },
    { title: '山老吟', author: '孟郊', lines: ['不行山下地，唯種山上田。腰斧斫旅松，手瓢汲家泉。', '詎知文字力，莫記日月遷。蟠木為我身，始得全天年。'], full_text: '不行山下地，唯種山上田。腰斧斫旅松，手瓢汲家泉。詎知文字力，莫記日月遷。蟠木為我身，始得全天年。' },
    { title: '遊子吟（迎母漂上作）', author: '孟郊', lines: ['慈母手中線，遊子身上衣。', '臨行密密縫，意恐遲遲歸。', '誰言寸草心，報得三春暉。'], full_text: '慈母手中線，遊子身上衣。臨行密密縫，意恐遲遲歸。誰言寸草心，報得三春暉。' },
    { title: '小隱吟', author: '孟郊', lines: ['我飲不在醉，我歡長寂然。酌溪四五盞，聽彈兩三弦。', '煉性靜棲白，洗情深寄玄。號怒路傍子，貪敗不貪全。'], full_text: '我飲不在醉，我歡長寂然。酌溪四五盞，聽彈兩三弦。煉性靜棲白，洗情深寄玄。號怒路傍子，貪敗不貪全。' },
    { title: '苦寒吟', author: '孟郊', lines: ['天寒色青蒼，北風叫枯桑。厚冰無裂文，短日有冷光。', '敲石不得火，壯陰奪正陽。苦調竟何言，凍吟成此章。'], full_text: '天寒色青蒼，北風叫枯桑。厚冰無裂文，短日有冷光。敲石不得火，壯陰奪正陽。苦調竟何言，凍吟成此章。' },
    { title: '猛將吟', author: '孟郊', lines: ['擬膾樓蘭肉，蓄怒時未揚。秋鼙無退聲，夜劍不隱光。', '虎隊手驅出，豹篇心卷藏。古今皆有言，猛將出北方。'], full_text: '擬膾樓蘭肉，蓄怒時未揚。秋鼙無退聲，夜劍不隱光。虎隊手驅出，豹篇心卷藏。古今皆有言，猛將出北方。' },
    { title: '怨詩（一作古怨）', author: '孟郊', lines: ['試妾與君淚，兩處滴池水。看取芙蓉花，今年為誰死。'], full_text: '試妾與君淚，兩處滴池水。看取芙蓉花，今年為誰死。' },
    { title: '邊城吟', author: '孟郊', lines: ['西城近日天，俗稟氣候偏。行子獨自渴，主人仍賣泉。', '燒烽碧雲外，牧馬青坡巔。何處鶻突夢，歸思寄仰眠。'], full_text: '西城近日天，俗稟氣候偏。行子獨自渴，主人仍賣泉。燒烽碧雲外，牧馬青坡巔。何處鶻突夢，歸思寄仰眠。' },
    { title: '新平歌送許問', author: '孟郊', lines: ['邊柳三四尺，暮春離別歌。', '早回儒士駕，莫飲土番河。', '誰識匣中寶，楚雲章句多。'], full_text: '邊柳三四尺，暮春離別歌。早回儒士駕，莫飲土番河。誰識匣中寶，楚雲章句多。' },
    { title: '弦歌行', author: '孟郊', lines: ['驅儺擊鼓吹長笛，瘦鬼染面惟齒白。', '暗中崒崒拽茅鞭，倮足朱褌行戚戚。', '相顧笑聲沖庭燎，桃弧射矢時獨叫。'], full_text: '驅儺擊鼓吹長笛，瘦鬼染面惟齒白。暗中崒崒拽茅鞭，倮足朱褌行戚戚。相顧笑聲沖庭燎，桃弧射矢時獨叫。' },
    { title: '巫山高', author: '孟郊', lines: ['見盡數萬里，不聞三聲猿。但飛蕭蕭雨，中有亭亭魂。', '千載楚王恨，遺文宋玉言。至今晴明天，雲結深閨門。'], full_text: '見盡數萬里，不聞三聲猿。但飛蕭蕭雨，中有亭亭魂。千載楚王恨，遺文宋玉言。至今晴明天，雲結深閨門。' },
    { title: '楚怨', author: '孟郊', lines: ['秋入楚江水，獨照汨羅魂。', '手把綠荷泣，意愁珠淚翻。', '九門不可入，一犬吠千門。'], full_text: '秋入楚江水，獨照汨羅魂。手把綠荷泣，意愁珠淚翻。九門不可入，一犬吠千門。' },
    { title: '塘下行', author: '孟郊', lines: ['塘邊日欲斜，年少早還家。', '徒將白羽扇，調妾木蘭花。', '不是城頭樹，那棲來去鴉。'], full_text: '塘邊日欲斜，年少早還家。徒將白羽扇，調妾木蘭花。不是城頭樹，那棲來去鴉。' },
    { title: '臨池曲', author: '孟郊', lines: ['池中春蒲葉如帶，紫菱成角蓮子大。', '羅裙蟬鬢倚迎風，雙雙伯勞飛向東。'], full_text: '池中春蒲葉如帶，紫菱成角蓮子大。羅裙蟬鬢倚迎風，雙雙伯勞飛向東。' },
    { title: '空城雀', author: '孟郊', lines: ['一雀入官倉，所食寧損幾。只慮往覆頻，官倉終害爾。', '魚網不在天，鳥羅不張水。飲啄要自然，可以空城裡。'], full_text: '一雀入官倉，所食寧損幾。只慮往覆頻，官倉終害爾。魚網不在天，鳥羅不張水。飲啄要自然，可以空城裡。' },
    { title: '遊俠行', author: '孟郊', lines: ['壯士性剛決，火中見石裂。殺人不回頭，輕生如暫別。', '豈知眼有淚，肯白頭上髮。半生無恩酬，劍閑一百月。'], full_text: '壯士性剛決，火中見石裂。殺人不回頭，輕生如暫別。豈知眼有淚，肯白頭上髮。半生無恩酬，劍閑一百月。' },
    { title: '求仙曲', author: '孟郊', lines: ['仙教生為門，仙宗靜為根。持心若妄求，服食安足論。', '鏟惑有靈藥，餌真成本源。自當出塵網，馭鳳登昆侖。'], full_text: '仙教生為門，仙宗靜為根。持心若妄求，服食安足論。鏟惑有靈藥，餌真成本源。自當出塵網，馭鳳登昆侖。' },
    { title: '南浦篇', author: '孟郊', lines: ['南浦桃花亞水紅，水邊柳絮由春風。鳥鳴喈喈煙濛濛，', '自從遠送對悲翁。此翁已與少年別，唯憶深山深谷中。'], full_text: '南浦桃花亞水紅，水邊柳絮由春風。鳥鳴喈喈煙濛濛。自從遠送對悲翁。此翁已與少年別，唯憶深山深谷中。' },
    { title: '和丁助教塞上吟', author: '孟郊', lines: ['哭雪複吟雪，廣文丁夫子。江南萬里寒，曾未及如此。', '整頓氣候誰，言從生靈始。無令惻隱者，哀哀不能已。'], full_text: '哭雪複吟雪，廣文丁夫子。江南萬里寒，曾未及如此。整頓氣候誰，言從生靈始。無令惻隱者，哀哀不能已。' },
    { title: '衰松', author: '孟郊', lines: ['近世交道衰，青松落顏色。人心忌孤直，木性隨改易。', '既摧棲日干，未展擎天力。終是君子材，還思君子識。'], full_text: '近世交道衰，青松落顏色。人心忌孤直，木性隨改易。既摧棲日干，未展擎天力。終是君子材，還思君子識。' },
    { title: '遣興', author: '孟郊', lines: ['弦貞五條音，松直百尺心。', '貞弦含古風，直松淩高岑。', '浮聲與狂葩，胡為欲相侵。'], full_text: '弦貞五條音，松直百尺心。貞弦含古風，直松淩高岑。浮聲與狂葩，胡為欲相侵。' },
    { title: '退居（一作退老）', author: '孟郊', lines: ['退身何所食，敗力不能閑。種稻耕白水，負薪斫青山。', '眾聽喜巴唱，獨醒愁楚顏。日暮靜歸時，幽幽扣松關。'], full_text: '退身何所食，敗力不能閑。種稻耕白水，負薪斫青山。眾聽喜巴唱，獨醒愁楚顏。日暮靜歸時，幽幽扣松關。' },
    { title: '獨愁（一作獨怨，一作贈韓愈）', author: '孟郊', lines: ['前日遠別離，昨日生白髮。', '欲知萬里情，曉臥半床月。', '常恐百蟲鳴，使我芳草歇。'], full_text: '前日遠別離，昨日生白髮。欲知萬里情，曉臥半床月。常恐百蟲鳴，使我芳草歇。' },
    { title: '春日有感', author: '孟郊', lines: ['雨滴草芽出，一日長一日。風吹柳線垂，一枝連一枝。', '獨有愁人顏，經春如等閒。且持酒滿杯，狂歌狂笑來。'], full_text: '雨滴草芽出，一日長一日。風吹柳線垂，一枝連一枝。獨有愁人顏，經春如等閒。且持酒滿杯，狂歌狂笑來。' },
    { title: '將見故人', author: '孟郊', lines: ['故人季夏中，及此百餘日。無日不相思，明鏡改形色。', '甯知仲冬時，忽有相逢期。振衣起躑躅，赬鯉躍天池。'], full_text: '故人季夏中，及此百餘日。無日不相思，明鏡改形色。甯知仲冬時，忽有相逢期。振衣起躑躅，赬鯉躍天池。' },
    { title: '勸學', author: '孟郊', lines: ['擊石乃有火，不擊元無煙。人學始知道，不學非自然。', '萬事須己運，他得非我賢。青春須早為，豈能長少年。'], full_text: '擊石乃有火，不擊元無煙。人學始知道，不學非自然。萬事須己運，他得非我賢。青春須早為，豈能長少年。' },
    { title: '勸友', author: '孟郊', lines: ['至白涅不緇，至交淡不疑。人生靜躁殊，莫厭相箴規。', '膠漆武可接，金蘭文可思。堪嗟無心人，不如松柏枝。'], full_text: '至白涅不緇，至交淡不疑。人生靜躁殊，莫厭相箴規。膠漆武可接，金蘭文可思。堪嗟無心人，不如松柏枝。' },
    { title: '夷門雪贈主人（是贈陸長源，陸有答詩）', author: '孟郊', lines: ['夷門貧士空吟雪，夷門豪士皆飲酒。酒聲歡閑入雪銷，', '雪聲激切悲枯朽。悲歡不同歸去來，萬里春風動江柳。'], full_text: '夷門貧士空吟雪，夷門豪士皆飲酒。酒聲歡閑入雪銷。雪聲激切悲枯朽。悲歡不同歸去來，萬里春風動江柳。' },
    { title: '聞砧', author: '孟郊', lines: ['杜鵑聲不哀，斷猿啼不切。月下誰家砧，一聲腸一絕。', '杵聲不為客，客聞發自白。杵聲不為衣，欲令遊子歸。'], full_text: '杜鵑聲不哀，斷猿啼不切。月下誰家砧，一聲腸一絕。杵聲不為客，客聞發自白。杵聲不為衣，欲令遊子歸。' },
    { title: '酒德', author: '孟郊', lines: ['酒是古明鏡，輾開小人心。醉見異舉止，醉聞異聲音。', '酒功如此多，酒屈亦以深。罪人免罪酒，如此可為箴。'], full_text: '酒是古明鏡，輾開小人心。醉見異舉止，醉聞異聲音。酒功如此多，酒屈亦以深。罪人免罪酒，如此可為箴。' },
    { title: '登科後', author: '孟郊', lines: ['昔日齷齪不足誇，今朝放蕩思無涯。', '春風得意馬蹄疾，一日看盡長安花。'], full_text: '昔日齷齪不足誇，今朝放蕩思無涯。春風得意馬蹄疾，一日看盡長安花。' },
  ];

  const idxs = Array.from({ length: poetryLevelQuestions.length }, (_, i) => i);
  const pick = sampleQuestions(idxs, 2);
  const q1Poem = poetryLevelQuestions[pick[0]];
  const q2Poem = poetryLevelQuestions[pick[1]];

  function renderQ1() {
    level.innerHTML = '';
    level.appendChild(title);
    const prompt = document.createElement('p');
    prompt.className = 'dialog-text';
    prompt.textContent = 'Q1：選詩名';
    level.appendChild(prompt);
    const content = document.createElement('p');
    content.className = 'dialog-text';
    content.textContent = q1Poem.full_text;
    level.appendChild(content);
    const options = document.createElement('div');
    options.className = 'options';
    const distractorTitles = shuffleArray(idxs.filter(i => i !== pick[0])).slice(0, 3).map(i => poetryLevelQuestions[i].title);
    const all = shuffleArray([q1Poem.title, ...distractorTitles]);
    all.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'button option';
      btn.type = 'button';
      btn.textContent = t;
      btn.addEventListener('click', () => {
        const ok = t === q1Poem.title;
        if (ok) {
          matchScore += 10;
          renderQ2();
        } else {
          handleError('Number');
          showPunishOverlay();
          showBlockModal('警告', [{ text: '身體與靈魂不匹配的警告...' }], () => { renderQ2(); });
        }
      });
      options.appendChild(btn);
    });
    level.appendChild(options);
  }

  function renderQ2() {
    level.innerHTML = '';
    level.appendChild(title);
    const prompt = document.createElement('p');
    prompt.className = 'dialog-text';
    prompt.textContent = 'Q2：詩句填空';
    level.appendChild(prompt);
    const missingIndex = Math.floor(Math.random() * q2Poem.lines.length);
    const displayLines = q2Poem.lines.map((ln, i) => (i === missingIndex ? '______' : ln));
    const content = document.createElement('p');
    content.className = 'dialog-text';
    content.textContent = displayLines.join('，');
    level.appendChild(content);
    const options = document.createElement('div');
    options.className = 'options';
    const otherLines = poetryLevelQuestions.filter(p => p !== q2Poem).flatMap(p => p.lines);
    const distractorLines = shuffleArray(otherLines.filter(ln => ln !== q2Poem.lines[missingIndex])).slice(0, 3);
    const all = shuffleArray([q2Poem.lines[missingIndex], ...distractorLines]);
    all.forEach(line => {
      const btn = document.createElement('button');
      btn.className = 'button option';
      btn.type = 'button';
      btn.textContent = line;
      btn.addEventListener('click', () => {
        const ok = line === q2Poem.lines[missingIndex];
        if (ok) {
          matchScore += 10;
          showBlockModal('通關', [{ text: '文成！韓愈與孟郊月下推敲，將一起開創盛唐之後的另一番氣象。' }], () => { level.style.display = 'none'; goToNextLevel(); });
        } else {
          handleError('Number');
          if (errorCount === 1) {
            showPunishOverlay();
            showBlockModal('警告', [{ text: '身體與靈魂不匹配的警告...' }]);
          }
        }
      });
      options.appendChild(btn);
    });
    level.appendChild(options);
  }

  renderQ1();
}

function startHuaiXiLevel() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelHuaiXi');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelHuaiXi';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第六關：平定淮西';
  level.appendChild(title);

  const huaiXiQuestions = [
    { text: '「四」聖不宥', answer: '四' },
    { text: '「百」隸怠官', answer: '百' },
    { text: '「六」州降從', answer: '六' },
    { text: '「三」方分攻', answer: '三' },
    { text: '「五萬」其師', answer: '五萬' },
    { text: '其壃「千」里', answer: '千' },
    { text: '即伐「四」年', answer: '四' },
    { text: '「四」夷畢來', answer: '四' },
  ];
  const distractNumbers = ['一','二','五','七','八','九','十','百','千','萬'];
  const specials = ['緩','繁'];

  const q = sampleQuestions(huaiXiQuestions, 1)[0];
  const prompt = document.createElement('p');
  prompt.className = 'dialog-text';
  const masked = String(q.text).replace(/「[^」]*」/g, '「」');
  prompt.textContent = `挑戰：${masked}`;
  level.appendChild(prompt);

  const stage = document.createElement('div');
  stage.className = 'catch-stage';
  const catcher = document.createElement('div');
  catcher.className = 'catcher';
  stage.appendChild(catcher);
  level.appendChild(stage);

  let running = false;
  let needSecondChallenge = false;
  let slowUntil = 0;
  let targetCaught = false;
  let firstWaveTargetSpawned = false;
  const items = [];
  const rng = () => Math.random();
  const nowMs = () => performance.now();

  const ctrl = { x: 0.5, speed: 0.7 }; // normalized x [0,1]

  function setCatcherX(nx) {
    ctrl.x = Math.max(0, Math.min(1, nx));
    catcher.style.left = (ctrl.x * 100) + '%';
  }
  setCatcherX(0.5);

  function handleMove(dir, dt) {
    const base = ctrl.speed;
    const slow = nowMs() < slowUntil ? base * 0.4 : base;
    setCatcherX(ctrl.x + dir * slow * dt);
  }

  let lastTs = nowMs();
  function gameLoop() {
    if (!running) return;
    const ts = nowMs();
    const dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    items.forEach(it => {
      it.y += it.v * dt;
      it.el.style.top = (it.y * 100) + '%';
      if (!it.caught && it.y >= 0.92) {
        const cx = ctrl.x;
        if (Math.abs(cx - it.x) <= 0.08) {
          it.caught = true;
          if (it.kind === 'target') {
            targetCaught = true;
            running = false;
            showBlockModal('提示', [{ text: '目標已捕獲！' }], () => {
              trackedSetTimeout(() => {
                showBlockModal('通關', [{ text: '韓愈獲授刑部侍郎官服，功成名就！' }], () => { level.style.display = 'none'; goToNextLevel(); });
              }, 700);
            });
          } else if (it.kind === 'slow') {
            running = false;
            slowUntil = nowMs() + 3000;
            showBlockModal('提示', [{ text: '速度降低（緩）' }], () => {
              showCountdown(() => { running = true; lastTs = nowMs(); requestAnimationFrame(gameLoop); });
            });
          } else if (it.kind === 'complex') {
            running = false;
            needSecondChallenge = true;
            showBlockModal('提示', [{ text: '挑戰升級（繁）' }], () => {
              showCountdown(() => { running = true; lastTs = nowMs(); requestAnimationFrame(gameLoop); });
            });
          } else if (it.kind === 'wrong') {
            running = false;
            handleError('Number');
            showBlockModal('警告', [{ text: '身體與靈魂不匹配的警告...' }], () => {
              const stillHere = document.getElementById('levelHuaiXi');
              if (stillHere) {
                showCountdown(() => { running = true; lastTs = nowMs(); requestAnimationFrame(gameLoop); });
              }
            });
          }
        }
      }
      if (it.y > 1.2 && !it.removed) {
        it.removed = true;
        stage.removeChild(it.el);
      }
    });
    requestAnimationFrame(gameLoop);
  }

  function showCountdown(cb) {
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    const num = document.createElement('div');
    num.className = 'countdown-number';
    overlay.appendChild(num);
    stage.appendChild(overlay);
    let n = 3;
    function step() {
      num.textContent = String(n);
      if (n === 1) {
        const t = trackedSetTimeout(() => {
          stage.removeChild(overlay);
          if (typeof cb === 'function') cb();
        }, 700);
        timerRegistry.timeouts.add(t);
      } else {
        const t = trackedSetTimeout(() => { n -= 1; step(); }, 700);
        timerRegistry.timeouts.add(t);
      }
    }
    step();
  }

  showConfirmModal('提示', '準備好了嗎？', '準備好了', () => {
    running = true;
    lastTs = nowMs();
    requestAnimationFrame(gameLoop);
  });

  function activeItems() { return items.filter(it => !it.removed && !it.caught); }
  const minSpacingX = 0.2;
  const maxActive = 3;
  const spawnIntervalMs = 1400;

  function spawn(kind, text) {
    const el = document.createElement('div');
    el.className = 'fall-item';
    el.textContent = text;
    stage.appendChild(el);
    function pickX() {
      let x = rng();
      for (let i = 0; i < 8; i++) {
        const ok = activeItems().every(it => Math.abs(x - it.x) >= minSpacingX);
        if (ok) break;
        x = rng();
      }
      return x;
    }
    const obj = {
      el,
      kind,
      x: pickX(),
      y: -0.1,
      v: 0.12 + rng() * 0.18,
      caught: false,
      removed: false,
    };
    el.style.left = (obj.x * 100) + '%';
    el.style.top = (obj.y * 100) + '%';
    items.push(obj);
    if (endTimer === null) {
      endTimer = trackedSetTimeout(() => { if (!p1Ended) endP1(misses === 0); }, 10000);
    }
  }

  const spawnTimer = trackedSetInterval(() => {
    if (!running) return;
    if (!firstWaveTargetSpawned) {
      spawn('target', q.answer);
      const wrongs = sampleQuestions(distractNumbers, 2);
      spawn('wrong', wrongs[0]);
      spawn('wrong', wrongs[1]);
      spawn('slow', specials[0]);
      spawn('complex', specials[1]);
      firstWaveTargetSpawned = true;
      return;
    }
    if (activeItems().length >= maxActive) return;
    const r = rng();
    if (r < 0.25) spawn('target', q.answer);
    else if (r < 0.8) spawn('wrong', sampleQuestions(distractNumbers, 1)[0]);
    else spawn(rng() < 0.6 ? 'slow' : 'complex', rng() < 0.6 ? specials[0] : specials[1]);
  }, spawnIntervalMs);

  function cleanup() {
    clearInterval(spawnTimer);
  }
  level.addEventListener('transitionend', cleanup, { once: true });

  document.addEventListener('keydown', (ev) => {
    if (!running || isGameOver) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'a') handleMove(-1, 1);
    if (ev.key === 'ArrowRight' || ev.key === 'd') handleMove(1, 1);
  });
  stage.addEventListener('mousemove', (ev) => {
    const rect = stage.getBoundingClientRect();
    const nx = (ev.clientX - rect.left) / rect.width;
    setCatcherX(nx);
  });
  stage.addEventListener('touchmove', (ev) => {
    const t = ev.touches[0];
    if (!t) return;
    const rect = stage.getBoundingClientRect();
    const nx = (t.clientX - rect.left) / rect.width;
    setCatcherX(nx);
  }, { passive: true });

}

function startDreamLevel() {
  applyLevelStyle('Dream');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const main = document.querySelector('main.container');
  const sec = document.createElement('section');
  sec.className = 'dialog-container';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '做夢關：夢境試題';
  // 0.1% 稀有跳過
  const rare = Math.floor(Math.random() * 1000) + 1;
  if (rare === 1) {
    matchScore += 10;
    goToNextLevel();
    return;
  }
  // 題庫與介面
  const dreamQuestions = [
    { q: '〈感二鳥賦〉中的「二鳥」主要象徵什麼？', options: ['自然界的奇異現象', '自身仕途與才德不遇', '官員競爭與爭名逐利', '對古人的景仰與學習'], correct: 1, explain: '二鳥象徵韓愈才德不遇、時運未到的處境。' },
    { q: '〈復志賦〉中仕途不順、抱負未酬的主要原因？', options: ['才德不足', '時運未到難以施展', '家境貧寒', '沉於自然遊歷'], correct: 1, explain: '核心在時運未至，雖有才德亦難施展。' },
    { q: '〈閔己賦〉「閔己」的主要情感是？', options: ['好奇自然', '憂慮才德未施', '自滿祖功', '追求名利'], correct: 1, explain: '作者自憂自省，感嘆才德難以施展。' },
    { q: '〈別知賦〉作者對朋友的態度與感受？', options: ['隨緣交友', '珍視友誼感慨別離', '權勢利益不可信', '友情不如仕途重要'], correct: 1, explain: '重友情、惜別離，感人生無常。' },
    { q: '〈元和聖德詩〉主要意圖？', options: ['描寫邊塞殘酷', '讚頌皇帝聖德與治績', '記錄臣下升遷', '諷刺藩鎮叛亂'], correct: 1, explain: '全篇在頌揚皇帝聖德與施政功績。' },
    { q: '〈南山詩〉作者藉四季景象主要意圖？', options: ['地理位置與高度', '自然壯麗與變化', '被貶心情遭遇', '科學觀察資料'], correct: 1, explain: '四季描寫突出南山的壯麗與變化。' },
    { q: '〈謝自然詩〉寒女謝自然的特點？', options: ['受父母寵愛', '追求神仙之術能感應', '善於農耕紡織', '長壽無災'], correct: 1, explain: '她追求修道，能感應天地幽冥。' },
    { q: '〈赴江陵途中…〉主要情感？', options: ['讚美風景', '同情貧民與欣慰官府', '政治失意羈旅悲憤無奈', '友情與同僚讚賞'], correct: 2, explain: '重點是政治失意與漂泊的悲憤無奈。' },
    { q: '〈暮行河堤上〉最正確理解？', options: ['人聲鼎沸熱鬧歡欣', '獨行河堤夜歸愁思無奈', '春日景色心情愉快', '與友人夜遊成功喜悅'], correct: 1, explain: '孤寂夜歸，愁思與無奈為核心意境。' },
    { q: '〈夜歌〉主旨最正確？', options: ['恐懼與孤單', '夜晚自省心境自得', '憂慮世事力不從心', '僅描寫夜景不涉內心'], correct: 1, explain: '夜間自省，心境自得、無怨無悔。' },
    { q: '〈原道〉內容理解最正確？', options: ['道德與仁義無關', '先王以仁義治世秩序安定', '不必學仁義道德', '貧窮與盜賊因缺制度'], correct: 1, explain: '仁義為治世根本，使社會秩序安定。' },
    { q: '〈原性〉對「性」與「情」的看法？', options: ['性後天習得情與生俱來', '性情皆有三品可教可制', '性完全不可改變', '上等性必不犯錯'], correct: 1, explain: '性與情皆有上中下之分，可教可制。' },
    { q: '〈原毀〉古今君子比較最正確？', options: ['古君子責人詳待己廉', '古君子責己重以周待人輕以約', '古君子不修己今君子自重', '古重名譽今重道德'], correct: 1, explain: '古君子嚴於責己、寬於待人；今反之。' },
    { q: '〈原人〉「人道亂，而夷狄禽獸不得其情」意指？', options: ['人行為失序天地混亂', '人失正道則夷狄禽獸受影響', '自然規律不變', '聖人只治天道地道'], correct: 1, explain: '人道失序將牽動萬物秩序的失衡。' },
    { q: '〈原鬼〉主要意思？', options: ['鬼神隨時顯現主宰萬物', '鬼神全為虛構', '人違天理民倫自然而感應有鬼', '鬼神有聲有形隨意施禍福'], correct: 2, explain: '人事違道而感應，鬼神活動隨之起應。' },
    { q: '〈行難〉與陸先生對話指出的觀念？', options: ['階級固定不應仕途', '只重名望不重才能', '聖賢成功因家世', '不以出身限制成就'], correct: 3, explain: '真正賢才可能出自任何階層，不拘出身。' },
    { q: '〈對禹問〉禹選擇傳子非傳賢的理由？', options: ['前定繼承可止爭亂', '子孫皆聖人', '民心期望世襲', '舜強求傳子'], correct: 0, explain: '前定繼承可止爭奪，至少能守法安定。' },
    { q: '〈讀荀〉末評「孟氏醇乎醇，荀與揚大醇而小疵」意指？', options: ['三家影響不如百家', '思想由淺入深荀最圓滿', '孟子最純正荀揚稍有瑕疵', '荀揚最接近春秋筆法'], correct: 2, explain: '孟子最純正；荀、揚大體合道而略有瑕疵。' },
    { q: '〈讀鶡冠子〉整體評價最貼切？', options: ['多誤價值有限', '只重文字不論思想', '推崇為最純正道家', '肯定部分篇章足以治天下並校正文字'], correct: 3, explain: '肯定其要義，認為足以治天下，並親校文字。' },
    { q: '〈讀儀禮〉作者主要態度？', options: ['過時難懂不必研究', '制度已失毫無價值', '雖難讀仍保存周制極為珍貴', '應全由後代改制'], correct: 2, explain: '雖難讀不行於今，但保存周制，價值極高。' },
    { q: '〈讀墨子〉儒、墨之異的根本原因？', options: ['儒墨理念完全相反', '代表不同利益必然對立', '互不瞭解經典致曲解', '後學成見各售師說非本意對立'], correct: 3, explain: '儒墨之爭多出於後學成見，非孔墨本意。' },
    { q: '〈獲麟解〉「以德不以形」意旨？', options: ['形體特殊無法判吉凶', '外形多端易混淆', '德義判準：應聖人而出', '聖人看不出外貌故存疑'], correct: 2, explain: '麟之為麟在德義：因聖人在位而出。' },
    { q: '〈師說〉弟子不必不如師的理由？', options: ['弟子更通世務', '制度重年齡地位對等', '聖人皆受業於眾人', '聞道有先後術業有專攻'], correct: 3, explain: '聞道有先後、術業有專攻，不以年齡地位判。' },
    { q: '〈進學解〉提孟子荀子遭遇用意？', options: ['性格剛強難仕進', '戰亂不採用儒學', '有才德者未必遇知時', '不勤學修德更不得認可'], correct: 2, explain: '至賢亦可能不遇於世，遭貶非因無能。' },
    { q: '〈本政〉後世政治混亂原因？', options: ['人民不遵古制', '君主過度依賴武力', '一時之法被當永恆之道', '忽略商周外史事'], correct: 2, explain: '以權宜一時之術誤作永恆之道，迷惑民心。' },
    { q: '依〈守戒〉內容，作者認為國家面對外患時最根本的防備之道是什麼？', options: ['加強城牆與陷阱等物理防禦', '擴大領土以拉開與敵國的距離', '增強財力以儲備更多兵器', '得人——任用合適之人才'], correct: 3, explain: '末段指出「在得人」，真正防備在於用人得當，而非僅靠物理手段或地形。' },
    { q: '從〈圬者王承福傳〉來看，王承福選擇以「圬者」為終身職業的主要原因是什麼？', options: ['該行業能快速致富，利潤遠高於農業', '認為勞力之事雖辛苦但可力而有功，取其直而無愧，心安', '他身體羸弱，只能做輕鬆的工作', '想藉此行業結識貴族以求仕進'], correct: 1, explain: '「夫镘易能，可力焉，又誠有功，取其直，雖勞無愧，吾心安焉」；以勞力換取正當報酬，雖辛苦而無愧於心。' },
    { q: '〈諱辯〉中韓愈主張李賀舉進士並無違犯避諱，其主要論證方式為何？', options: ['指出李賀父名與「進士」二字在字形上完全不同', '以經典、律例與歷代不諱的事例證明避諱並非如此拘泥', '強調李賀文名卓絕，不應以小節拘人', '以皇甫湜的意見作為最終權威'], correct: 1, explain: '引《律》《經》《春秋》及周公、孔子、漢代例，證明「二名不偏諱」「不諱嫌名」，反證偏執避諱之非。' },
    { q: '在〈訟風伯〉一文中，作者之所以「上訟」風伯，其核心理由為何？', options: ['風伯不遵天命，擅自掀起暴雨淹沒農作', '風伯吹散雲氣、阻止雨水成形，使旱災加劇', '風伯奪走暘烏之光，使人間失去陽氣', '風伯未接受祭祀，因此憤怒報復人間'], correct: 1, explain: '風伯「吹使離之」，使「氣不得化」「雲不得施」，雨將成而不成，導致大旱。' },
    { q: '〈伯夷頌〉中作者認為伯夷、叔齊之行為最能體現其「特立獨行」的原因是什麼？', options: ['他們拒絕追隨微子一起逃離殷朝', '他們反對武王、周公討伐殷紂，並在殷亡後恥食周粟而餓死', '他們曾勸諫天下諸侯不要攻殷', '他們在周朝被封為賢士卻主動隱退山林'], correct: 1, explain: '反對伐紂，天下歸周後恥食其粟，餓死不顧，堅守義理、特立獨行。' },
  ];
  const qs = sampleQuestions(dreamQuestions, 1)[0];
  const prompt = document.createElement('p');
  prompt.className = 'dialog-text';
  prompt.textContent = qs.q;
  const list = document.createElement('div');
  list.className = 'option-list';
  qs.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'button option';
    btn.type = 'button';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      const ok = i === qs.correct;
      if (ok) {
        matchScore += 10;
        showBlockModal('提示', [{ text: '夢中頓悟，獲得分數！' }], () => { sec.remove(); goToNextLevel(); });
      } else {
        const ex = qs.explain || '解析：請再思考本文主旨與關鍵語句。';
        showBlockModal('解析', [{ text: ex }, { text: '單純夢醒，進入下一關。' }], () => { sec.remove(); goToNextLevel(); });
      }
    });
    list.appendChild(btn);
  });
  sec.appendChild(title);
  sec.appendChild(prompt);
  sec.appendChild(list);
  main.appendChild(sec);
}

function startReviewLevel() {
  const prevContainer = document.getElementById('level-container');
  if (prevContainer) prevContainer.remove();
  const main = document.querySelector('main.container');
  let sec = document.getElementById('levelReview');
  if (!sec) {
    sec = document.createElement('section');
    sec.className = 'dialog-container';
    sec.id = 'levelReview';
    main.appendChild(sec);
  } else {
    sec.innerHTML = '';
    sec.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '老生常談關：關卡名稱排序';
  const prompt = document.createElement('p');
  prompt.className = 'dialog-text';
  prompt.textContent = '請拖曳排列成第一關至第十關的正確順序';
  const expected = ['句讀明義','四次科舉','三次上書','結交孟郊','五原立論','平定淮西','諫迎佛骨','祭鱷魚文','為友撰銘','仕途頂峰'];
  const list = document.createElement('ul');
  list.id = 'reviewList';
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '0';
  list.style.width = 'min(560px, 92vw)';
  const shuffled = expected.slice().sort(() => Math.random() - 0.5);
  shuffled.forEach(name => {
    const li = document.createElement('li');
    li.className = 'review-item';
    li.draggable = true;
    li.textContent = name;
    li.style.padding = '0.6rem 0.75rem';
    li.style.margin = '0.35rem 0';
    li.style.border = '1px solid #2a2a2a';
    li.style.borderRadius = '10px';
    li.style.background = 'var(--surface)';
    li.style.color = 'var(--fg)';
    li.style.cursor = 'grab';
    li.addEventListener('dragstart', (e) => { li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); });
    li.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    li.addEventListener('drop', (e) => { e.preventDefault(); const dragging = list.querySelector('.dragging'); if (!dragging || dragging === li) return; list.insertBefore(dragging, li.nextSibling); });
    const controls = document.createElement('div');
    controls.className = 'actions';
    const up = document.createElement('button');
    up.className = 'button';
    up.type = 'button';
    up.textContent = '↑';
    up.style.padding = '0.4rem 0.6rem';
    up.addEventListener('click', () => { const prev = li.previousElementSibling; if (prev) list.insertBefore(li, prev); });
    const down = document.createElement('button');
    down.className = 'button';
    down.type = 'button';
    down.textContent = '↓';
    down.style.padding = '0.4rem 0.6rem';
    down.addEventListener('click', () => { const next = li.nextElementSibling; if (next) list.insertBefore(next, li); });
    controls.appendChild(up);
    controls.appendChild(down);
    li.appendChild(controls);
    list.appendChild(li);
  });
  const submit = document.createElement('button');
  submit.className = 'button';
  submit.type = 'button';
  submit.textContent = '提交排序';
  submit.addEventListener('click', () => {
    const actual = Array.from(list.children).map(el => el.firstChild.nodeValue.trim());
    const ok = actual.length === expected.length && actual.every((x, i) => x === expected[i]);
    if (ok) {
      matchScore += 10;
      const elapsedSec = startTime ? Math.floor((Date.now() - startTime) / 1000) : Number.MAX_SAFE_INTEGER;
      const fastRoute = elapsedSec <= 600;
      if (fastRoute) {
        showBlockModal('通關', [{ text: '你在十分鐘內完成排序，開啟迴光返照福利。' }], () => { sec.style.display = 'none'; startRevivalLevel(); });
      } else {
        showBlockModal('通關', [{ text: '你完整回顧了旅程，秩序井然。' }], () => { sec.style.display = 'none'; finalizeGame(); });
      }
    } else {
      matchScore = 0;
      const elapsedSec = startTime ? Math.floor((Date.now() - startTime) / 1000) : Number.MAX_SAFE_INTEGER;
      const fastRoute = elapsedSec <= 600;
      if (fastRoute) {
        showBlockModal('白活了', [{ text: '順序錯誤，所有分數歸零。但你在十分鐘內抵達，進入迴光返照關。' }], () => { sec.style.display = 'none'; startRevivalLevel(); });
      } else {
        showBlockModal('白活了', [{ text: '順序錯誤，所有分數歸零。' }], () => { sec.style.display = 'none'; finalizeGame(); });
      }
    }
  });
  const reshuffle = document.createElement('button');
  reshuffle.className = 'button';
  reshuffle.type = 'button';
  reshuffle.textContent = '隨機重排';
  reshuffle.addEventListener('click', () => {
    const all = Array.from(list.children);
    all.forEach(ch => ch.remove());
    const newOrder = expected.slice().sort(() => Math.random() - 0.5);
    newOrder.forEach(name => {
      const li = all.find(x => x.firstChild && x.firstChild.nodeValue && x.firstChild.nodeValue.trim() === name);
      if (li) list.appendChild(li);
    });
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.appendChild(submit);
  actions.appendChild(reshuffle);
  sec.appendChild(title);
  sec.appendChild(prompt);
  sec.appendChild(list);
  sec.appendChild(actions);
}

function startRevivalLevel() {
  applyLevelStyle('Dream');
  hideHpBar();
  const main = document.querySelector('main.container');
  let sec = document.getElementById('revivalLevel');
  if (!sec) {
    sec = document.createElement('section');
    sec.className = 'dialog-container';
    sec.id = 'revivalLevel';
    main.appendChild(sec);
  } else {
    sec.innerHTML = '';
    sec.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '迴光返照關：30秒問答';
  const img = document.createElement('img');
  img.alt = '迴光返照';
  img.src = 'han_yu_immortal.png';
  img.style.maxWidth = '280px';
  img.style.border = '1px solid #2a2a2a';
  img.style.borderRadius = '10px';
  const timerText = document.createElement('p');
  timerText.className = 'dialog-text';
  let remain = 30;
  timerText.textContent = `倒數：${remain} 秒`;
  const qText = document.createElement('p');
  qText.className = 'dialog-text';
  const options = document.createElement('div');
  options.className = 'options';
  const bank = [
    { q: '〈感二鳥賦〉中的「二鳥」主要象徵什麼？', options: ['自然界的奇異現象', '自身仕途與才德不遇', '官員競爭與爭名逐利', '對古人的景仰與學習'], correct: 1 },
    { q: '〈復志賦〉中仕途不順、抱負未酬的主要原因？', options: ['才德不足', '時運未到難以施展', '家境貧寒', '沉於自然遊歷'], correct: 1 },
    { q: '〈閔己賦〉「閔己」的主要情感是？', options: ['好奇自然', '憂慮才德未施', '自滿祖功', '追求名利'], correct: 1 },
    { q: '〈別知賦〉作者對朋友的態度與感受？', options: ['隨緣交友', '珍視友誼感慨別離', '權勢利益不可信', '友情不如仕途重要'], correct: 1 },
    { q: '〈元和聖德詩〉主要意圖？', options: ['描寫邊塞殘酷', '讚頌皇帝聖德與治績', '記錄臣下升遷', '諷刺藩鎮叛亂'], correct: 1 },
    { q: '〈南山詩〉作者藉四季景象主要意圖？', options: ['地理位置與高度', '自然壯麗與變化', '被貶心情遭遇', '科學觀察資料'], correct: 1 },
    { q: '〈謝自然詩〉寒女謝自然的特點？', options: ['受父母寵愛', '追求神仙之術能感應', '善於農耕紡織', '長壽無災'], correct: 1 },
    { q: '〈暮行河堤上〉最正確理解？', options: ['人聲鼎沸熱鬧歡欣', '獨行河堤夜歸愁思無奈', '春日景色心情愉快', '與友人夜遊成功喜悅'], correct: 1 },
    { q: '〈夜歌〉主旨最正確？', options: ['恐懼與孤單', '夜晚自省心境自得', '憂慮世事力不從心', '僅描寫夜景不涉內心'], correct: 1 },
    { q: '〈原道〉內容理解最正確？', options: ['道德與仁義無關', '先王以仁義治世秩序安定', '不必學仁義道德', '貧窮與盜賊因缺制度'], correct: 1 },
    { q: '〈師說〉弟子不必不如師的理由？', options: ['弟子更通世務', '制度重年齡地位對等', '聖人皆受業於眾人', '聞道有先後術業有專攻'], correct: 3 }
  ];
  let queue = bank.slice();
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = queue[i]; queue[i] = queue[j]; queue[j] = t; }
  function renderOne() {
    if (queue.length === 0) { qText.textContent = '題庫已用完'; options.innerHTML = ''; return; }
    const item = queue.shift();
    qText.textContent = item.q;
    options.innerHTML = '';
    item.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'button option';
      btn.type = 'button';
      btn.textContent = opt;
      btn.addEventListener('click', () => { if (i === item.correct) matchScore += 10; renderOne(); });
      options.appendChild(btn);
    });
  }
  renderOne();
  sec.appendChild(title);
  sec.appendChild(img);
  sec.appendChild(timerText);
  sec.appendChild(qText);
  sec.appendChild(options);
  const tid = trackedSetInterval(() => {
    remain -= 1;
    timerText.textContent = `倒數：${remain} 秒`;
    if (remain <= 0) {
      clearInterval(tid);
      showBlockModal('時間到', [{ text: '迴光返照結束。' }], () => { sec.style.display = 'none'; finalizeGame(); });
    }
  }, 1000);
}

function startLevel10() {
  applyLevelStyle('Number');
  updateCharacterDisplay();
  showHpBar();
  updateHpBar();
  const container = document.getElementById('level-container');
  if (!container) {
    const main = document.querySelector('main.container');
    const sec = document.createElement('section');
    sec.className = 'dialog-container';
    sec.id = 'level-container';
    main.appendChild(sec);
  }
  const ctn = document.getElementById('level-container');
  ctn.innerHTML = `
        <div id="game-container"> 
            <div id="score-display">0 / 10</div> 
            <canvas id="gameCanvas" width="400" height="600"></canvas> 
            <div id="start-screen" class="ui-layer"> 
                <h1>第十關：仕途頂峰</h1> 
                <p>點擊螢幕控制，穿梭於障礙。</p> 
                <button class="btn" id="start-btn">開始履職</button> 
            </div> 
            <div id="win-screen" class="ui-layer hidden"> 
                <h1>通關！</h1> 
                <p>仕途頂峰達成！</p> 
                <button class="btn" id="win-btn">繼續旅程</button> 
            </div> 
        </div> 
    `;

  const canvas = document.getElementById('gameCanvas'); 
  const gameContainer = document.getElementById('game-container');
  const fitCanvas = () => {
    const maxW = 400, maxH = 600, ratio = maxH / maxW;
    const vw = Math.floor(window.innerWidth * 0.92);
    const vh = Math.floor(window.innerHeight * 0.75);
    let w = Math.min(maxW, vw);
    let h = Math.min(Math.floor(w * ratio), vh);
    if (h < Math.floor(w * ratio)) {
      w = Math.floor(vh / ratio);
      h = vh;
    }
    canvas.width = w;
    canvas.height = h;
    gameContainer.style.width = w + 'px';
    gameContainer.style.height = h + 'px';
  };
  fitCanvas();
  const ctx = canvas.getContext('2d'); 
  
  let frames = 0, score = 0, isRunning = false; 
  const targetScore = 10; 
  const PIPE_SPAWN_INTERVAL = 150, FIRST_PIPE_DELAY = 120;   

  const player = { 
      x: 50, y: 150, width: 30, height: 30, velocity: 0, gravity: 0.18, jump: -4.6, 
      draw: function() { 
          ctx.fillStyle = "#8e44ad"; 
          ctx.fillRect(this.x, this.y, this.width, this.height); 
      }, 
      update: function() { 
          this.velocity += this.gravity; 
          this.y += this.velocity; 
          if(this.y + this.height > canvas.height || this.y < 0) { 
              levelFailed(); 
          } 
      } 
  }; 

  const pipes = { 
      items: [], width: 50, gap: 160, dx: 2, 
      draw: function() { 
          for(let p of this.items) { 
              ctx.fillStyle = "#2ecc71"; // 上柱 (權貴) 
              ctx.fillRect(p.x, 0, this.width, p.y); 
              ctx.fillStyle = "#e74c3c"; // 下柱 (貪腐) 
              ctx.fillRect(p.x, p.y + this.gap, this.width, canvas.height - p.y - this.gap); 
          } 
      }, 
      update: function() { 
          if(frames > FIRST_PIPE_DELAY && frames % PIPE_SPAWN_INTERVAL === 0) { 
              let maxY = canvas.height - 150 - this.gap; 
              let minY = 50; 
              this.items.push({ x: canvas.width, y: Math.floor(Math.random() * (maxY - minY + 1) + minY), passed: false }); 
          } 

          for(let i=0; i<this.items.length; i++) { 
              let p = this.items[i]; 
              p.x -= this.dx; 

              // 碰撞檢測 
              if(player.x < p.x + this.width && player.x + player.width > p.x && 
                 (player.y < p.y || player.y + player.height > p.y + this.gap)) { 
                  levelFailed(); 
              } 

              // 通過檢測 
              if(p.x + this.width < player.x && !p.passed) { 
                  score++; p.passed = true; 
                  document.getElementById('score-display').innerText = score + " / " + targetScore; 
                  if(score % 3 === 0) this.dx += 0.2; 
                  if(score >= targetScore) gameWin(); 
              } 

              if(p.x + p.width < 0) { 
                  this.items.shift(); i--; 
              } 
          } 
      } 
  }; 

  const bg = { 
      draw: function() { 
          ctx.fillStyle = "#fdf5e6"; 
          ctx.fillRect(0,0, canvas.width, canvas.height); 
      } 
  }

  // --- 流程控制函數 ---
  let animationFrameId;
  function loop() {
    if(!isRunning) return;
    bg.draw(); pipes.update(); pipes.draw();
    player.update(); player.draw();
    frames++;
    animationFrameId = requestAnimationFrame(loop);
  }

  function resetGameVars() {
    player.y = 150; player.velocity = 0;
    pipes.items = []; pipes.dx = 2;
    score = 0; frames = 0;
    document.getElementById('score-display').innerText = "0 / " + targetScore;
  }
  
  function levelFailed() {
    if (!isRunning) return;
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    handleError('Number');
  }

  function levelRetry() {
    if (isRunning) return;
    resetGameVars();
    isRunning = true;
    loop();
  }

  function gameWin() {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    document.getElementById('win-screen').classList.remove('hidden');
    document.getElementById('win-btn').onclick = goToNextLevel;
  }
  
  function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    levelRetry();
  }

  // --- 事件監聽與啟動 ---
  document.getElementById('start-btn').onclick = startGame;
  window.addEventListener('resize', () => { if (!isRunning) fitCanvas(); });

  function handleJump() {
    if(isRunning) player.velocity = player.jump;
  }
  
  canvas.addEventListener("click", handleJump);
  
  document.addEventListener("keydown", function(e) {
    if(e.code === "Space" && isRunning) {
      handleJump();
      e.preventDefault();
    }
  });

  window.level10Reset = levelRetry;
}
function renderLeaderboardPage(filterRoute, headingText) {
  clearMainContent(true);
  hideCharacterDisplay();
  hideHpBar();
  document.documentElement.style.setProperty('--bg', '#1a1a1a');
  document.documentElement.style.setProperty('--fg', '#cfcfcf');
  document.documentElement.style.setProperty('--muted', '#9aa0a6');
  const key = 'hanliu_scores';
  const raw = localStorage.getItem(key);
  let arr = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  let list = arr;
  if (filterRoute && filterRoute !== 'All') list = arr.filter(x => x.route === filterRoute);
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 30);
  const main = document.querySelector('main.container');
  const page = document.createElement('section');
  page.className = 'dialog-container';
  page.id = 'leaderboardPage';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '排行榜';
  const info = document.createElement('p');
  info.className = 'dialog-text';
  info.textContent = headingText || '';
  const content = document.createElement('div');
  content.className = 'leaderboard-content';
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dialog-text';
    empty.textContent = '尚無成績記錄';
    content.appendChild(empty);
  } else {
    list.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = `${i + 1}. ${r.name}`;
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = `${r.score}`;
      const route = document.createElement('span');
      route.className = 'route';
      route.textContent = r.route === 'HanYu' ? '韓愈線' : (r.route === 'LiuZongyuan' ? '柳宗元線' : r.route);
      row.appendChild(name);
      row.appendChild(score);
      row.appendChild(route);
      content.appendChild(row);
    });
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  const backBtn = document.createElement('button');
  backBtn.className = 'button';
  backBtn.type = 'button';
  backBtn.textContent = '返回主頁';
  backBtn.addEventListener('click', navigateHome);
  const retryBtn = document.createElement('button');
  retryBtn.className = 'button';
  retryBtn.type = 'button';
  retryBtn.textContent = '重來一次';
  retryBtn.addEventListener('click', retryGame);
  actions.appendChild(backBtn);
  actions.appendChild(retryBtn);
  page.appendChild(title);
  if (headingText) page.appendChild(info);
  page.appendChild(content);
  page.appendChild(actions);
  backdrop.hidden = true;
  main.appendChild(page);
}

function clearMainContent(preserveStartScreen) {
  const main = document.querySelector('main.container');
  if (!main) return;
  const start = document.getElementById('startScreen');
  Array.from(main.children).forEach(ch => {
    if (preserveStartScreen && start && ch === start) return;
    main.removeChild(ch);
  });
}

function navigateHome() {
  const main = document.querySelector('main.container');
  const start = document.getElementById('startScreen');
  Array.from(main.children).forEach(ch => { if (!start || ch !== start) ch.remove(); });
  if (start) { start.style.display = ''; }
  document.documentElement.style.setProperty('--bg', '#1a1a1a');
  document.documentElement.style.setProperty('--fg', '#cfcfcf');
  document.documentElement.style.setProperty('--muted', '#9aa0a6');
  hideHpBar();
  isGameOver = false;
  systemCleanup(false);
}

function retryGame() {
  matchScore = 0;
  errorCount = 0;
  currentRoute = null;
  resetHpBar();
  navigateHome();
  input.focus();
}
let leaderboardFilter = 'All';
function saveScore(name, score, route) {
  const key = 'hanliu_scores';
  const raw = localStorage.getItem(key);
  let arr = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  const now = Date.now();
  const totalSeconds = startTime ? Math.max(0, Math.floor((now - startTime) / 1000)) : 0;
  arr.push({ name, score, route, time: totalSeconds, progress: currentProgress });
  localStorage.setItem(key, JSON.stringify(arr));
}

function displayLeaderboard(filterRoute) {
  const key = 'hanliu_scores';
  const raw = localStorage.getItem(key);
  let arr = [];
  try { arr = raw ? JSON.parse(raw) : []; } catch { arr = []; }
  let list = arr;
  if (filterRoute && filterRoute !== 'All') list = arr.filter(x => x.route === filterRoute);
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 30);
  const content = document.getElementById('leaderboardContent');
  if (content) {
    content.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dialog-text';
      empty.textContent = '尚無成績記錄';
      content.appendChild(empty);
    } else {
      list.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'row';
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = `${i + 1}. ${r.name}`;
        const score = document.createElement('span');
        score.className = 'score';
        score.textContent = `${r.score}`;
        const time = document.createElement('span');
        time.className = 'route';
        time.textContent = formatTime(r.time || 0);
        const progress = document.createElement('span');
        progress.className = 'route';
        progress.textContent = r.progress || '';
        const route = document.createElement('span');
        route.className = 'route';
        route.textContent = r.route === 'HanYu' ? '韓愈線' : (r.route === 'LiuZongyuan' ? '柳宗元線' : r.route);
        row.appendChild(name);
        row.appendChild(score);
        row.appendChild(time);
        row.appendChild(progress);
        row.appendChild(route);
        content.appendChild(row);
      });
    }
  }
  leaderboardFilter = filterRoute || 'All';
  backdrop.hidden = false;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clearLeaderboard() {
  localStorage.removeItem('hanliu_scores');
  displayLeaderboard(leaderboardFilter);
}

function saveName() {
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  localStorage.setItem('hanliu_player_name', name);
  intro.textContent = `已設定暱稱：${name}`;
}

function createDialogContainer(playerName) {
  const container = document.createElement('section');
  container.className = 'dialog-container';
  container.id = 'dialogContainer';

  const p1 = document.createElement('p');
  p1.className = 'dialog-text';
  p1.textContent = '寒流來襲，您在極致的寒冷中失去知覺，醒來時發現身處一片奇異的空間，一片虛無中，僅一顆糖果飄在面前。';

  const p2 = document.createElement('p');
  p2.className = 'dialog-text';
  p2.textContent = '一個神秘的聲音問道：「今有糖，你要含入口中還是留著？」';

  const candy = document.createElement('span');
  candy.className = 'candy';
  candy.textContent = '🍭';

  const choices = document.createElement('div');
  choices.className = 'choices';

  const swallowBtn = document.createElement('button');
  swallowBtn.className = 'button';
  swallowBtn.type = 'button';
  swallowBtn.textContent = '含入口中';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'button';
  keepBtn.type = 'button';
  keepBtn.textContent = '留著';

  swallowBtn.addEventListener('click', () => {
    currentRoute = 'HanYu';
    startTime = Date.now();
    currentProgress = 'Level 1';
    const prologue = document.getElementById('dialogContainer');
    if (prologue) prologue.style.display = 'none';
    openRouteDialog('HanYu');
  });
  keepBtn.addEventListener('click', () => {
    showBlockModal('功能開發中', [
      { text: '此功能開發中，敬請期待' }
    ], () => { navigateHome(); });
  });

  choices.appendChild(swallowBtn);
  choices.appendChild(keepBtn);

  container.appendChild(p1);
  container.appendChild(p2);
  container.appendChild(candy);
  container.appendChild(choices);

  const main = document.querySelector('main.container');
  main.appendChild(container);
}

function openAbout() {
  const main = document.querySelector('main.container');
  const start = document.getElementById('startScreen');
  if (start) start.style.display = 'none';
  clearMainContent(true);
  const page = document.createElement('section');
  page.className = 'dialog-container';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '關於遊戲';
  const gameName = document.createElement('p');
  gameName.className = 'dialog-text';
  gameName.textContent = '遊戲名稱：寒流';
  const d1 = document.createElement('p'); d1.className = 'dialog-text'; d1.textContent = '總設計：楊竣傑';
  const d2 = document.createElement('p'); d2.className = 'dialog-text'; d2.textContent = '程式開發：Trae.ai (AI 輔助實作)';
  const d3 = document.createElement('p'); d3.className = 'dialog-text'; d3.textContent = '專案指導與架構分析：Gemini (AI 協作顧問)';
  const d4 = document.createElement('p'); d4.className = 'dialog-text'; d4.textContent = '視覺素材：Gemini (AI 繪圖)';
  const d5 = document.createElement('p'); d5.className = 'dialog-text'; d5.textContent = '數據來源：經典文獻與韓柳文集、上課簡報';
  const d6 = document.createElement('p'); d6.className = 'dialog-text'; d6.textContent = '品質管制顧問 (QC)：鍾旻諺、李聖億';
  const d7 = document.createElement('p'); d7.className = 'dialog-text'; d7.textContent = '版本：v1.0';
  const back = document.createElement('button');
  back.className = 'button';
  back.type = 'button';
  back.textContent = '返回首頁';
  back.addEventListener('click', navigateHome);
  page.appendChild(title);
  page.appendChild(gameName);
  page.appendChild(d1);
  page.appendChild(d2);
  page.appendChild(d3);
  page.appendChild(d4);
  page.appendChild(d5);
  page.appendChild(d6);
  page.appendChild(d7);
  page.appendChild(back);
  main.appendChild(page);
}

function openRouteDialog(route) {
  const container = document.createElement('section');
  container.className = 'dialog-container';
  const text = document.createElement('p');
  text.className = 'dialog-text';
  if (route === 'HanYu') {
    text.textContent = '韓愈線：你含下了糖果，舌尖感受到極致的甘甜，但身體隨即感受到無盡的寒意。你獲得了甜頭，但這也預示著你的開局將是父母雙亡、天崩開局。然而，你的人生終將爬到高處。';
  } else {
    text.textContent = '柳宗元線：你選擇留著糖果，獲得了完美的開局。但因不願嘗甜，你的人生每況愈下，你的路將比任何人都坎坷。到最後，你只有苦頭可吃。';
  }
  container.appendChild(text);
  if (route === 'HanYu') {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'button';
    nextBtn.type = 'button';
    nextBtn.textContent = '進入第一關：句讀';
    container.appendChild(nextBtn);
  }
  const main = document.querySelector('main.container');
  main.appendChild(container);
  if (route === 'HanYu') triggerLightning();
  if (route === 'HanYu') {
    const nextBtn = container.querySelector('.button');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      container.style.display = 'none';
      currentLevelIndex = -1;
      goToNextLevel();
    });
  }
}

function triggerLightning() {
  const overlay = document.createElement('div');
  overlay.className = 'flash-overlay';
  overlay.addEventListener('animationend', () => {
    overlay.remove();
    document.documentElement.style.setProperty('--bg', '#0A0B1A');
  });
  document.body.appendChild(overlay);
}

const sentenceBank = [
  { question: '子曰學而時習之不亦說乎有朋自遠方來不亦樂乎人不知而不慍不亦君子乎', correctSegmentation: '子曰/學而時習之/不亦說乎/有朋自遠方來/不亦樂乎/人不知而不慍/不亦君子乎' },
  { question: '惻隱之心仁之端也羞惡之心義之端也辭讓之心禮之端也是非之心智之端也', correctSegmentation: '惻隱之心/仁之端也/羞惡之心/義之端也/辭讓之心/禮之端也/是非之心/智之端也' },
  { question: '大學之道在明明德在親民在止於至善知止而後有定定而後能靜靜而後能安安而後能慮慮而後能得', correctSegmentation: '大學之道/在明明德/在親民/在止於至善/知止而後有定/定而後能靜/靜而後能安/安而後能慮/慮而後能得' },
  { question: '天命之謂性率性之謂道修道之謂教道也者不可須臾離也可離非道也', correctSegmentation: '天命之謂性/率性之謂道/修道之謂教/道也者/不可須臾離也/可離/非道也' },
  { question: '投我以木桃報之以瓊瑤匪報也永以為好也', correctSegmentation: '投我以木桃/報之以瓊瑤/匪報也/永以為好也' },
  { question: '寬而栗柔而立願而恭亂而敬擾而毅直而溫簡而廉剛而塞強而義彰厥有常吉哉', correctSegmentation: '寬而栗/柔而立/願而恭/亂而敬/擾而毅/直而溫/簡而廉/剛而塞/強而義/彰厥有常/吉哉' },
  { question: '凡學之道嚴師為難師嚴然後道尊道尊然後民知敬學', correctSegmentation: '凡學之道/嚴師為難/師嚴然後道尊/道尊然後民知敬學' },
  { question: '易有太極是生兩儀兩儀生四象四象生八卦八卦定吉凶吉凶生大業', correctSegmentation: '易有太極/是生兩儀/兩儀生四象/四象生八卦/八卦定吉凶/吉凶生大業' },
  { question: '十有一年春滕侯薛侯來朝', correctSegmentation: '十有一年/春/滕侯/薛侯來朝' },
];

function sampleQuestions(bank, n) {
  const arr = [...bank];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function normalizeSegmentation(str) {
  if (!str) return '';
  let s = str.replace(/[／]/g, '/');
  s = s.trim();
  s = s.replace(/^\/+|\/+$/g, '');
  s = s.replace(/[ \t\u00A0\u3000]+/g, '');
  s = s.replace(/\/+/g, '/');
  return s;
}

function startSentenceLevel() {
  applyLevelStyle('Number');
  currentQuestions = sampleQuestions(sentenceBank, 3);
  currentQuestionIndex = 0;
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelSentence');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelSentence';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  showHpBar();
  updateHpBar();
  renderSentenceQuestion();
}

function renderSentenceQuestion() {
  const main = document.querySelector('main.container');
  if (!main) return;
  const leaderboardPage = document.getElementById('leaderboardPage');
  if (leaderboardPage || (typeof backdrop !== 'undefined' && !backdrop.hidden)) return;
  let level = document.getElementById('levelSentence');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelSentence';
    main.appendChild(level);
  }
  level.innerHTML = '';
  const q = currentQuestions[currentQuestionIndex];
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '關卡：句讀明義';
  const prompt = document.createElement('p');
  prompt.className = 'dialog-text';
  prompt.textContent = `題目：${q.question}`;
  const inputBox = document.createElement('input');
  inputBox.type = 'text';
  inputBox.className = 'input';
  inputBox.placeholder = '請在適當處輸入 / 進行斷句（例如：子曰/學而時習之/...）';
  const submitBtn = document.createElement('button');
  submitBtn.className = 'button';
  submitBtn.type = 'button';
  submitBtn.textContent = '提交';
  const msg = document.createElement('p');
  msg.className = 'dialog-text';

  submitBtn.addEventListener('click', () => {
    const user = normalizeSegmentation(inputBox.value);
    const correct = normalizeSegmentation(q.correctSegmentation);
    if (user && user === correct) {
      matchScore += 10;
      msg.className = 'dialog-text success-text';
      msg.textContent = '答對！+10 分';
      currentQuestionIndex += 1;
      if (currentQuestionIndex >= currentQuestions.length) {
        const pause = document.createElement('p');
        pause.className = 'dialog-text success-text';
        pause.textContent = '句讀精準！第二關即將開始...';
        level.appendChild(pause);
        setTimeout(() => { level.style.display = 'none'; goToNextLevel(); }, 1500);
      } else {
        setTimeout(renderSentenceQuestion, 1500);
      }
    } else {
      handleError('Number');
      if (errorCount === 1) {
        msg.className = 'dialog-text error-text';
        msg.textContent = '身體與靈魂不匹配的警告。韓愈，你辜負了兄嫂的日夜期盼... 請再想想天上的父母，他們的期望，你還能承擔幾次失誤？';
        inputBox.value = '';
        currentQuestionIndex = Math.min(currentQuestionIndex + 1, currentQuestions.length - 1);
        setTimeout(renderSentenceQuestion, 2000);
      }
    }
  });

  level.appendChild(title);
  level.appendChild(prompt);
  level.appendChild(inputBox);
  level.appendChild(submitBtn);
  level.appendChild(msg);
}

const quanxueSegments = [
  { text: '君子曰：「學不可以已矣。青取之於藍，而青於藍；水則為冰，而寒於水。」', correctSegmentation: '君子曰/學不可以已矣/青取之於藍/而青於藍/水則為冰/而寒於水', keywords: ['學不可以已矣', '青於藍', '寒於水'], idea: '學無止境，弟子可勝於師。' },
  { text: '不升高山，不知天之高也；不臨深谿，不知地之厚也。', correctSegmentation: '不升高山/不知天之高也/不臨深谿/不知地之厚也', keywords: ['不升高山', '不臨深谿', '天之高', '地之厚'], idea: '唯有親身實踐，方知學問之博大。' },
  { text: '木從繩則直，金就礪則利。君子博學如日參己焉，故知明則行無過。', correctSegmentation: '木從繩則直/金就礪則利/君子博學/如日參己焉/故知明則行無過', keywords: ['木從繩則直', '金就礪則利', '博學', '行無過'], idea: '修學可正己身，明理以致行。' },
  { text: '君子之性非異也，而善假於物也。', correctSegmentation: '君子之性非異也/而善假於物也', keywords: ['善假於物', '君子之性'], idea: '善於借助外物者，能成大才。' },
  { text: '巢非不完也，所繫者然也。', correctSegmentation: '巢非不完也/所繫者然也', keywords: ['巢非不完', '所繫者然'], idea: '環境決定成敗。' },
  { text: '君子靖居恭學，脩身致志，處必擇鄉，游必就士。', correctSegmentation: '君子靖居恭學/脩身致志/處必擇鄉/游必就士', keywords: ['恭學', '脩身致志', '擇鄉', '就士'], idea: '慎選師友與環境，以正其道。' },
  { text: '物類之從，必有所由；榮辱之來，各象其德。', correctSegmentation: '物類之從/必有所由/榮辱之來/各象其德', keywords: ['物類之從', '榮辱之來', '其德'], idea: '德行決定榮辱。' },
  { text: '言有召禍，行有招辱，君子慎其所立焉。', correctSegmentation: '言有召禍/行有招辱/君子慎其所立焉', keywords: ['召禍', '招辱', '慎其所立'], idea: '慎言慎行，方免於禍。' },
  { text: '不積跬步，無以致千里；不積小流，無以成江海。', correctSegmentation: '不積跬步/無以致千里/不積小流/無以成江海', keywords: ['不積跬步', '致千里', '成江海'], idea: '積少成多，持之以恆。' },
  { text: '無憤憤之志者，無昭昭之明；無綿綿之事者，無赫赫之功。', correctSegmentation: '無憤憤之志者/無昭昭之明/無綿綿之事者/無赫赫之功', keywords: ['憤憤之志', '昭昭之明', '赫赫之功'], idea: '專一持志，方能有成。' },
  { text: '行無隱而不行；玉居山而木潤，淵生珠而岸不枯。', correctSegmentation: '行無隱而不行/玉居山而木潤/淵生珠而岸不枯', keywords: ['行無隱', '木潤', '淵生珠'], idea: '善行終將流傳，潤物無聲。' },
  { text: '君子不可以不學，見人不可以不飾。', correctSegmentation: '君子不可以不學/見人不可以不飾', keywords: ['不可以不學', '不可以不飾'], idea: '學以修內，飾以正外，內外兼修。' },
  { text: '珠者，陰之陽也，故勝火；玉者，陽之陰也，故勝水。', correctSegmentation: '珠者/陰之陽也/故勝火/玉者/陽之陰也/故勝水', keywords: ['珠者', '玉者', '勝火', '勝水'], idea: '珠玉比德，君子內剛外柔。' },
  { text: '夫水者，君子比德焉：偏與之而無私，似德；所及者生，似仁。', correctSegmentation: '夫水者/君子比德焉/偏與之而無私/似德/所及者生/似仁', keywords: ['君子比德', '無私', '似仁'], idea: '觀水知德，仁而無私。' },
];

const quanxueFullText = '君子曰：學不可以已矣，青取之於藍，而青於藍；水則為冰，而寒於水；木直而中繩，輮而為輪，其曲中規，枯暴不復挺者，輮使之然也。是故不升高山，不知天之高也；不臨深谿，不知地之厚也；不聞先王之遺道，不知學問之大也。于越戎貉之子，生而同聲，長而異俗者，教使之然也。是故木從繩則直，金就礪則利，君子博學如日參己焉，故知明則行無過。《詩》云：「嗟爾君子，無恆安息；靖恭爾位，好是正直；神之聽之，介爾景福。」神莫大於化道，福莫長於旡咎。孔子曰：「吾嘗終日思矣，不如須臾之所學。」吾嘗跂而望之，不如升高而博見也；升高而招，非臂之長也，而見者遠；順風而呼，非聲加疾也，而聞者著；假車馬者，非利足也，而致千里；假舟楫者，非能水也，而絕江海；君子之性非異也，而善假於物也。南方有鳥，名曰𧊷鳩，以羽為巢，編之以髮，繫之葦苕，風至苕折，子死卵破，巢非不完也，所繫者然也。西方有木，名曰射干，莖長四寸，生於高山之上，而臨百仞之淵，木莖非能長也，所立者然也。蓬生麻中，不扶自直。蘭氏之根，懷氏之苞，漸之滫中，君子不近，庶人不服，質非不美也，所漸者然也。是故君子靖居恭學，脩身致志，處必擇鄉，游必就士，所以防僻邪而道中正也。物類之從，必有所由；榮辱之來，各象其德。肉腐出蟲，魚枯生蠹；殆教亡身，禍災乃作。強自取折，柔自取束；邪穢在身，怨之所構。布薪若一火就燥，平地若一水就濕，草木疇生，禽獸群居，物各從其類也。是故正鵠張，而弓矢至焉；林木茂，而斧斤至焉。樹成蔭，而鳥息焉；醯酸，而蚋聚焉，故言有召禍，行有招辱，君子慎其所立焉。積土成山，風雨興焉；積水成川，蛟龍生焉；積善成德，神明自傳，聖心備矣。是故不積跬步，無以致千里；不積小流，無以成江海；騏驥一躒，不能千里；駑馬無極，功在不舍；楔而舍之，朽木不折；楔而不舍，金石可鏤。夫螾無爪牙之利，筋脈之強，上食晞土，下飲黃泉者，用心一也。蟹二螯八足，非蛇夔之穴，而無所寄託者，用心躁也。是故無憤憤之志者，無昭昭之明；無綿綿之事者，無赫赫之功；行跂塗者不至，事兩君者不容；目不能兩視而明，耳不能兩聽而聰；騰蛇無足而騰，鼫鼠五伎而窮。《詩》云：「鳲鳩在桑，其子七兮；淑人君子，其儀一兮；其儀一兮，心若結兮。」君子其結於一也。昔者瓠巴鼓瑟，而沈魚出聽；伯牙鼓琴，而六馬仰秣，夫聲無細而不聞，行無隱而不行；玉居山而木潤，淵生珠而岸不枯；為善而不積乎？豈有不至哉？孔子曰：「野哉！君子不可以不學，見人不可以不飾。」不飾無貌，無貌不敬，不敬無禮，無禮不立。夫遠而有光者，飾也；近而逾明者，學也。譬如洿邪，水潦灟焉，莞蒲生焉，從上觀之，誰知其非源泉也。珠者，陰之陽也，故勝火；玉者，陽之陰也，故勝水；其化如神，故天子藏珠玉，諸侯藏金石，大夫畜犬馬，百姓藏布帛。不然，則強者能守之，知者能秉之，賤其所貴，而貴其所賤；不然，矜寡孤獨不得焉。子貢曰：「君子見大川必觀，何也？」孔子曰：「夫水者，君子比德焉：偏與之而無私，似德；所及者生，所不及者死，似仁；其流行庳下，倨句皆循其理，似義；其赴百仞之谿不疑，似勇；淺者流行，深淵不測，似智；弱約危通，似察；受惡不讓，似貞；苞裹不清以入，鮮潔以出，似善化；必出，量必平，似正；盈不求概，似厲；折必以東西，似意，是以見大川必觀焉。';

function startExamLevel() {
  currentExamAttempt = 1;
  examQuestions = sampleQuestions(quanxueSegments, 4);
  renderExamAttempt();
}

function renderExamAttempt() {
  const main = document.querySelector('main.container');
  if (!main) return;
  let level = document.getElementById('levelExam');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelExam';
    main.appendChild(level);
  }
  level.innerHTML = '';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第二關：四次科舉';
  level.appendChild(title);

  const q = examQuestions[currentExamAttempt - 1];
  const positions = selectBlankPositions(q.text, currentExamAttempt);
  const answers = positions.map(i => q.text[i]);
  const textHTML = buildBlankedHTMLChars(q.text, positions);
  const passage = document.createElement('p');
  passage.className = 'dialog-text';
  passage.innerHTML = textHTML;
  level.appendChild(passage);

  const options = document.createElement('div');
  options.className = 'options';
  const distractors = getCharDistractors(answers, answers.length + 4);
  const optWords = shuffleArray([...answers, ...distractors]);
  optWords.forEach((word, idx) => {
    const ob = document.createElement('button');
    ob.className = 'button option';
    ob.type = 'button';
    ob.textContent = word;
    ob.dataset.optionId = `opt_${idx}`;
    ob.addEventListener('click', () => {
      const blanks = passage.querySelectorAll('.blank');
      for (const b of blanks) {
        if (!b.textContent) {
          b.textContent = word;
          b.dataset.sourceId = ob.dataset.optionId;
          ob.disabled = true;
          break;
        }
      }
    });
    options.appendChild(ob);
  });
  level.appendChild(options);

  Array.from(passage.querySelectorAll('.blank')).forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.sourceId;
      if (id) {
        const btn = level.querySelector(`[data-option-id="${id}"]`);
        if (btn) btn.disabled = false;
      }
      b.textContent = '';
      b.dataset.sourceId = '';
    });
  });

  const submit = document.createElement('button');
  submit.className = 'button';
  submit.type = 'button';
  submit.textContent = '提交';
  submit.addEventListener('click', () => {
    const blanks = Array.from(passage.querySelectorAll('.blank'));
    const allFilled = blanks.every(b => !!b.textContent);
    const allCorrect = blanks.every(b => b.textContent === b.dataset.answer);
    if (!allFilled || !allCorrect) {
      handleError('Number');
      return;
    }
    matchScore += 10;
    const after = () => {
      level.innerHTML = '';
      if (currentExamAttempt <= 3) {
        const msg = document.createElement('p');
        msg.className = 'dialog-text';
        msg.textContent = '落第。你已盡全力，士氣未衰，整束再戰。';
        level.appendChild(msg);
        const next = document.createElement('button');
        next.className = 'button';
        next.type = 'button';
        next.textContent = '準備下一次科舉';
        next.addEventListener('click', () => {
          if (currentExamAttempt === 3) {
            level.innerHTML = '';
            const inter = document.createElement('p');
            inter.className = 'dialog-text';
            inter.textContent = '文名遠播，轉機已現 🧑‍💼 📚 陸贄、梁肅';
            level.appendChild(inter);
            setTimeout(() => { currentExamAttempt = 4; renderExamAttempt(); }, 3000);
          } else {
            currentExamAttempt += 1;
            renderExamAttempt();
          }
        });
        level.appendChild(next);
      } else {
        const final = document.createElement('p');
        final.className = 'dialog-text success-text';
        final.textContent = '貞元八年（792年），你終於中進士了！';
        level.appendChild(final);
        setTimeout(() => { level.style.display = 'none'; goToNextLevel(); }, 1800);
      }
    };
    showIdeaModal(q.text, q.idea, after);
  });
  level.appendChild(submit);
}

function getCjkIndices(text) {
  const re = /[\u4E00-\u9FFF]/;
  const out = [];
  for (let i = 0; i < text.length; i++) { if (re.test(text[i])) out.push(i); }
  return out;
}

function selectBlankPositions(text, count) {
  const indices = getCjkIndices(text);
  const n = Math.min(count, indices.length);
  return sampleQuestions(indices, n).sort((a, b) => a - b);
}

function buildBlankedHTMLChars(text, positions) {
  const set = new Set(positions);
  let html = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (set.has(i)) html += `<span class="blank" data-answer="${ch}"></span>`;
    else html += ch;
  }
  return html;
}

function getCharDistractors(answers, count) {
  const re = /[\u4E00-\u9FFF]/;
  const chars = Array.from(quanxueFullText).filter(c => re.test(c));
  const set = new Set(answers);
  const pool = Array.from(new Set(chars)).filter(c => !set.has(c));
  return shuffleArray(pool).slice(0, count);
}

function shuffleArray(arr) { return sampleQuestions(arr, arr.length); }

function showPunishOverlay() {
  if (currentLevel === 8) {
    const flash = document.createElement('div');
    flash.className = 'flash-overlay';
    document.body.appendChild(flash);
    const overlay = document.createElement('div');
    overlay.className = 'punish-overlay';
    const sym = document.createElement('div');
    sym.className = 'punish-symbol';
    sym.textContent = '⚡';
    const silhouette = document.createElement('div');
    silhouette.className = 'punish-silhouette';
    silhouette.textContent = '👥';
    const text = document.createElement('p');
    text.className = 'dialog-text';
    text.textContent = '身體與靈魂不匹配的警告。韓愈，你寫出《祭鱷魚文》，是為驅逐蠻荒、安撫百姓。請再次感受文中的氣勢與脈絡…你還能承擔幾次失誤？';
    overlay.appendChild(sym);
    overlay.appendChild(silhouette);
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    sym.addEventListener('animationend', () => { overlay.remove(); });
    flash.addEventListener('animationend', () => { flash.remove(); });
    return;
  }
  if (currentLevel === 9) {
    const overlay = document.createElement('div');
    overlay.className = 'punish-overlay';
    const sym = document.createElement('div');
    sym.className = 'punish-symbol';
    sym.textContent = '🖋️';
    const text = document.createElement('p');
    text.className = 'dialog-text';
    text.textContent = '身體與靈魂不匹配的警告。 韓愈，史筆當求精確，一字之差，傳世之作便成謬誤。請再次體會文字的重量...你還能承擔幾次失誤？';
    overlay.appendChild(sym);
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    sym.addEventListener('animationend', () => { overlay.remove(); });
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'punish-overlay';
  const sym = document.createElement('div');
  sym.className = 'punish-symbol';
  sym.textContent = '🕯️';
  overlay.appendChild(sym);
  document.body.appendChild(overlay);
  sym.addEventListener('animationend', () => { overlay.remove(); });
}

function showIdeaModal(excerpt, idea, onClose) {
  showBlockModal('主旨提示', [
    { className: 'dialog-text idea-excerpt', text: excerpt },
    { className: 'dialog-text idea-main', text: `💬 主旨：${idea}` },
  ], onClose);
}

function showConfirmModal(titleText, messageText, confirmText, onConfirm) {
  if (document.querySelector('.modal-backdrop.active-block')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop active-block';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.classList.add('confirm-modal');
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = titleText || '提示';
  modal.appendChild(title);
  const p = document.createElement('p');
  p.className = 'dialog-text';
  p.textContent = messageText || '';
  modal.appendChild(p);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btn = document.createElement('button');
  btn.className = 'button';
  btn.classList.add('primary');
  btn.type = 'button';
  btn.textContent = confirmText || '確定';
  btn.autofocus = true;
  btn.addEventListener('click', () => {
    blockingModalOpen = false;
    document.body.removeChild(overlay);
    if (typeof onConfirm === 'function') onConfirm();
  });
  actions.appendChild(btn);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  blockingModalOpen = true;
}

function showBlockModal(titleText, bodyItems, onClose) {
  if (document.querySelector('.modal-backdrop.active-block')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop active-block';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = titleText || '提示';
  const close = document.createElement('button');
  close.className = 'modal-close';
  close.type = 'button';
  close.textContent = '×';
  close.addEventListener('click', () => { blockingModalOpen = false; document.body.removeChild(overlay); if (typeof onClose === 'function') onClose(); });
  modal.appendChild(close);
  modal.appendChild(title);
  if (Array.isArray(bodyItems)) {
    bodyItems.forEach(item => {
      const p = document.createElement('p');
      p.className = item.className || 'dialog-text';
      p.textContent = item.text || '';
      modal.appendChild(p);
    });
  }
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  blockingModalOpen = true;
}

function startLetterMazeLevel() {
  applyLevelStyle('Number');
  currentLetterGoal = 1;
  const main = document.querySelector('main.container');
  let level = document.getElementById('levelLetterMaze');
  if (!level) {
    level = document.createElement('section');
    level.className = 'dialog-container';
    level.id = 'levelLetterMaze';
    main.appendChild(level);
  } else {
    level.innerHTML = '';
    level.style.display = '';
  }
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = '第三關：三次上書';
  const msg = document.createElement('p');
  msg.className = 'dialog-text';
  msg.textContent = '';
  const grid = document.createElement('div');
  grid.className = 'maze-grid';
  const goals = [
    { id: 'g1', name: '上宰相書', feedback: '你投出第一封信，心懷希望，等待回應。' },
    { id: 'g2', name: '後十九日復上宰相書', feedback: '無人回應。你再次投書，強忍憤慨，期望能感動宰相。' },
    { id: 'g3', name: '後廿九日覆上宰相書', feedback: '仍是沉寂。你投出第三封信，已經筋疲力盡，只剩絕望。' },
  ];
  const finalGoal = { id: 'final', name: '終點：宰相公府', feedback: '通關！畫面：宰相公府大門緊閉，無人應答，門前空無一人。' };

  function buildRandomMazeMap(rows = 5, cols = 5, minLen = 14) {
    const within = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;
    const neighbors = (r, c) => [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([nr,nc]) => within(nr,nc));
    const map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'wall'));
    let sr = Math.floor(Math.random() * rows), sc = Math.floor(Math.random() * cols);
    const stack = [[sr, sc]];
    const visited = new Set([`${sr},${sc}`]);
    const path = [[sr, sc]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const choices = neighbors(r, c).filter(([nr, nc]) => !visited.has(`${nr},${nc}`));
      if (choices.length === 0) { stack.pop(); continue; }
      const [nr, nc] = choices[Math.floor(Math.random() * choices.length)];
      visited.add(`${nr},${nc}`);
      stack.push([nr, nc]);
      path.push([nr, nc]);
      if (path.length >= rows * cols) break;
    }
    if (path.length < minLen) return buildRandomMazeMap(rows, cols, minLen);
    const usable = path;
    usable.forEach(([r, c]) => { map[r][c] = 'path'; });
    const quarter = Math.floor(usable.length / 4);
    const p1 = usable[Math.min(quarter, usable.length - 4)];
    const p2 = usable[Math.min(quarter * 2, usable.length - 3)];
    const p3 = usable[Math.min(quarter * 3, usable.length - 2)];
    const pf = usable[usable.length - 1];
    map[p1[0]][p1[1]] = 'g1';
    map[p2[0]][p2[1]] = 'g2';
    map[p3[0]][p3[1]] = 'g3';
    map[pf[0]][pf[1]] = 'final';
    map[sr][sc] = 'start';
    return map;
  }

  const mazeMap = buildRandomMazeMap();

  const toIndex = (r, c) => r * 5 + c;
  const isAdjacent = (a, b) => {
    const ar = Math.floor(a / 5), ac = a % 5;
    const br = Math.floor(b / 5), bc = b % 5;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  };

  const state = { achieved: { g1: false, g2: false, g3: false }, finalEnabled: false };
  let playerPos = -1;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const i = toIndex(r, c);
      const t = mazeMap[r][c];
      const cell = document.createElement('div');
      cell.className = 'maze-cell';
      cell.dataset.index = String(i);
      cell.dataset.type = t;
      if (t === 'wall') {
        cell.classList.add('wall');
        cell.textContent = '';
      } else if (t === 'path') {
        cell.classList.add('path');
        cell.textContent = '...';
      } else if (t === 'start') {
        cell.classList.add('path');
        cell.textContent = '🚶';
        cell.classList.add('player');
        playerPos = i;
      } else if (t === 'final') {
        cell.classList.add('final');
        cell.textContent = '公府';
        cell.title = finalGoal.name;
      } else if (t === 'g1' || t === 'g2' || t === 'g3') {
        cell.classList.add('letter');
        cell.textContent = '函';
        const gi = t === 'g1' ? 0 : (t === 'g2' ? 1 : 2);
        const goalName = goals[gi].name;
        cell.title = goalName;
        cell.dataset.goalName = goalName;
      }
      cell.addEventListener('mouseenter', () => {
        if (t === 'g1' || t === 'g2' || t === 'g3') {
          cell.title = cell.dataset.goalName || cell.title;
        }
      });
      cell.addEventListener('touchstart', () => {
        if (t === 'g1' || t === 'g2' || t === 'g3') {
          msg.className = 'dialog-text';
          msg.textContent = cell.dataset.goalName || '';
          setTimeout(() => { msg.textContent = ''; }, 1500);
        }
      }, { passive: true });
      cell.addEventListener('click', () => {
        if (isGameOver || blockingModalOpen) return;
        const type = cell.dataset.type;
        const idx = Number(cell.dataset.index);
        if (!isAdjacent(playerPos, idx)) {
          handleError('Number');
          showBlockModal('提示', [{ text: '道路阻滯，你再次感到心神受創。' }]);
          return;
        }
        if (type === 'wall') {
          handleError('Number');
          showBlockModal('提示', [{ text: '道路阻滯，你再次感到心神受創。' }]);
          return;
        }
        const prev = grid.querySelector(`[data-index="${playerPos}"]`);
        // 清理任何殘留的玩家標記
        grid.querySelectorAll('.maze-cell.player').forEach(p => {
          p.classList.remove('player');
          if (p.dataset.type === 'start' || p.dataset.type === 'path') p.textContent = '...';
          if (p.dataset.type === 'g1' || p.dataset.type === 'g2' || p.dataset.type === 'g3') {
            p.textContent = state.achieved[p.dataset.type] ? '✅' : '函';
          }
        });
        if (type === 'path') {
          cell.textContent = '🚶';
          cell.classList.add('player');
          playerPos = idx;
          return;
        }
        if (type === 'g1' || type === 'g2' || type === 'g3') {
          const expect = 'g' + String(currentLetterGoal);
          if (type !== expect) {
            handleError('Number');
            showBlockModal('提示', [{ text: '道路阻滯，你再次感到心神受創。' }]);
            // 回到原位顯示玩家
            const origin = grid.querySelector(`[data-index="${playerPos}"]`);
            if (origin) { origin.classList.add('player'); origin.textContent = '🚶'; }
            return;
          }
          const gi = Number(currentLetterGoal) - 1;
          showBlockModal('提示', [{ text: goals[gi].feedback }]);
          matchScore += 10;
          state.achieved[type] = true;
          cell.classList.add('done');
          cell.textContent = '🚶';
          cell.style.pointerEvents = 'none';
          playerPos = idx;
          currentLetterGoal += 1;
          if (currentLetterGoal === 4) { state.finalEnabled = true; }
          return;
        }
        if (type === 'final') {
          if (!state.finalEnabled) {
            showBlockModal('提示', [{ text: '還不能進入公府。先完成三次上書。' }]);
            // 回到原位顯示玩家
            const origin = grid.querySelector(`[data-index="${playerPos}"]`);
            if (origin) { origin.classList.add('player'); origin.textContent = '🚶'; }
            return;
          }
          cell.textContent = '🚶';
          playerPos = idx;
          showBlockModal('提示', [{ text: finalGoal.feedback }], () => { level.style.display = 'none'; goToNextLevel(); });
          return;
        }
      });
      grid.appendChild(cell);
    }
  }

  const help = document.createElement('p');
  help.className = 'dialog-text';
  help.textContent = '遊戲說明：點擊相鄰白色路徑移動；依序完成三封「函」，再前往「公府」。點擊牆或非相鄰格會受傷。移到「函」上會顯示全稱。';
  level.appendChild(title);
  level.appendChild(help);
  level.appendChild(grid);
  level.appendChild(msg);
}

function endGameFail() {
  systemCleanup(true);
  clearMainContent(false);
  const main = document.querySelector('main.container');
  const over = document.createElement('section');
  over.className = 'dialog-container';
  const text = document.createElement('p');
  text.className = 'dialog-text';
  text.textContent = '讀書不用心，上天都傷心，文曲星不佑，祖宗蒙羞。你終究未能完成兄嫂的囑託，遺憾地結束了這段困頓的求仕之旅...';
  const restart = document.createElement('button');
  restart.className = 'button';
  restart.type = 'button';
  restart.textContent = '重新開始';
  restart.addEventListener('click', () => {
    matchScore = 0;
    errorCount = 0;
    currentRoute = null;
    document.documentElement.style.setProperty('--bg', '#1a1a1a');
    location.reload();
  });
  over.appendChild(text);
  over.appendChild(restart);
  main.appendChild(over);
}

function start() {
  const playerName = input.value.trim();
  if (!playerName) { input.focus(); return; }
  localStorage.setItem('hanliu_player_name', playerName);
  const startScreen = document.getElementById('startScreen');
  startScreen.style.display = 'none';
  isGameOver = false;
  systemCleanup(false);
  resetHpBar();
  createDialogContainer(playerName);
}

btn.addEventListener('click', start);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
leaderboardBtn.addEventListener('click', () => { displayLeaderboard('All'); rankHan.focus(); });
modalClose.addEventListener('click', () => { backdrop.hidden = true; });
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !backdrop.hidden) backdrop.hidden = true; });
rankHan.addEventListener('click', () => { displayLeaderboard('HanYu'); });
rankLiu.addEventListener('click', () => { displayLeaderboard('LiuZongyuan'); });
rankAll.addEventListener('click', () => { displayLeaderboard('All'); });
document.getElementById('rankClear').addEventListener('click', clearLeaderboard);
aboutBtn.addEventListener('click', openAbout);
if (debugStartBtn) debugStartBtn.addEventListener('click', startDebugLevel);
setupBgmAutoplay();
function showHpBar() {
  const bar = document.getElementById('hpBar');
  if (bar) bar.hidden = false;
  if (bar) {
    let scoreLabel = bar.querySelector('#scoreLabel');
    let scoreText = bar.querySelector('#scoreText');
    if (!scoreLabel) {
      scoreLabel = document.createElement('span');
      scoreLabel.id = 'scoreLabel';
      scoreLabel.className = 'hp-label';
      scoreLabel.textContent = '分數';
      bar.appendChild(scoreLabel);
    }
    if (!scoreText) {
      scoreText = document.createElement('span');
      scoreText.id = 'scoreText';
      scoreText.className = 'hp-text';
      scoreText.textContent = String(matchScore || 0);
      bar.appendChild(scoreText);
    }
    let bgmBtn = bar.querySelector('#bgmToggle');
    if (!bgmBtn) {
      bgmBtn = document.createElement('button');
      bgmBtn.id = 'bgmToggle';
      bgmBtn.type = 'button';
      bgmBtn.className = 'button';
      bgmBtn.textContent = bgmEnabled ? '♪' : '🔇';
      bgmBtn.style.marginTop = '0';
      bgmBtn.style.padding = '0.3rem 0.5rem';
      bgmBtn.addEventListener('click', toggleBgm);
      bar.appendChild(bgmBtn);
    }
    if (!window.scoreDisplayIntervalId) {
      window.scoreDisplayIntervalId = trackedSetInterval(() => {
        const st = document.getElementById('scoreText');
        if (st) st.textContent = String(matchScore || 0);
      }, 300);
    }
  }
}

function hideHpBar() {
  const bar = document.getElementById('hpBar');
  if (bar) bar.hidden = true;
  if (window.scoreDisplayIntervalId) { clearInterval(window.scoreDisplayIntervalId); window.scoreDisplayIntervalId = null; }
}

function updateHpBar() {
  const bar = document.getElementById('hpBar');
  if (!bar) return;
  const fill = bar.querySelector('.hp-fill');
  const text = document.getElementById('hpText');
  const remain = Math.max(0, hpMax - errorCount);
  const pct = Math.round((remain / hpMax) * 100);
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${remain}/${hpMax}`;
}
hideHpBar();

function resetHpBar() {
  errorCount = 0;
  const bar = document.getElementById('hpBar');
  const fill = bar ? bar.querySelector('.hp-fill') : null;
  const text = document.getElementById('hpText');
  if (fill) fill.style.width = '100%';
  if (text) text.textContent = `${hpMax}/${hpMax}`;
  hideHpBar();
}

function startDebugLevel() {
  let n = 1;
  if (debugLevelInput) {
    const v = parseInt(debugLevelInput.value, 10);
    if (!isNaN(v)) n = Math.max(1, Math.min(10, v));
  }
  const startScreen = document.getElementById('startScreen');
  if (startScreen) startScreen.style.display = 'none';
  isGameOver = false;
  systemCleanup(false);
  currentRoute = 'HanYu';
  startTime = Date.now();
  currentLevel = n;
  currentProgress = `Level ${n}`;
  currentLevelIndex = Array.isArray(gameFlow) ? gameFlow.indexOf(n) : -1;
  matchScore = (n - 1) * 10;
  resetHpBar();
  startNumberLevel(n);
}
