// 無限の猿タイピスト — ゲーム本体
'use strict';

const SAVE_KEY = 'monkeyTypist.save.v2';
const TICK_MS = 100;
const INDIVIDUAL_LIMIT = 40; // これ以下の打鍵数なら1打鍵ずつ実際に抽選する
const STREAM_SAMPLES_PER_SEC = 10;
const COMBO_WINDOW = 4;
const MEISAKU_MAX = 40;

// ───────── 状態 ─────────

// 章ごとの状態。英国編では大文字・句読点・空白もすべてキーとして打つ。
let chapterIdx = 0;

function isKey(c) {
  return c !== undefined;
}

function keyOf(c) {
  return c;
}

// 空白キーは見えるように表示する
function keyLabel(c) {
  return c === ' ' ? '␣' : c;
}

function costMul() {
  return CHAPTERS[chapterIdx].costMul || 1;
}

function nextKeyPos(text, from) {
  let p = from;
  while (p < text.length && !isKey(text[p])) p++;
  return p;
}

function freshLines(idx) {
  const m = MISSIONS[idx];
  return m ? m.lines.map(l => ({ pos: nextKeyPos(l, 0), insp: 0 })) : [];
}

function applyChapter() {
  chapterIdx = S.chapter || 0;
  setChapter(chapterIdx);
  document.body.dataset.chapter = CHAPTERS[chapterIdx].id;
}

function newState() {
  const now = Date.now();
  return {
    v: 2, keys: 0, totalKeys: 0, clicks: 0, chapter: 0, fame: 1,
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
  newKeys: {}, sleep: {}, pendingFx: null,
};
const stream = { items: [], buf: '' };
let fxEnabled = false; // 起動直後の留守中シミュレーションでは演出しない

// ───────── キーボード（ミッションごとに成長） ─────────

function growKeyboard(idx) {
  const m = MISSIONS[idx];
  if (!m) return [];
  const added = [];
  for (const raw of m.lines.join('')) {
    if (!isKey(raw)) continue;
    const c = keyOf(raw);
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
  return baseKps() * m * (S.fame || 1);
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
  return keyOf(lineText(li)[S.lines[li].pos]);
}

function typeOne(li, visual, fromClick) {
  const line = S.lines[li];
  const text = lineText(li);
  const target = keyOf(text[line.pos]);
  const c = genChar(target);
  const hit = c === target;
  if (visual) pushStream(c, hit, fromClick);
  if (hit) {
    confirmChar(li, 'hit');
    return;
  }
  if (line.pos > 0 && nextKeyPos(text, line.pos + 1) >= text.length) recordMeisaku(text.slice(0, line.pos) + c, text);
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
    confirmChar(li, byInsp ? 'insp' : 'hit');
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

function confirmChar(li, how) {
  const line = S.lines[li];
  const text = lineText(li);
  const at = line.pos;
  const ch = text[at];
  line.pos = nextKeyPos(text, at + 1);
  line.insp = 0;
  const now = performance.now();
  ev.combo++;
  ev.comboUntil = now + (COMBO_WINDOW + 0.4 * traitSum('medachi')) * 1000;
  if (ev.combo > S.bestCombo) S.bestCombo = ev.combo;
  // 演出は描画のタイミングでまとめて出す（同じtick内なら最後の1文字だけ）
  ev.pendingFx = { ch, li, pos: at, how, combo: ev.combo, mi: S.missionIdx };
  if (S.lines.every((_, i) => lineDone(i))) completeMission();
}

function flushFx() {
  const f = ev.pendingFx;
  ev.pendingFx = null;
  if (!f || !fxEnabled) return;
  if (f.ch === ' ') f.ch = '␣';
  const find = () => (S.missionIdx === f.mi ? document.querySelector(`[data-k="${f.li}-${f.pos}"]`) : null);
  FX.confirm(esc(f.ch), f.how, f.combo, find);
}

function useHint() {
  const li = activeLines()[0];
  if (li === undefined || performance.now() < ev.hintReadyAt) return;
  ev.hintReadyAt = performance.now() + hintCd() * 1000;
  S.hintUses++;
  const who = randomMonkeyName();
  log(`${who ? who + 'に' : ''}「${keyLabel(currentTarget(li))}」を教えた。`, 'notebook-pen');
  confirmChar(li, 'hint');
}

function completeMission() {
  const m = currentMission();
  const no = S.missionIdx + 1;
  S.books.push({ id: m.id, time: Date.now() });
  if (m.id === 'konnichiwa') {
    S.gens.kozaru = (S.gens.kozaru || 0) + 1;
    addRoster('kozaru');
    ev.nextGolden = 40;
  }
  S.missionIdx++;
  S.lines = freshLines(S.missionIdx);
  const added = growKeyboard(S.missionIdx);
  log(`「${m.display.replace(/\n/g, ' ')}」が完成した。`, 'scroll-text');
  const show = () => queueCine(m, no, added, chapterIdx);
  if (fxEnabled) setTimeout(show, 900); else show();
  dirty.shop = dirty.keyboard = true;
}

// ───────── 打鍵記録・偶然の単語・迷作 ─────────

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
    log(`${who ? who + 'が' : ''}偶然「${w}」と打った。新発見 +${fmt(bonus)}`, 'sparkles');
    toast(`偶然の単語「${w}」を発見 +${fmt(bonus)}`, 'sparkles');
  } else {
    floatText(`「${w}」+${fmt(bonus)}`);
  }
}

function recordMeisaku(text, original) {
  if (S.meisaku.length >= MEISAKU_MAX || Math.random() > 0.08) return;
  if (S.meisaku.some(x => x.text === text)) return;
  S.meisaku.push({ text, original, by: randomMonkeyName(), time: Date.now() });
  log(`迷作「${text}」が生まれた（正しくは「${original}」）`, 'feather');
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
  log(`新入り「${name}」（${TRAITS[trait].name}）が加わった。`, 'users');
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
      if (fxEnabled) Sound.fanfare();
      toast(`${r.name}が「${after.title}」に進化した`, 'dna');
      log(`${r.name}が「${after.title}」に進化した。`, 'dna');
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
      if (now > until + 40000 + Math.random() * 20000) ev.sleep[r.name] = now + 15000;
    }
    if (!isAsleep(r)) gainXp(r, dt);
  });
}

