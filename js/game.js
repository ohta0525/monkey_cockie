// 無限の猿タイピスト — ゲーム本体
'use strict';

const SAVE_KEY = 'monkeyTypist.save.v2';
const TICK_MS = 100;
const INDIVIDUAL_LIMIT = 40; // これ以下の打鍵数なら1打鍵ずつ実際に抽選する
const STREAM_SAMPLES_PER_SEC = 10;
const COMBO_WINDOW = 4;
const MEISAKU_MAX = 40;

// ───────── 状態 ─────────

function freshLines(idx) {
  const m = MISSIONS[idx];
  return m ? m.lines.map(() => ({ pos: 0, insp: 0 })) : [];
}

function newState() {
  const now = Date.now();
  return {
    v: 2, keys: 0, totalKeys: 0, clicks: 0,
    missionIdx: 0, lines: freshLines(0), keyboard: [],
    gens: {}, ups: {}, tiers: {},
    lv: { edu: 0, insp: 0, hint: 0, team: 0, away: 0 },
    ach: {}, words: {}, books: [], roster: [], meisaku: [],
    muted: false, bestCombo: 0, inspUses: 0, hintUses: 0,
    goldenClicks: 0, strikesSettled: 0,
    keyFrac: 0, clickFrac: 0,
    lastTime: now, startTime: now,
  };
}

let S = newState();

// セーブしない一時状態
const ev = {
  frenzyUntil: 0, clickFrenzyUntil: 0, strikeUntil: 0, nextGolden: 45, goldenUntil: 0,
  combo: 0, comboUntil: 0, hintReadyAt: 0,
  stamp: null, newKeys: {}, sleep: {},
};
const stream = { items: [], buf: '' };
let lastDing = 0;

// ───────── キーボード（ミッションごとに成長） ─────────

function growKeyboard(idx) {
  const m = MISSIONS[idx];
  if (!m) return [];
  const added = [];
  for (const c of m.lines.join('')) {
    if (!S.keyboard.includes(c)) { S.keyboard.push(c); added.push(c); }
  }
  let d = m.decoys;
  for (const c of DECOY_ORDER) {
    if (d <= 0) break;
    if (S.keyboard.includes(c)) continue;
    S.keyboard.push(c);
    added.push(c);
    d--;
  }
  const now = performance.now();
  added.forEach(c => { ev.newKeys[c] = now; });
  return added;
}

// ───────── 性格 ─────────

function levelFactor(r) {
  return 1 + 0.1 * (r.lv - 1);
}

function isAsleep(r) {
  return r.trait === 'nebou' && ev.sleep[r.name] && performance.now() < ev.sleep[r.name];
}

function traitSum(id) {
  let s = 0;
  for (const r of S.roster) {
    if (r.trait !== id) continue;
    if (id === 'nebou' && isAsleep(r)) continue;
    s += levelFactor(r);
  }
  return s;
}

// ───────── 確率 ─────────

function eduWeight() {
  return 1 + 0.5 * S.lv.edu + 0.15 * traitSum('shijin');
}

// ひらめきゲージの満タン回数はキーの数に比例する
function inspMax() {
  return Math.max(3, Math.round(S.keyboard.length * inspMaxAt(S.lv.insp) - 0.5 * traitSum('kichoumen')));
}

function hintCd() {
  return Math.max(4, hintCdAt(S.lv.hint) - 1.5 * traitSum('tetsugaku'));
}

function pHit() {
  const n = S.keyboard.length;
  const w = eduWeight();
  return w / (n - 1 + w);
}

function genChar(target) {
  const pool = S.keyboard;
  const n = pool.length;
  if (!target || n < 2) return pool[Math.floor(Math.random() * n)];
  const w = eduWeight();
  if (Math.random() * (n - 1 + w) < w) return target;
  let c;
  do { c = pool[Math.floor(Math.random() * n)]; } while (c === target);
  return c;
}

function geometric(q) {
  if (q >= 1) return 1;
  return Math.floor(Math.log(1 - Math.random()) / Math.log1p(-q)) + 1;
}

// ───────── 生産量 ─────────

function genMult(g) {
  let m = 1;
  GEN_TIERS.forEach((t, i) => { if (S.tiers[g.id + '_' + i]) m *= 2; });
  return m;
}

function achMult() {
  return 1 + ACH_BONUS * Object.keys(S.ach).length;
}

function stageOf(r) {
  let st = EVOLUTION[0];
  for (const e of EVOLUTION) if (r.lv >= e.lv) st = e;
  return st;
}

function rosterKps(r) {
  const idx = EVOLUTION.indexOf(stageOf(r));
  const base = [0.125, 0.6, 3, 12][idx];
  return base * 0.1 * (r.lv - (r.start || 1));
}

function baseKps() {
  let k = GENERATORS.reduce((sum, g) => sum + (S.gens[g.id] || 0) * g.kps * genMult(g), 0);
  S.roster.forEach(r => { if (!isAsleep(r)) k += rosterKps(r); });
  return k;
}

function kps() {
  const now = performance.now();
  let m = achMult() * (1 + 0.04 * traitSum('hayauchi')) * (1 + 0.1 * traitSum('nebou'));
  if (now < ev.frenzyUntil) m *= 7;
  if (now < ev.strikeUntil) m *= 0.5;
  return baseKps() * m;
}

function clickPower() {
  let mul = 1, pct = 0;
  UPGRADES.forEach(u => {
    if (!S.ups[u.id]) return;
    if (u.clickMul) mul *= u.clickMul;
    if (u.clickPct) pct += u.clickPct;
  });
  let p = mul * achMult() * (1 + 0.1 * traitSum('bungaku')) + kps() * pct;
  if (performance.now() < ev.clickFrenzyUntil) p *= 15;
  return p;
}

function comboMult() {
  return 1 + 0.02 * Math.min(ev.combo, 60);
}

// ───────── 打鍵処理 ─────────

function currentMission() {
  return MISSIONS[S.missionIdx];
}

function lineText(li) {
  return MISSIONS[S.missionIdx].lines[li];
}

function lineDone(li) {
  const m = currentMission();
  return !m || S.lines[li].pos >= m.lines[li].length;
}

function activeLines() {
  if (!currentMission()) return [];
  const res = [];
  for (let i = 0; i < S.lines.length && res.length < 1 + S.lv.team; i++) {
    if (!lineDone(i)) res.push(i);
  }
  return res;
}

function currentTarget(li) {
  if (li === undefined || lineDone(li)) return null;
  return lineText(li)[S.lines[li].pos];
}

function typeOne(li, visual, fromClick) {
  const line = S.lines[li];
  const text = lineText(li);
  const target = text[line.pos];
  const c = genChar(target);
  const hit = c === target;
  if (visual) pushStream(c, hit, fromClick);
  if (hit) {
    confirmChar(li, 'hit');
    return;
  }
  if (line.pos === text.length - 1 && line.pos > 0) recordMeisaku(text.slice(0, line.pos) + c, text);
  line.insp++;
  if (line.insp >= inspMax()) {
    S.inspUses++;
    confirmChar(li, 'insp');
  }
}

// 大量の打鍵は幾何分布でまとめて判定する（ひらめきゲージの天井つき）
function typeBulk(li, K) {
  const mi = S.missionIdx;
  const p = pHit();
  let guard = 0;
  while (K > 0 && guard++ < 10000 && S.missionIdx === mi && !lineDone(li)) {
    const line = S.lines[li];
    const room = inspMax() - line.insp;
    const G = geometric(p);
    const byInsp = G - 1 >= room;
    const cost = byInsp ? room : G;
    if (cost > K) {
      line.insp += Math.min(K, room - 1);
      break;
    }
    K -= cost;
    if (byInsp) S.inspUses++;
    confirmChar(li, byInsp ? 'insp' : 'hit', true);
  }
}

function typeOnLine(li, K, visual, fromClick) {
  const mi = S.missionIdx;
  if (K <= INDIVIDUAL_LIMIT) {
    for (let i = 0; i < K; i++) {
      if (S.missionIdx !== mi || lineDone(li)) break;
      typeOne(li, visual, fromClick);
    }
    return true;
  }
  typeBulk(li, K);
  return false;
}

function sampleStream(n, fromClick) {
  const li = activeLines()[0];
  for (let i = 0; i < n; i++) {
    const t = currentTarget(li);
    const c = genChar(t);
    pushStream(c, t !== null && c === t, fromClick);
  }
}

function earn(K) {
  const gain = K * comboMult();
  S.keys += gain;
  S.totalKeys += gain;
  return gain;
}

function addKeystrokes(K, fromClick, visual, dt) {
  if (K <= 0) return 0;
  const gain = earn(K);
  const mi = S.missionIdx;
  const act = activeLines();
  if (act.length === 0) {
    if (visual) sampleStream(Math.min(K, fromClick ? 6 : Math.ceil(dt * STREAM_SAMPLES_PER_SEC)), fromClick);
    return gain;
  }
  if (fromClick) {
    const individual = typeOnLine(act[0], K, visual, true);
    if (!individual && visual) sampleStream(6, true);
    return gain;
  }
  let shown = false;
  act.forEach((li, j) => {
    if (S.missionIdx !== mi || lineDone(li)) return;
    const ind = typeOnLine(li, K, visual && j === 0, false);
    if (j === 0) shown = ind;
  });
  if (visual && !shown) sampleStream(Math.ceil(dt * STREAM_SAMPLES_PER_SEC), false);
  if (visual) Sound.click(false);
  return gain;
}

function confirmChar(li, how, silent) {
  const line = S.lines[li];
  line.pos++;
  line.insp = 0;
  const now = performance.now();
  ev.combo++;
  ev.comboUntil = now + (COMBO_WINDOW + 0.4 * traitSum('medachi')) * 1000;
  if (ev.combo > S.bestCombo) S.bestCombo = ev.combo;
  ev.stamp = { li, pos: line.pos - 1, how, time: now };
  if (!silent && now - lastDing > 120) {
    Sound.ding();
    lastDing = now;
    const paper = $('paper');
    if (paper) {
      paper.classList.remove('shake');
      void paper.offsetWidth;
      paper.classList.add('shake');
    }
  }
  if (how === 'insp' && !silent) toast('💡 ひらめいた！');
  if (S.lines.every((_, i) => lineDone(i))) completeMission();
}

function useHint() {
  const li = activeLines()[0];
  if (li === undefined || performance.now() < ev.hintReadyAt) return;
  ev.hintReadyAt = performance.now() + hintCd() * 1000;
  S.hintUses++;
  const who = randomMonkeyName();
  log(`📝 ${who ? who + 'に' : ''}「${currentTarget(li)}」を教えた。`);
  confirmChar(li, 'hint');
}