// ───────── 購入 ─────────

function genCost(g) {
  return g.cost * costMul() * Math.pow(GEN_GROWTH, S.gens[g.id] || 0);
}

function researchCost(r) {
  return r.base * costMul() * Math.pow(r.growth, S.lv[r.id]);
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
  if (!spend(g.cost * costMul() * GEN_TIERS[ti].costMul)) return;
  S.tiers[genId + '_' + ti] = true;
  log(`${g.name}の${GEN_TIERS[ti].name}完了。生産 ×2`, 'medal');
}

function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!spend(u.cost * costMul())) return;
  S.ups[id] = true;
  log(`「${u.name}」を導入した。`, 'wrench');
}

function buyResearch(id) {
  const r = RESEARCH.find(x => x.id === id);
  if (S.lv[id] >= r.max || !spend(researchCost(r))) return;
  S.lv[id]++;
  log(`${r.name}が Lv${S.lv[id]} になった。`, r.icon);
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
    log('猿たちがバナナの待遇改善を求めてストライキを始めた。', 'hand-fist');
    return;
  }
  golden.style.left = (8 + Math.random() * 78) + '%';
  golden.style.top = (18 + Math.random() * 50) + '%';
  golden.hidden = false;
  ev.goldenUntil = now + 13000;
}

function clickGolden() {
  const c = FX.center($('golden'));
  $('golden').hidden = true;
  S.goldenClicks++;
  FX.burst(c.x, c.y, { n: 60, speed: 11 });
  FX.shockwave(c.x, c.y);
  Sound.boom(0.6);
  const now = performance.now();
  const r = Math.random();
  if (r < 0.4) {
    ev.frenzyUntil = now + 40000;
    log('金のバナナ。猿たちが熱狂している（40秒間 生産 ×7）', 'banana');
    toast('熱狂 — 40秒間 生産 ×7', 'banana');
  } else if (r < 0.75) {
    const bonus = Math.max(100, kps() * 90);
    S.keys += bonus;
    S.totalKeys += bonus;
    log(`金のバナナ。臨時ボーナス +${fmt(bonus)} 打鍵`, 'banana');
    toast(`臨時ボーナス +${fmt(bonus)}`, 'banana');
  } else {
    ev.clickFrenzyUntil = now + 15000;
    log('金のバナナ。連打祭り（15秒間 クリック ×15）', 'banana');
    toast('連打祭り — 15秒間 クリック ×15', 'banana');
  }
}