function completeMission() {
  const m = currentMission();
  S.books.push({ id: m.id, time: Date.now() });
  if (m.id === 'konnichiwa') {
    S.gens.kozaru = (S.gens.kozaru || 0) + 1;
    addRoster('kozaru');
    ev.nextGolden = 40;
  }
  S.missionIdx++;
  S.lines = freshLines(S.missionIdx);
  const added = growKeyboard(S.missionIdx);
  Sound.fanfare();
  confetti();
  log(`📜 「${m.display.replace(/\n/g, ' ')}」が完成した！`);
  queueModal(missionModalHtml(m, added));
  dirty.shop = dirty.keyboard = true;
}

// ───────── 打鍵ログ・偶然の単語・迷作 ─────────

function pushStream(c, hit, fromClick) {
  stream.items.push({ c, hit });
  if (stream.items.length > 40) stream.items.splice(0, stream.items.length - 40);
  stream.buf = (stream.buf + c).slice(-10);
  bubble(c, hit, fromClick);
  for (const w of WORDS) {
    if (stream.buf.endsWith(w)) {
      foundWord(w);
      stream.buf = '';
      break;
    }
  }
}

function foundWord(w) {
  const first = !S.words[w];
  S.words[w] = (S.words[w] || 0) + 1;
  const len = w.length;
  const mult = 1 + 0.25 * traitSum('kimagure');
  const bonus = (first ? Math.max(30 * len * len, kps() * 10 * len) : Math.max(3 * len, kps() * len)) * mult;
  S.keys += bonus;
  S.totalKeys += bonus;
  if (first) {
    const who = randomMonkeyName();
    Sound.word();
    log(`✨ ${who ? who + 'が' : ''}偶然「${w}」と打った！（新発見 +${fmt(bonus)}）`);
    toast(`偶然の単語「${w}」を発見！ +${fmt(bonus)}`);
  } else {
    floatText(`「${w}」+${fmt(bonus)}`);
  }
}

function recordMeisaku(text, original) {
  if (S.meisaku.length >= MEISAKU_MAX || Math.random() > 0.08) return;
  if (S.meisaku.some(x => x.text === text)) return;
  S.meisaku.push({ text, original, by: randomMonkeyName(), time: Date.now() });
  log(`🤦 迷作「${text}」が生まれた（正しくは「${original}」）`);
  dirty.books = true;
}

// ───────── 猿の名簿・レベル・進化 ─────────

function addRoster(genId) {
  const startLv = { kozaru: 1, chimp: 10, gorilla: 20 }[genId];
  if (!startLv || S.roster.length >= ROSTER_MAX) return;
  const used = new Set(S.roster.map(r => r.name));
  const free = MONKEY_NAMES.filter(n => !used.has(n));
  if (!free.length) return;
  const name = free[Math.floor(Math.random() * free.length)];
  const trait = TRAIT_IDS[Math.floor(Math.random() * TRAIT_IDS.length)];
  S.roster.push({ name, trait, lv: startLv, start: startLv, xp: 0, since: Date.now() });
  log(`🐵 新入り「${name}」（${TRAITS[trait].name}）が加わった。`);
  dirty.room = dirty.roster = true;
}

function randomMonkeyName() {
  if (!S.roster.length) return null;
  return S.roster[Math.floor(Math.random() * S.roster.length)].name;
}

function xpNeed(lv) {
  return Math.round(12 * Math.pow(lv, 1.25));
}

function feedCost(r) {
  return 10 * Math.pow(1.55, r.lv - 1);
}

function gainXp(r, xp) {
  r.xp += xp;
  while (r.xp >= xpNeed(r.lv)) {
    r.xp -= xpNeed(r.lv);
    const before = stageOf(r);
    r.lv++;
    const after = stageOf(r);
    if (after !== before) {
      Sound.fanfare();
      toast(`🌟 ${r.name}が「${after.title}」に進化した！`);
      log(`🌟 ${r.name}が「${after.title}」に進化した！`);
      dirty.room = true;
    }
    dirty.roster = true;
  }
}

function feed(idx) {
  const r = S.roster[idx];
  if (!r || !spend(feedCost(r))) return;
  gainXp(r, xpNeed(r.lv) - r.xp);
  Sound.word();
}

function updateRoster(dt) {
  const now = performance.now();
  S.roster.forEach(r => {
    if (r.trait === 'nebou') {
      const until = ev.sleep[r.name] || 0;
      if (now > until + 40000 + Math.random() * 20000) {
        ev.sleep[r.name] = now + 15000;
        dirty.room = true;
      } else if (until && now > until && now - dt * 1000 <= until) {
        dirty.room = true;
      }
    }
    if (!isAsleep(r)) gainXp(r, dt);
  });
}

// ───────── 購入 ─────────

function genCost(g) {
  return g.cost * Math.pow(GEN_GROWTH, S.gens[g.id] || 0);
}

function researchCost(r) {
  return r.base * Math.pow(r.growth, S.lv[r.id]);
}

function spend(cost) {
  if (S.keys < cost) return false;
  S.keys -= cost;
  Sound.click(true);
  dirty.shop = true;
  return true;
}

function buyGen(id) {
  const g = GENERATORS.find(x => x.id === id);
  if (!spend(genCost(g))) return;
  S.gens[id] = (S.gens[id] || 0) + 1;
  addRoster(id);
  dirty.room = true;
}

function buyTier(genId, ti) {
  const g = GENERATORS.find(x => x.id === genId);
  if (!spend(g.cost * GEN_TIERS[ti].costMul)) return;
  S.tiers[genId + '_' + ti] = true;
  log(`${g.name}の${GEN_TIERS[ti].name}完了！ 生産 ×2`);
}

function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!spend(u.cost)) return;
  S.ups[id] = true;
  log(`🔧 「${u.name}」を導入した。`);
}

function buyResearch(id) {
  const r = RESEARCH.find(x => x.id === id);
  if (S.lv[id] >= r.max || !spend(researchCost(r))) return;
  S.lv[id]++;
  log(`📚 ${r.name}が Lv${S.lv[id]} になった。`);
}

// ───────── イベント ─────────

function updateEvents(dt) {
  const now = performance.now();
  if (ev.combo > 0 && now > ev.comboUntil) ev.combo = 0;
  if (S.missionIdx < 1) return;
  const golden = $('golden');
  if (!golden.hidden && now > ev.goldenUntil) golden.hidden = true;
  $('strikeBanner').hidden = now >= ev.strikeUntil;
  if (!golden.hidden) return;
  ev.nextGolden -= dt * (1 + 0.08 * traitSum('banana'));
  if (ev.nextGolden > 0) return;
  ev.nextGolden = 60 + Math.random() * 90;
  if (S.missionIdx >= 3 && now >= ev.strikeUntil && Math.random() < 0.15) {
    ev.strikeUntil = now + 45000;
    log('✊ 猿たちがバナナの待遇改善を求めてストライキを始めた！');
    return;
  }
  golden.style.left = (8 + Math.random() * 78) + '%';
  golden.style.top = (10 + Math.random() * 70) + '%';
  golden.hidden = false;
  ev.goldenUntil = now + 13000;
}

function clickGolden() {
  $('golden').hidden = true;
  S.goldenClicks++;
  const now = performance.now();
  const r = Math.random();
  Sound.word();
  if (r < 0.4) {
    ev.frenzyUntil = now + 40000;
    log('🍌 金のバナナ！ 猿たちが熱狂している（40秒間 生産 ×7）');
    toast('熱狂！ 40秒間 生産 ×7');
  } else if (r < 0.75) {
    const bonus = Math.max(100, kps() * 90);
    S.keys += bonus;
    S.totalKeys += bonus;
    log(`🍌 金のバナナ！ 臨時ボーナス +${fmt(bonus)} 打鍵`);
    toast(`臨時ボーナス +${fmt(bonus)}`);
  } else {
    ev.clickFrenzyUntil = now + 15000;
    log('🍌 金のバナナ！ 連打祭り（15秒間 クリック ×15）');
    toast('連打祭り！ 15秒間 クリック ×15');
  }
}

function settleStrike() {
  ev.strikeUntil = 0;
  S.strikesSettled++;
  $('strikeBanner').hidden = true;
  Sound.word();
  log('🍌 バナナで説得した。猿たちは仕事に戻った。');
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (S.ach[a.id] || !a.check(S)) return;
    S.ach[a.id] = Date.now();
    toast(`🏆 実績「${a.name}」 生産 +${Math.round(ACH_BONUS * 100)}%`);
    log(`🏆 実績「${a.name}」を解除した。`);
    dirty.ach = true;
  });
}

// ───────── メインループ ─────────

let lastTick = performance.now();

function step(dt, visual, eff) {
  const k = kps() * dt * (eff || 1) + S.keyFrac;
  const K = Math.floor(k);
  S.keyFrac = k - K;
  if (K > 0) addKeystrokes(K, false, visual, dt);
  updateRoster(dt);
}

function simulate(seconds, eff) {
  const steps = Math.min(600, Math.max(1, Math.ceil(seconds)));
  const dt = seconds / steps;
  for (let i = 0; i < steps; i++) step(dt, false, eff);
}

function tick() {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  if (dt > 2) simulate(dt, 1);
  else step(dt, true);
  updateEvents(dt);
}

// ───────── セーブ ─────────

function save() {
  S.lastTime = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ }
}

function loadFrom(data) {
  const s = Object.assign(newState(), data);
  s.lv = Object.assign(newState().lv, data.lv || {});
  const m = MISSIONS[s.missionIdx];
  if (!Array.isArray(s.lines) || (m && s.lines.length !== m.lines.length)) s.lines = freshLines(s.missionIdx);
  S = s;
  Sound.muted = S.muted;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* 読み込めない環境 */ }
  if (raw) {
    try { loadFrom(JSON.parse(raw)); } catch (e) { console.warn('セーブデータを読み込めませんでした', e); }
  }
  if (!S.keyboard.length) growKeyboard(S.missionIdx);
  ev.newKeys = {};
}

function applyOffline() {
  const elapsed = (Date.now() - S.lastTime) / 1000;
  if (elapsed < 30 || baseKps() <= 0) return;
  const eff = Math.min(1, 0.5 + 0.1 * S.lv.away + 0.03 * traitSum('shizuka'));
  const capH = 2 + 2 * S.lv.away;
  const secs = Math.min(elapsed, capH * 3600);
  const before = S.totalKeys;
  const beforeMission = S.missionIdx;
  simulate(secs, eff);
  ev.combo = 0;
  const gained = S.totalKeys - before;
  const done = S.missionIdx - beforeMission;
  const capped = elapsed > secs ? `（上限 ${capH} 時間まで）` : '';
  queueModal(`<img class="modal-img" src="${IMG('zzz')}" alt="">
    <h2>おかえりなさい</h2>
    <p>留守の ${fmtDuration(elapsed)} の間に${capped}、猿たちが<br><b class="big">${fmt(gained)} 打鍵</b><br>しました。（効率 ${Math.round(eff * 100)}%）</p>
    ${done > 0 ? `<p>その間に ${done} 個の作品が完成しています。</p>` : ''}`, true);
}