function settleStrike() {
  ev.strikeUntil = 0;
  S.strikesSettled++;
  $('strikeBanner').hidden = true;
  Sound.word();
  log('バナナで説得した。猿たちは仕事に戻った。', 'banana');
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (S.ach[a.id] || !a.check(S)) return;
    S.ach[a.id] = Date.now();
    toast(`実績「${a.name}」 生産 +${Math.round(ACH_BONUS * 100)}%`, 'trophy');
    log(`実績「${a.name}」を解除した。`, 'trophy');
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
  ev.pendingFx = null;
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
  S = s;
  applyChapter();
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
  applyChapter();
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
  queueModal(`<div class="modal-icon">${icon('moon')}</div>
    <div class="kicker">WELCOME BACK</div>
    <h2>おかえりなさい</h2>
    <p>留守の ${fmtDuration(elapsed)} の間に${capped}、猿たちが</p>
    <p class="big">${fmt(gained)}<small>打鍵</small></p>
    <p class="muted">効率 ${Math.round(eff * 100)}%</p>
    ${done > 0 ? `<p>その間に ${done} 作が完成しています。</p>` : ''}`, true);
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
let roomSig = '';
let rosterSig = '';
let lastCombo = 0;

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function art(spec, cls) {
  if (spec.startsWith('h:')) return headSvg(spec.slice(2), cls);
  return icon(spec, cls);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function renderStats() {
  $('statKeys').textContent = fmt(S.keys);
  $('statKps').textContent = fmtRate(kps());
  $('statClick').textContent = fmtRate(clickPower());
  document.title = `${fmt(S.keys)} 打鍵 | 無限の猿タイピスト`;
}

// 縦書き原稿の文字サイズを舞台の大きさに合わせる
function chapterLabel() {
  const c = CHAPTERS[chapterIdx];
  return `CHAPTER ${c.roman} — ${c.name}`;
}

// 原稿の文字サイズを舞台の大きさに合わせる（日本編は縦書き、英国編は横書き）
function layoutManuscript() {
  const wrap = document.querySelector('.manuscript-wrap');
  const m = currentMission();
  if (!wrap) return;
  const vertical = CHAPTERS[chapterIdx].vertical;
  const lines = m ? m.lines : ['完'];
  const longest = Math.max(...lines.map(l => l.length)) + 1;
  const h = wrap.clientHeight;
  const w = wrap.clientWidth;
  const cs = vertical
    ? Math.max(18, Math.min(h * 0.92 / longest, w * 0.86 / (lines.length * 1.5), 120))
    : Math.max(16, Math.min(h * 0.85 / (lines.length * 1.45), w * 0.94 / (longest * 0.5), 104));
  $('paper').style.setProperty('--cs', cs + 'px');
  $('paper').classList.toggle('horizontal', !vertical);
}

function renderPaper() {
  const m = currentMission();
  const act = activeLines();
  const sig = chapterIdx + ':' + S.missionIdx + '|' + S.lines.map(l => l.pos).join(',') + '|' + act.join(',');
  if (sig === paperSig) return;
  const missionChanged = !paperSig.startsWith(chapterIdx + ':' + S.missionIdx + '|');
  paperSig = sig;
  const ch = CHAPTERS[chapterIdx];
  $('missionChapter').textContent = chapterLabel();

  if (!m) {
    const hasNext = chapterIdx < CHAPTERS.length - 1;
    $('missionTitle').textContent = hasNext ? '渡航準備完了' : '全編完結';
    $('missionSource').textContent = hasNext
      ? '猿たちはイギリス行きの船を待っている。'
      : '第三章は準備中。打鍵は貯まり続ける。';
    $('missionCount').innerHTML = '<b>完</b>';
    $('paper').innerHTML = `<div class="pline"><span class="ptext"><span class="done">${esc(ch.name)}</span></span></div><div class="pline"><span class="ptext"><span class="done seal-inline">完</span></span></div>`;
    $('paper').classList.remove('horizontal');
    $('travelBox').hidden = !hasNext;
    if (hasNext) renderTravelBox();
    $('paper').style.setProperty('--cs', '72px');
    return;
  }
  $('travelBox').hidden = true;

  $('missionTitle').textContent = m.title;
  $('missionSource').textContent = m.source || '';
  $('missionCount').innerHTML = `<b>${pad2(S.missionIdx + 1)}</b><span>/ ${pad2(MISSIONS.length)}</span>`;

  $('paper').innerHTML = m.lines.map((text, li) => {
    const line = S.lines[li];
    const done = line.pos >= text.length;
    const active = act.includes(li);
    const body = [...text].map((c, k) => {
      const key = `data-k="${li}-${k}"`;
      const sp = c === ' ' ? ' sp' : '';
      const shown = sp ? '\u00a0' : esc(c);
      if (k < line.pos) return `<span class="done${sp}" ${key}>${shown}</span>`;
      if (k === line.pos && active) return `<span class="cursor${sp}" ${key}>${shown}</span>`;
      return `<span class="todo${sp}" ${key}>${shown}</span>`;
    }).join('');
    return `<div class="pline${done ? ' is-done' : ''}${active ? ' is-active' : ''}"><span class="pmark"></span><span class="ptext">${body}</span></div>`;
  }).join('');
  if (missionChanged) layoutManuscript();
}

// ───────── 渡航 ─────────

function renderTravelBox() {
  const fame = fameFor(S.books.length);
  $('travelBox').innerHTML = `
    <div class="kicker">NEXT — CHAPTER ${CHAPTERS[chapterIdx + 1].roman}</div>
    <div class="travel-title">イギリスへ渡る</div>
    <ul class="travel-list">
      <li>${icon('users')}名前つきの猿 ${S.roster.length} 匹・実績・書棚は引き継ぐ</li>
      <li>${icon('rotate-ccw')}打鍵・雇った猿・道具・研究はリセット</li>
      <li>${icon('crown')}名声ボーナス：生産 <b>×${fame.toFixed(1)}</b>（作品 ${S.books.length} 作）</li>
    </ul>
    <button class="btn gold" id="travelBtn">${icon('rocket')}出航する</button>`;
}

function travel() {
  if (currentMission() || chapterIdx >= CHAPTERS.length - 1) return;
  S.fame = fameFor(S.books.length);
  S.chapter = chapterIdx + 1;
  applyChapter();
  S.missionIdx = 0;
  S.keyboard = [];
  S.lines = freshLines(0);
  S.keys = 0;
  S.keyFrac = 0;
  S.gens = { kozaru: 1 };
  S.tiers = {};
  S.ups = {};
  S.lv = Object.assign(newState().lv, { away: S.lv.away });
  growKeyboard(0);
  ev.combo = 0;
  ev.hintReadyAt = 0;
  stream.items = [];
  stream.buf = '';
  Object.keys(dirty).forEach(k => { dirty[k] = true; });
  paperSig = '';
  keyboardSig = '';
  log(`イギリスへ渡った。名声ボーナス ×${S.fame.toFixed(1)}`, 'rocket');
  const c = CHAPTERS[chapterIdx];
  queueOverlay(done => FX.cinematic({
    kicker: `CHAPTER ${c.roman}`,
    horizontal: true,
    sealText: '航',
    brush: true,
    display: c.name,
    source: 'To be, or not to be.',
    reward: `猿たちはロンドンに着いた。英字のタイプライターは、まだキーが少ない。名声ボーナスで生産 ×${S.fame.toFixed(1)}。`,
    keysHtml: `<div class="newkeys"><span class="kicker">KEYS</span>${S.keyboard.map(k => `<span class="kc new">${esc(k)}</span>`).join('')}</div>`,
  }, done));
  save();
  render();
  layoutManuscript();
}

function renderGauges() {
  const li = activeLines()[0];
  const max = inspMax();
  const cur = li === undefined ? 0 : S.lines[li].insp;
  $('inspFill').style.width = (100 * cur / max) + '%';
  $('inspText').textContent = `${cur} / ${max}`;

  const combo = ev.combo;
  $('comboText').textContent = combo > 0 ? `コンボ ${combo}　×${comboMult().toFixed(2)}` : 'コンボ —';
  const left = Math.max(0, ev.comboUntil - performance.now()) / ((COMBO_WINDOW + 0.4 * traitSum('medachi')) * 1000);
  $('comboFill').style.width = (combo > 0 ? 100 * left : 0) + '%';
  document.body.classList.toggle('on-fire', combo >= 10);

  const big = $('comboBig');
  if (combo !== lastCombo) {
    big.innerHTML = combo >= 3 ? `<b>${combo}</b><span>COMBO</span><em>×${comboMult().toFixed(2)}</em>` : '';
    if (combo > lastCombo && combo >= 3) {
      big.classList.remove('bump');
      void big.offsetWidth;
      big.classList.add('bump');
    }
    lastCombo = combo;
  }

  const wait = Math.max(0, ev.hintReadyAt - performance.now()) / 1000;
  $('hintBtn').disabled = wait > 0 || li === undefined;
  $('hintText').textContent = wait > 0 ? `あと ${Math.ceil(wait)} 秒` : li === undefined ? '—' : `「${keyLabel(currentTarget(li))}」を教える`;

  $('odds').textContent = `KEYS ${S.keyboard.length}　·　1/${(1 / pHit()).toFixed(1)}`;
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
    return `<span class="kc${c === t ? ' target' : ''}${isNew ? ' new' : ''}${c === ' ' ? ' space' : ''}">${esc(keyLabel(c))}</span>`;
  }).join('');
}