function fmtDuration(sec) {
  if (sec < 60) return `${Math.floor(sec)}秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分`;
  const h = Math.floor(sec / 3600);
  return h < 48 ? `${h}時間${Math.floor((sec % 3600) / 60)}分` : `${Math.floor(h / 24)}日`;
}

// ───────── 描画 ─────────

const $ = id => document.getElementById(id);
const dirty = { shop: true, ach: true, books: true, roster: true, room: true, keyboard: true };
let shopSig = '';
let paperSig = '';
let keyboardSig = '';

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function img(name, cls) {
  return `<img class="${cls || 'ico'}" src="${IMG(name)}" alt="" draggable="false">`;
}

function renderStats() {
  $('statKeys').textContent = fmt(S.keys);
  $('statKps').textContent = fmtRate(kps());
  $('statClick').textContent = fmtRate(clickPower());
  document.title = `${fmt(S.keys)} 打鍵 | 無限の猿タイピスト`;
}

function renderPaper() {
  const m = currentMission();
  const act = activeLines();
  const sig = S.missionIdx + '|' + S.lines.map(l => l.pos).join(',') + '|' + act.join(',');
  if (sig === paperSig) return;
  paperSig = sig;

  if (!m) {
    $('missionChapter').textContent = '第一章　日本編　完';
    $('missionTitle').textContent = '渡航準備中';
    $('missionSource').textContent = '';
    $('paper').innerHTML = `<div class="paper-end">
      <p class="end-title">日本編　完</p>
      <p>猿たちはイギリス行きの船を待っている。</p>
      <p class="muted">第二章「英語編 — To be, or not to be」は準備中です。<br>打鍵はこのまま貯まり続けます。</p></div>`;
    return;
  }

  $('missionChapter').textContent = `第一章　日本編　— ミッション ${S.missionIdx + 1} / ${MISSIONS.length}`;
  $('missionTitle').textContent = m.title;
  $('missionSource').textContent = m.source ? `出典：${m.source}` : '';

  const st = ev.stamp && performance.now() - ev.stamp.time < 600 ? ev.stamp : null;
  $('paper').innerHTML = m.lines.map((text, li) => {
    const line = S.lines[li];
    const done = line.pos >= text.length;
    const active = act.includes(li);
    const mark = done ? '✓' : active ? img('monkey', 'pmark-img') : '・';
    const body = [...text].map((c, k) => {
      if (k < line.pos) {
        const stamp = st && st.li === li && st.pos === k ? ` stamp stamp-${st.how}` : '';
        return `<span class="done${stamp}">${esc(c)}</span>`;
      }
      if (k === line.pos && active) return `<span class="cursor">${esc(c)}</span>`;
      return `<span class="todo">${esc(c)}</span>`;
    }).join('');
    return `<div class="pline${done ? ' is-done' : ''}${active ? ' is-active' : ''}"><span class="pmark">${mark}</span><span class="ptext">${body}</span></div>`;
  }).join('');
}

function renderGauges() {
  const li = activeLines()[0];
  const max = inspMax();
  const cur = li === undefined ? 0 : S.lines[li].insp;
  $('inspFill').style.width = (100 * cur / max) + '%';
  $('inspText').textContent = `${cur} / ${max}`;

  const combo = ev.combo;
  $('comboText').textContent = combo > 0 ? `${combo} コンボ ×${comboMult().toFixed(2)}` : 'コンボなし';
  const left = Math.max(0, ev.comboUntil - performance.now()) / ((COMBO_WINDOW + 0.4 * traitSum('medachi')) * 1000);
  $('comboFill').style.width = (combo > 0 ? 100 * left : 0) + '%';
  document.body.classList.toggle('on-fire', combo >= 10);

  const wait = Math.max(0, ev.hintReadyAt - performance.now()) / 1000;
  const hb = $('hintBtn');
  hb.disabled = wait > 0 || li === undefined;
  $('hintText').textContent = wait > 0 ? `${Math.ceil(wait)}秒` : li === undefined ? '—' : `「${currentTarget(li)}」を教える`;

  const n = S.keyboard.length;
  $('odds').textContent = `キー ${n}個 ・ 当たり 1/${(1 / pHit()).toFixed(1)}`;
}

function renderKeyboard() {
  const t = currentTarget(activeLines()[0]);
  const sig = S.keyboard.join('') + '|' + t;
  if (sig === keyboardSig && !dirty.keyboard) return;
  keyboardSig = sig;
  dirty.keyboard = false;
  const now = performance.now();
  $('keyboard').innerHTML = S.keyboard.map(c => {
    const isNew = ev.newKeys[c] && now - ev.newKeys[c] < 8000;
    return `<span class="kc${c === t ? ' target' : ''}${isNew ? ' new' : ''}">${esc(c)}</span>`;
  }).join('');
}

function renderStream() {
  $('stream').innerHTML = stream.items.map(it => `<span class="${it.hit ? 'hit' : ''}">${esc(it.c)}</span>`).join('');
}

let roomSig = '';

function renderRoom() {
  const sig = S.roster.map(r => r.name + stageOf(r).lv + r.lv + isAsleep(r)).join(',') + '|' + GENERATORS.map(g => S.gens[g.id] || 0).join(',');
  if (sig === roomSig && !dirty.room) return;
  roomSig = sig;
  dirty.room = false;
  const room = $('room');
  if (S.missionIdx < 1 && !S.roster.length) {
    room.innerHTML = '<div class="room-empty">まだ誰もいない。「こんにちは」を完成させると猿がやってくる。</div>';
    return;
  }
  const named = S.roster.map((r, i) => {
    const st = stageOf(r);
    return `<div class="desk-slot${isAsleep(r) ? ' asleep' : ''}" data-r="${i}" style="--d:${(i % 5) * 0.13}s">
      <div class="bubbles"></div>
      ${img(st.img, 'monkey-img')}
      ${isAsleep(r) ? img('zzz', 'zzz') : ''}
      <div class="typewriter">${img('keyboard', 'tw-img')}</div>
      <div class="tag">${esc(r.name)}<small>Lv${r.lv}</small></div>
    </div>`;
  }).join('');
  const extras = GENERATORS.map(g => {
    const n = (S.gens[g.id] || 0);
    if (!n) return '';
    return `<div class="extra">${img(g.img, 'extra-img')}<span>×${fmt(n)}</span></div>`;
  }).join('');
  room.innerHTML = `<div class="room-floor">${named}</div><div class="room-extras">${extras}</div>`;
}

let bubbleCount = 0;
let lastBubble = 0;

function bubble(c, hit, fromClick) {
  const now = performance.now();
  if (!fromClick && now - lastBubble < 110) return;
  lastBubble = now;
  if (bubbleCount > 24) return;
  let host;
  if (fromClick) {
    host = $('keyBubbles');
  } else {
    const slots = document.querySelectorAll('.desk-slot:not(.asleep) .bubbles');
    if (!slots.length) return;
    host = slots[Math.floor(Math.random() * slots.length)];
  }
  const el = document.createElement('span');
  el.className = 'bubble' + (hit ? ' hit' : '');
  el.textContent = c;
  el.style.setProperty('--x', (Math.random() * 40 - 20) + 'px');
  host.appendChild(el);
  bubbleCount++;
  setTimeout(() => { el.remove(); bubbleCount--; }, 900);
}

function itemHtml({ id, icon, name, sub, cost, owned, action, disabled }) {
  return `<button class="item" data-action="${action}" data-id="${id}" ${disabled ? 'disabled' : ''}>
    <span class="item-icon">${icon}</span>
    <span class="item-main"><span class="item-name">${esc(name)}</span><span class="item-sub">${sub}</span></span>
    <span class="item-side">${owned !== undefined ? `<span class="item-owned">${owned}</span>` : ''}<span class="item-cost" data-cost="${cost}">${fmt(cost)}</span></span>
  </button>`;
}

function visibleGens() {
  return GENERATORS.filter((g, i) => {
    if (i === 0 || S.gens[g.id]) return true;
    return S.gens[GENERATORS[i - 1].id] > 0 || S.totalKeys >= g.cost * 0.4;
  });
}

function availableTiers() {
  const res = [];
  GENERATORS.forEach(g => GEN_TIERS.forEach((t, ti) => {
    if (!S.tiers[g.id + '_' + ti] && (S.gens[g.id] || 0) >= t.need) res.push({ g, t, ti });
  }));
  return res;
}

function renderShop() {
  const gens = visibleGens();
  const tiers = availableTiers();
  const ups = UPGRADES.filter(u => !S.ups[u.id] && u.cond(S));
  const res = RESEARCH.filter(r => r.cond(S));
  const sig = [S.missionIdx, gens.map(g => g.id + (S.gens[g.id] || 0)), tiers.map(t => t.g.id + t.ti), ups.map(u => u.id), res.map(r => r.id + S.lv[r.id])].join('|');
  if (sig !== shopSig || dirty.shop) {
    shopSig = sig;
    dirty.shop = false;

    let mh = '';
    if (S.missionIdx < 1) {
      mh = `<div class="locked">${img('monkey', 'locked-img')}<br>まずは自分の手で「こんにちは」を打ち上げよう。<br>完成すると最初の猿が仲間になり、自動で打鍵してくれます。</div>`;
    } else {
      if (tiers.length) {
        mh += '<h3>特訓</h3>' + tiers.map(({ g, t, ti }) => itemHtml({
          id: g.id + ':' + ti, icon: img(g.img), name: `${g.name}の${t.name}`, sub: `${g.name}の生産 ×2`,
          cost: g.cost * t.costMul, action: 'tier',
        })).join('');
      }
      mh += '<h3>猿を雇う</h3>' + gens.map(g => {
        const each = g.kps * genMult(g) * achMult();
        return itemHtml({
          id: g.id, icon: img(g.img), name: g.name, sub: `${esc(g.desc)}<br>1体 毎秒 ${fmtRate(each)} 打鍵`,
          cost: genCost(g), owned: S.gens[g.id] || 0, action: 'gen',
        });
      }).join('');
      if (GENERATORS[gens.length]) mh += '<div class="locked small">？？？ — もっと打鍵を貯めると……</div>';
    }
    $('panelMonkeys').innerHTML = mh;

    let rh = '';
    if (ups.length) {
      rh += '<h3>道具</h3>' + ups.map(u => itemHtml({ id: u.id, icon: img(u.clickPct ? 'banana' : 'wrench'), name: u.name, sub: u.desc, cost: u.cost, action: 'up' })).join('');
    }
    if (res.length) {
      rh += '<h3>研究</h3>' + res.map(r => {
        const maxed = S.lv[r.id] >= r.max;
        return itemHtml({
          id: r.id, icon: img(r.img), name: `${r.name} Lv${S.lv[r.id]}${maxed ? '（最大）' : ''}`,
          sub: maxed ? '研究しつくした' : r.desc(S.lv[r.id]), cost: maxed ? Infinity : researchCost(r), action: 'res', disabled: maxed,
        });
      }).join('');
    }
    const owned = UPGRADES.filter(u => S.ups[u.id]);
    if (owned.length) rh += `<h3>導入済み</h3><p class="muted small">${owned.map(u => u.name).join('・')}</p>`;
    if (!rh) rh = '<div class="locked">まだ研究できるものはない。</div>';
    $('panelResearch').innerHTML = rh;
  }
  document.querySelectorAll('.side .item').forEach(el => {
    const cost = parseFloat(el.querySelector('.item-cost').dataset.cost);
    const can = S.keys >= cost;
    el.classList.toggle('affordable', can);
    el.disabled = !can || !isFinite(cost);
  });
}