function renderStream() {
  $('stream').innerHTML = stream.items.map(it => `<span class="${it.hit ? 'hit' : ''}">${esc(it.c === ' ' ? '·' : it.c)}</span>`).join('');
}

function renderRoom() {
  const sig = S.roster.map(r => r.name + stageOf(r).lv + r.lv + isAsleep(r)).join(',') + '|' + GENERATORS.map(g => S.gens[g.id] || 0).join(',');
  if (sig === roomSig && !dirty.room) return;
  roomSig = sig;
  dirty.room = false;
  const room = $('room');
  if (!S.roster.length) {
    room.innerHTML = `<div class="room-empty">${headSvg('kozaru', 'room-empty-art')}<p>まだ誰もいない。<br>「こんにちは」を完成させると、最初の猿がやってくる。</p></div>`;
    return;
  }
  const named = S.roster.map((r, i) => {
    const st = stageOf(r);
    const asleep = isAsleep(r);
    return `<div class="desk-slot${asleep ? ' asleep' : ''}" style="--d:${((i * 37) % 50) / 100}s">
      <div class="bubbles"></div>
      ${asleep ? '<div class="zzz"><i>z</i><i>z</i><i>Z</i></div>' : ''}
      ${typistSvg(st.head)}
      <div class="tag">${esc(r.name)}<small>Lv${r.lv}</small></div>
    </div>`;
  }).join('');
  const extras = GENERATORS.map(g => {
    const n = S.gens[g.id] || 0;
    return n ? `<div class="extra">${art(g.art, 'extra-art')}<span>${esc(g.name)}</span><b>${fmt(n)}</b></div>` : '';
  }).join('');
  room.innerHTML = `<div class="room-title"><span>THE WORKSHOP</span><span>猿の仕事部屋</span></div><div class="room-floor">${named}</div><div class="room-extras">${extras}</div>`;
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
  el.textContent = keyLabel(c);
  el.style.setProperty('--x', (Math.random() * 40 - 20) + 'px');
  host.appendChild(el);
  bubbleCount++;
  setTimeout(() => { el.remove(); bubbleCount--; }, 900);
}