function renderAch() {
  if (!dirty.ach) return;
  dirty.ach = false;
  const got = Object.keys(S.ach).length;
  $('panelAch').innerHTML = `<p class="muted">解除 ${got} / ${ACHIEVEMENTS.length}（生産 +${Math.round(got * ACH_BONUS * 100)}%）</p>
    <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.ach[a.id] ? 'got' : ''}" title="${esc(a.desc)}">
      ${S.ach[a.id] ? img('trophy', 'ach-img') : '<span class="ach-q">？</span>'}<span class="ach-name">${S.ach[a.id] ? esc(a.name) : '？？？'}</span><span class="ach-desc">${esc(a.desc)}</span></div>`).join('')}</div>
    <h3>偶然の単語</h3>
    <p class="muted small">打鍵ログに偶然あらわれた単語。見つけるたびにボーナス。</p>
    <div class="words">${WORDS.map(w => S.words[w] ? `<span class="word got">${esc(w)}<small>×${S.words[w]}</small></span>` : `<span class="word">${'？'.repeat(w.length)}</span>`).join('')}</div>`;
}

function renderBooks() {
  if (!dirty.books) return;
  dirty.books = false;
  let html = '<h3>名作</h3>';
  html += S.books.length ? '<div class="shelf">' + S.books.map((b, i) => {
    const m = MISSIONS.find(x => x.id === b.id);
    return `<button class="book" data-book="${i}" style="--hue:${(i * 47) % 360}"><span>${esc(m.display.split('\n')[0])}</span></button>`;
  }).join('') + '</div><p class="muted small">背表紙をクリックすると読めます。</p>' : '<div class="locked">まだ完成した作品はない。</div>';
  html += `<h3>迷作（${S.meisaku.length} / ${MEISAKU_MAX}）</h3>`;
  html += S.meisaku.length ? '<ul class="meisaku">' + S.meisaku.slice().reverse().map(x =>
    `<li><span class="mz">${esc(x.text)}</span><span class="mz-meta">${x.by ? esc(x.by) + ' 作 ・ ' : ''}正しくは「${esc(x.original)}」</span></li>`).join('') + '</ul>'
    : '<p class="muted small">完成直前に最後の1文字を打ち間違えると迷作が生まれることがある。</p>';
  $('panelBooks').innerHTML = html;
}

let rosterSig = '';

function renderRoster() {
  const sig = S.roster.map(r => r.name + r.lv).join(',') + '|' + totalMonkeys(S);
  if (sig === rosterSig && !dirty.roster) {
    document.querySelectorAll('.roster .xp-fill').forEach((el, i) => {
      const r = S.roster[i];
      if (r) el.style.width = (100 * r.xp / xpNeed(r.lv)) + '%';
    });
    return;
  }
  rosterSig = sig;
  dirty.roster = false;
  if (!S.roster.length) {
    $('panelRoster').innerHTML = '<div class="locked">まだ猿はいない。</div>';
    return;
  }
  const others = (S.gens.kozaru || 0) + (S.gens.chimp || 0) + (S.gens.gorilla || 0) - S.roster.length;
  $('panelRoster').innerHTML = '<p class="muted small">名前つきの猿は時間とともに成長し、Lv10・20・35で進化する。バナナをあげると即レベルアップ。</p><ul class="roster">' + S.roster.map((r, i) => {
    const st = stageOf(r);
    const cost = feedCost(r);
    return `<li>
      ${img(st.img, 'r-img')}
      <div class="r-main">
        <div><span class="r-name">${esc(r.name)}</span> <span class="r-meta">${esc(st.title)} Lv${r.lv}</span></div>
        <div class="r-trait"><b>${esc(TRAITS[r.trait].name)}</b>：${esc(TRAITS[r.trait].desc)}</div>
        <div class="xp"><div class="xp-fill" style="width:${100 * r.xp / xpNeed(r.lv)}%"></div></div>
      </div>
      <button class="btn feed" data-feed="${i}" data-cost="${cost}" ${S.keys < cost ? 'disabled' : ''}>${img('banana', 'btn-img')}${fmt(cost)}</button>
    </li>`;
  }).join('') + '</ul>' + (others > 0 ? `<p class="muted small">ほか、名もなき猿たち ${fmt(others)} 匹。</p>` : '');
}

function render() {
  renderStats();
  renderPaper();
  renderGauges();
  renderKeyboard();
  renderStream();
  renderRoom();
  renderShop();
  const tab = document.querySelector('.tab.active').dataset.tab;
  if (tab === 'ach') renderAch();
  if (tab === 'books') renderBooks();
  if (tab === 'roster') {
    renderRoster();
    document.querySelectorAll('.feed').forEach(b => { b.disabled = S.keys < parseFloat(b.dataset.cost); });
  }
}

// ───────── UI 部品 ─────────

function log(text) {
  const li = document.createElement('li');
  li.textContent = text;
  const ul = $('log');
  ul.prepend(li);
  while (ul.children.length > 40) ul.lastChild.remove();
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  const box = $('toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}

function floatText(text) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = (30 + Math.random() * 40) + '%';
  $('keyArea').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function confetti() {
  const colors = ['#d9a520', '#a2342a', '#3f6b3a', '#2f5d8a', '#f5ecd7'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.animationDelay = Math.random() * 0.4 + 's';
    el.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    el.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}

const modalQueue = [];

function queueModal(html, front) {
  if (front) modalQueue.unshift(html); else modalQueue.push(html);
  if ($('modal').hidden) showNextModal();
}

function showNextModal() {
  const html = modalQueue.shift();
  if (!html) {
    $('modal').hidden = true;
    return;
  }
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
}

function missionModalHtml(m, added) {
  const keys = added && added.length
    ? `<p class="newkeys">新しいキー：${added.map(c => `<span class="kc new">${esc(c)}</span>`).join('')}</p>` : '';
  return `${img('party_popper', 'modal-img')}
    <div class="mission-clear">完 成</div>
    <div class="calligraphy">${esc(m.display).replace(/\n/g, '<br>')}</div>
    ${m.source ? `<div class="muted">— ${esc(m.source)}</div>` : ''}
    <p class="reward">${esc(m.reward)}</p>${keys}`;
}

function bookModalHtml(b) {
  const m = MISSIONS.find(x => x.id === b.id);
  const d = new Date(b.time);
  return `<div class="calligraphy">${esc(m.display).replace(/\n/g, '<br>')}</div>
    ${m.source ? `<div class="muted">— ${esc(m.source)}</div>` : ''}
    <p class="muted small">${d.toLocaleString('ja-JP')} 完成</p>`;
}

function doClick() {
  Sound.ensure();
  S.clicks++;
  const cp = clickPower() + S.clickFrac;
  const K = Math.floor(cp);
  S.clickFrac = cp - K;
  const gain = addKeystrokes(K, true, true, 0);
  Sound.click(true);
  const key = $('typeKey');
  key.classList.remove('pressed');
  void key.offsetWidth;
  key.classList.add('pressed');
  floatText('+' + fmt(gain));
  renderStats();
  renderPaper();
  renderGauges();
  renderKeyboard();
}

function bindUI() {
  $('typeKey').addEventListener('click', doClick);
  $('hintBtn').addEventListener('click', () => { Sound.ensure(); useHint(); render(); });
  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    if (!$('modal').hidden) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); showNextModal(); }
      return;
    }
    if (e.key === 'Tab') return;
    if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    doClick();
  });

  document.querySelector('.side').addEventListener('click', e => {
    const item = e.target.closest('.item');
    if (item && !item.disabled) {
      const { action, id } = item.dataset;
      if (action === 'gen') buyGen(id);
      if (action === 'tier') { const [g, t] = id.split(':'); buyTier(g, +t); }
      if (action === 'up') buyUpgrade(id);
      if (action === 'res') buyResearch(id);
      render();
      return;
    }
    const fb = e.target.closest('.feed');
    if (fb && !fb.disabled) {
      feed(+fb.dataset.feed);
      dirty.roster = dirty.room = true;
      render();
      return;
    }
    const book = e.target.closest('.book');
    if (book) queueModal(bookModalHtml(S.books[+book.dataset.book]));
  });

  $('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
    dirty.ach = dirty.books = dirty.roster = true;
    render();
  });

  $('golden').addEventListener('click', clickGolden);
  $('strikeBtn').addEventListener('click', settleStrike);
  $('modalOk').addEventListener('click', showNextModal);

  $('muteBtn').addEventListener('click', () => {
    S.muted = Sound.muted = !S.muted;
    updateMuteBtn();
  });

  $('exportBtn').addEventListener('click', () => {
    save();
    $('saveText').value = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
    $('saveText').select();
    toast('セーブ文字列を書き出しました');
  });
  $('importBtn').addEventListener('click', () => {
    const text = $('saveText').value.trim();
    if (!text) return;
    try {
      loadFrom(JSON.parse(decodeURIComponent(escape(atob(text)))));
      if (!S.keyboard.length) growKeyboard(S.missionIdx);
      Object.keys(dirty).forEach(k => { dirty[k] = true; });
      paperSig = '';
      save();
      toast('セーブを読み込みました');
      updateMuteBtn();
      render();
    } catch (e) {
      toast('読み込みに失敗しました');
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('本当に最初からやり直しますか？ すべての進行が消えます。')) return;
    S = newState();
    save();
    location.reload();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('beforeunload', save);
}

function updateMuteBtn() {
  $('muteBtn').textContent = S.muted ? '🔇' : '🔊';
}

// ───────── 起動 ─────────

function init() {
  load();
  bindUI();
  updateMuteBtn();
  applyOffline();
  if (S.totalKeys === 0) {
    log('🐒 無限の猿がタイプライターを叩けば、いつかシェイクスピアを書き上げる——らしい。');
    log('まずは自分の手で打ってみよう。');
  }
  render();
  lastTick = performance.now();
  setInterval(() => {
    tick();
    render();
  }, TICK_MS);
  setInterval(checkAchievements, 1000);
  setInterval(save, 5000);
  setInterval(() => { dirty.books = true; }, 2000);
}

init();