function itemHtml({ id, iconHtml, name, sub, cost, owned, action, disabled }) {
  return `<button class="item" data-action="${action}" data-id="${id}" ${disabled ? 'disabled' : ''}>
    <span class="item-icon">${iconHtml}</span>
    <span class="item-main"><span class="item-name">${esc(name)}</span><span class="item-sub">${sub}</span></span>
    <span class="item-side">${owned !== undefined ? `<span class="item-owned">${owned}</span>` : ''}<span class="item-cost" data-cost="${cost}">${icon('keyboard', 'cost-ico')}${fmt(cost)}</span></span>
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

function lockedHtml(text, artHtml) {
  return `<div class="locked">${artHtml || icon('lock', 'locked-ico')}<p>${text}</p></div>`;
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
      mh = lockedHtml('まずは自分の手で「こんにちは」を打ち上げよう。<br>完成すると最初の猿が仲間になり、自動で打鍵してくれる。', headSvg('kozaru', 'locked-art'));
    } else {
      if (tiers.length) {
        mh += '<h3>特訓</h3>' + tiers.map(({ g, t, ti }) => itemHtml({
          id: g.id + ':' + ti, iconHtml: art(g.art), name: `${g.name}の${t.name}`, sub: `${g.name}の生産 ×2`,
          cost: g.cost * costMul() * t.costMul, action: 'tier',
        })).join('');
      }
      mh += '<h3>猿を雇う</h3>' + gens.map(g => {
        const each = g.kps * genMult(g) * achMult();
        return itemHtml({
          id: g.id, iconHtml: art(g.art), name: g.name, sub: `${esc(g.desc)}<br>1体 毎秒 ${fmtRate(each)} 打鍵`,
          cost: genCost(g), owned: S.gens[g.id] || 0, action: 'gen',
        });
      }).join('');
      if (GENERATORS[gens.length]) mh += '<div class="locked small">？？？ — もっと打鍵を貯めると……</div>';
    }
    $('panelMonkeys').innerHTML = mh;

    let rh = '';
    if (ups.length) {
      rh += '<h3>道具</h3>' + ups.map(u => itemHtml({ id: u.id, iconHtml: icon(u.icon), name: u.name, sub: u.desc, cost: u.cost * costMul(), action: 'up' })).join('');
    }
    if (res.length) {
      rh += '<h3>研究</h3>' + res.map(r => {
        const maxed = S.lv[r.id] >= r.max;
        return itemHtml({
          id: r.id, iconHtml: icon(r.icon), name: `${r.name} Lv${S.lv[r.id]}${maxed ? '（最大）' : ''}`,
          sub: maxed ? '研究しつくした' : r.desc(S.lv[r.id]), cost: maxed ? Infinity : researchCost(r), action: 'res', disabled: maxed,
        });
      }).join('');
    }
    const owned = UPGRADES.filter(u => S.ups[u.id]);
    if (owned.length) rh += `<h3>導入済み</h3><p class="muted small">${owned.map(u => u.name).join('・')}</p>`;
    if (!rh) rh = lockedHtml('まだ研究できるものはない。');
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
      ${icon(S.ach[a.id] ? 'trophy' : 'lock', 'ach-ico')}<span class="ach-name">${S.ach[a.id] ? esc(a.name) : '？？？'}</span><span class="ach-desc">${esc(a.desc)}</span></div>`).join('')}</div>
    <h3>偶然の単語</h3>
    <p class="muted small">打鍵記録に偶然あらわれた単語。見つけるたびにボーナス。</p>
    <div class="words">${ALL_WORDS.map(w => S.words[w] ? `<span class="word got">${esc(w)}<small>×${S.words[w]}</small></span>` : `<span class="word">${'・'.repeat(w.length)}</span>`).join('')}</div>`;
}

function renderBooks() {
  if (!dirty.books) return;
  dirty.books = false;
  let html = '<h3>名作</h3>';
  html += S.books.length ? '<div class="shelf">' + S.books.map((b, i) => {
    const m = ALL_MISSIONS.find(x => x.id === b.id);
    return `<button class="book" data-book="${i}" style="--hue:${(i * 47) % 360}"><span>${esc(m.display.split('\n')[0])}</span></button>`;
  }).join('') + '</div><p class="muted small">背表紙を押すと、もう一度上映される。</p>' : lockedHtml('まだ完成した作品はない。', icon('library', 'locked-ico'));
  html += `<h3>迷作　${S.meisaku.length} / ${MEISAKU_MAX}</h3>`;
  html += S.meisaku.length ? '<ul class="meisaku">' + S.meisaku.slice().reverse().map(x =>
    `<li><span class="mz">${esc(x.text)}</span><span class="mz-meta">${x.by ? esc(x.by) + ' 作 ・ ' : ''}正しくは「${esc(x.original)}」</span></li>`).join('') + '</ul>'
    : '<p class="muted small">完成直前に最後の1文字を打ち間違えると、迷作が生まれることがある。</p>';
  $('panelBooks').innerHTML = html;
}

function renderRoster() {
  const sig = S.roster.map(r => r.name + r.lv).join(',') + '|' + totalMonkeys(S);
  if (sig === rosterSig && !dirty.roster) {
    document.querySelectorAll('.roster .xp-fill').forEach((el, i) => {
      const r = S.roster[i];
      if (r) el.style.width = (100 * r.xp / xpNeed(r.lv)) + '%';
    });
    document.querySelectorAll('.feed').forEach(b => { b.disabled = S.keys < parseFloat(b.dataset.cost); });
    return;
  }
  rosterSig = sig;
  dirty.roster = false;
  if (!S.roster.length) {
    $('panelRoster').innerHTML = lockedHtml('まだ猿はいない。', headSvg('kozaru', 'locked-art'));
    return;
  }
  const others = (S.gens.kozaru || 0) + (S.gens.chimp || 0) + (S.gens.gorilla || 0) - S.roster.length;
  $('panelRoster').innerHTML = '<p class="muted small">名前つきの猿は時間とともに成長し、Lv10・20・35で進化する。バナナをあげると即レベルアップ。</p><ul class="roster">' + S.roster.map((r, i) => {
    const st = stageOf(r);
    const cost = feedCost(r);
    return `<li>
      <span class="r-art">${headSvg(st.head)}</span>
      <div class="r-main">
        <div><span class="r-name">${esc(r.name)}</span> <span class="r-meta">${esc(st.title)}　Lv${r.lv}</span></div>
        <div class="r-trait"><b>${esc(TRAITS[r.trait].name)}</b>　${esc(TRAITS[r.trait].desc)}</div>
        <div class="xp"><div class="xp-fill" style="width:${100 * r.xp / xpNeed(r.lv)}%"></div></div>
      </div>
      <button class="btn feed" data-feed="${i}" data-cost="${cost}" ${S.keys < cost ? 'disabled' : ''}>${icon('banana', 'btn-ico')}${fmt(cost)}</button>
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
  flushFx();
  const tab = document.querySelector('.tab.active').dataset.tab;
  if (tab === 'ach') renderAch();
  if (tab === 'books') renderBooks();
  if (tab === 'roster') renderRoster();
}

// ───────── UI 部品 ─────────

function log(text, ico) {
  const li = document.createElement('li');
  li.innerHTML = `${icon(ico || 'sparkle', 'log-ico')}<span>${esc(text)}</span>`;
  const ul = $('log');
  ul.prepend(li);
  while (ul.children.length > 40) ul.lastChild.remove();
}

function toast(text, ico) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(ico || 'sparkle', 'toast-ico')}<span>${esc(text)}</span>`;
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

// モーダルとシネマティックを1つの列で順番に見せる
const overlayQueue = [];
let overlayOpen = false;
let modalDone = null;

function queueOverlay(show, front) {
  if (front) overlayQueue.unshift(show); else overlayQueue.push(show);
  if (!overlayOpen) nextOverlay();
}

function nextOverlay() {
  const show = overlayQueue.shift();
  if (!show) {
    overlayOpen = false;
    return;
  }
  overlayOpen = true;
  show(nextOverlay);
}

function queueModal(html, front) {
  queueOverlay(done => {
    $('modalBody').innerHTML = html;
    $('modal').hidden = false;
    modalDone = done;
  }, front);
}

function closeModal() {
  $('modal').hidden = true;
  const d = modalDone;
  modalDone = null;
  if (d) d();
}

function chapterOfMission(id) {
  return Math.max(0, CHAPTERS.findIndex(c => c.missions.some(x => x.id === id)));
}

function queueCine(m, no, added, ci) {
  const c = CHAPTERS[ci === undefined ? chapterOfMission(m.id) : ci];
  const keysHtml = added && added.length
    ? `<div class="newkeys"><span class="kicker">NEW KEYS</span>${added.map(c => `<span class="kc new">${esc(c)}</span>`).join('')}</div>` : '';
  queueOverlay(done => FX.cinematic({
    kicker: `CHAPTER ${c.roman}　·　第 ${no} 作`,
    horizontal: !c.vertical,
    display: m.display,
    source: m.source,
    reward: m.reward,
    keysHtml,
  }, done));
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
  flushFx();
}

function fillIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}

function bindUI() {
  fillIcons();
  $('logoMark').innerHTML = headSvg('bungo');
  $('golden').innerHTML = icon('banana');

  $('typeKey').addEventListener('click', doClick);
  $('travelBox').addEventListener('click', e => { if (e.target.closest('#travelBtn')) travel(); });
  $('hintBtn').addEventListener('click', () => { Sound.ensure(); useHint(); render(); });
  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    if (overlayOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (!$('cine').hidden) FX.cineSkip(); else closeModal();
      }
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
    if (book) {
      const b = S.books[+book.dataset.book];
      const ci = chapterOfMission(b.id);
      queueCine(ALL_MISSIONS.find(x => x.id === b.id), CHAPTERS[ci].missions.findIndex(x => x.id === b.id) + 1, [], ci);
    }
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
  $('modalOk').addEventListener('click', closeModal);

  $('muteBtn').addEventListener('click', () => {
    S.muted = Sound.muted = !S.muted;
    updateMuteBtn();
  });

  $('exportBtn').addEventListener('click', () => {
    save();
    $('saveText').value = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
    $('saveText').select();
    toast('セーブ文字列を書き出しました', 'check');
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
      toast('セーブを読み込みました', 'check');
      updateMuteBtn();
      render();
    } catch (e) {
      toast('読み込みに失敗しました', 'x');
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('本当に最初からやり直しますか？ すべての進行が消えます。')) return;
    S = newState();
    save();
    location.reload();
  });

  addEventListener('resize', layoutManuscript);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('beforeunload', save);
}

function updateMuteBtn() {
  $('muteBtn').innerHTML = icon(S.muted ? 'volume-x' : 'volume-2');
}

// ───────── 起動 ─────────

function init() {
  load();
  bindUI();
  FX.init();
  updateMuteBtn();
  applyOffline();
  if (S.totalKeys === 0) {
    log('無限の猿がタイプライターを叩けば、いつかシェイクスピアを書き上げる——らしい。', 'infinity');
    log('まずは自分の手で打ってみよう。', 'pointer');
  }
  render();
  layoutManuscript();
  fxEnabled = true;
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
