// 無限の猿タイピスト — ゲーム本体
'use strict';

const SAVE_KEY = 'monkeyTypist.save.v1';
const TICK_MS = 100;
const INDIVIDUAL_LIMIT = 40; // これ以下の打鍵数なら1打鍵ずつ実際に抽選する
const STREAM_SAMPLES_PER_SEC = 12;

// ───────── 状態 ─────────

function freshLines(idx) {
  const m = MISSIONS[idx];
  return m ? m.lines.map(() => ({ chunk: 0, partial: 0 })) : [];
}

function newState() {
  const now = Date.now();
  return {
    v: 1, keys: 0, totalKeys: 0, clicks: 0,
    missionIdx: 0, lines: freshLines(0),
    gens: {}, ups: {}, tiers: {},
    lv: { edu: 0, dict: 0, team: 0, away: 0 },
    ach: {}, words: {}, books: [], roster: [],
    muted: false, dakuten: false,
    goldenClicks: 0, strikesSettled: 0,
    keyFrac: 0, clickFrac: 0,
    lastTime: now, startTime: now,
  };
}

let S = newState();

// セーブしない一時状態
const ev = { frenzyUntil: 0, clickFrenzyUntil: 0, strikeUntil: 0, nextGolden: 60, goldenUntil: 0, isStrikeGolden: false };
const stream = { items: [], buf: '' };
let poolCache = null;
let chunkCache = {};
let lastDing = 0;

// ───────── 文字と確率 ─────────

function chunksOf(idx) {
  if (chunkCache[idx]) return chunkCache[idx];
  const m = MISSIONS[idx];
  if (!m) return [];
  const res = m.lines.map(line => {
    const a = [];
    for (let i = 0; i < line.length; i += m.lock) a.push(line.slice(i, i + m.lock));
    return a;
  });
  chunkCache[idx] = res;
  return res;
}

// 抽選対象のキー（辞書で封印したキーを除く）
function getPool() {
  const key = `${S.missionIdx}|${S.dakuten}|${S.lv.dict}`;
  if (poolCache && poolCache.key === key) return poolCache;
  const all = [...KANA_BASE + (S.dakuten ? KANA_DAKUTEN : '')];
  const needed = new Set(MISSIONS.slice(S.missionIdx).flatMap(m => [...m.lines.join('')]));
  const unused = all.filter(c => !needed.has(c));
  const sealed = new Set(unused.slice(0, S.lv.dict * 4));
  const chars = all.filter(c => !sealed.has(c));
  poolCache = { key, chars, sealed: sealed.size, unusedLeft: unused.length - sealed.size };
  return poolCache;
}

function eduWeight() {
  return 1 + 0.5 * S.lv.edu;
}

// 1打鍵で狙いの文字が出る確率
function pHit() {
  const n = getPool().chars.length;
  const w = eduWeight();
  return w / (n - 1 + w);
}

function genChar(target) {
  const pool = getPool().chars;
  const n = pool.length;
  if (!target || n < 2) return pool[Math.floor(Math.random() * n)];
  const w = eduWeight();
  if (Math.random() * (n - 1 + w) < w) return target;
  let c;
  do { c = pool[Math.floor(Math.random() * n)]; } while (c === target);
  return c;
}

// 成功確率 q の試行で初めて成功するまでの回数
function geometric(q) {
  if (q >= 1) return 1;
  const u = Math.random();
  return Math.floor(Math.log(1 - u) / Math.log1p(-q)) + 1;
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

function baseKps() {
  return GENERATORS.reduce((sum, g) => sum + (S.gens[g.id] || 0) * g.kps * genMult(g), 0);
}

function kps() {
  const now = performance.now();
  let m = achMult();
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
  let p = mul * achMult() + kps() * pct;
  if (performance.now() < ev.clickFrenzyUntil) p *= 15;
  return p;
}

// ───────── 打鍵処理 ─────────

function currentMission() {
  return MISSIONS[S.missionIdx];
}

function lineDone(li) {
  const ch = chunksOf(S.missionIdx)[li];
  return !ch || S.lines[li].chunk >= ch.length;
}

// 執筆チームの数だけ、未完成の行を同時に打つ
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
  const line = S.lines[li];
  return chunksOf(S.missionIdx)[li][line.chunk][line.partial];
}

function typeOne(li, visual) {
  const line = S.lines[li];
  const chunk = chunksOf(S.missionIdx)[li][line.chunk];
  const target = chunk[line.partial];
  const c = genChar(target);
  let hit = false;
  if (c === target) {
    line.partial++;
    hit = true;
  } else if (c === chunk[0]) {
    line.partial = 1;
    hit = true;
  } else {
    line.partial = 0;
  }
  if (visual) pushStream(c, hit);
  if (line.partial >= chunk.length) confirmChunk(li);
}

// 大量の打鍵は幾何分布でまとめて判定する
function typeBulk(li, K) {
  const mi = S.missionIdx;
  const p = pHit();
  let guard = 0;
  while (K > 0 && guard++ < 10000 && S.missionIdx === mi && !lineDone(li)) {
    const line = S.lines[li];
    const chunk = chunksOf(mi)[li][line.chunk];
    const G = Math.max(chunk.length, geometric(Math.pow(p, chunk.length)));
    if (G > K) break;
    K -= G;
    line.partial = chunk.length;
    confirmChunk(li);
  }
}

function typeOnLine(li, K, visual) {
  const mi = S.missionIdx;
  if (K <= INDIVIDUAL_LIMIT) {
    for (let i = 0; i < K; i++) {
      if (S.missionIdx !== mi || lineDone(li)) break;
      typeOne(li, visual);
    }
    return true;
  }
  typeBulk(li, K);
  return false;
}

// 見た目用に打鍵ログへサンプルの文字を流す（進行には影響しない）
function sampleStream(n) {
  const li = activeLines()[0];
  for (let i = 0; i < n; i++) {
    const t = currentTarget(li);
    const c = genChar(t);
    pushStream(c, t !== null && c === t);
  }
}

function addKeystrokes(K, fromClick, visual, dt) {
  if (K <= 0) return;
  S.keys += K;
  S.totalKeys += K;
  const mi = S.missionIdx;
  const act = activeLines();
  if (act.length === 0) {
    if (visual) sampleStream(Math.min(K, fromClick ? 8 : Math.ceil(dt * STREAM_SAMPLES_PER_SEC)));
    return;
  }
  if (fromClick) {
    const individual = typeOnLine(act[0], K, visual);
    if (!individual && visual) sampleStream(8);
    return;
  }
  let shownIndividually = false;
  act.forEach((li, j) => {
    if (S.missionIdx !== mi) return;
    const ind = typeOnLine(li, K, visual && j === 0);
    if (j === 0) shownIndividually = ind;
  });
  if (visual && !shownIndividually && S.missionIdx === mi) {
    sampleStream(Math.ceil(dt * STREAM_SAMPLES_PER_SEC));
  }
  if (visual) Sound.click(false);
}

function confirmChunk(li) {
  const line = S.lines[li];
  line.chunk++;
  line.partial = 0;
  const now = performance.now();
  if (now - lastDing > 150) {
    Sound.ding();
    lastDing = now;
  }
  if (S.lines.every((_, i) => lineDone(i))) completeMission();
}

function completeMission() {
  const m = currentMission();
  S.books.push({ id: m.id, time: Date.now() });
  if (m.id === 'konnichiwa') {
    S.gens.kozaru = (S.gens.kozaru || 0) + 1;
    addRoster('kozaru');
    ev.nextGolden = 90;
  }
  if (m.id === 'saru') S.dakuten = true;
  S.missionIdx++;
  S.lines = freshLines(S.missionIdx);
  poolCache = null;
  Sound.fanfare();
  log(`📜 「${m.display.replace(/\n/g, ' ')}」が完成した！`);
  queueModal(missionModalHtml(m));
  dirty.shop = true;
}

// ───────── 打鍵ログと偶然の単語 ─────────

function pushStream(c, hit) {
  stream.items.push({ c, hit });
  if (stream.items.length > 48) stream.items.splice(0, stream.items.length - 48);
  stream.buf = (stream.buf + c).slice(-10);
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
  const bonus = first ? Math.max(50 * len, kps() * 15 * len) : Math.max(5 * len, kps() * 2);
  S.keys += bonus;
  S.totalKeys += bonus;
  const who = randomMonkeyName();
  const whoText = who ? `${who}が` : '';
  if (first) {
    Sound.word();
    log(`✨ ${whoText}偶然「${w}」と打った！（新発見 +${fmt(bonus)}）`);
    toast(`偶然の単語「${w}」を発見！ +${fmt(bonus)}`);
  } else {
    log(`${whoText}また「${w}」と打った（+${fmt(bonus)}）`);
  }
}

// ───────── 猿の名簿 ─────────

const NAMED_GENS = ['kozaru', 'chimp', 'gorilla'];

function addRoster(genId) {
  if (!NAMED_GENS.includes(genId) || S.roster.length >= ROSTER_MAX) return;
  const used = new Set(S.roster.map(r => r.name));
  const free = MONKEY_NAMES.filter(n => !used.has(n));
  if (!free.length) return;
  const name = free[Math.floor(Math.random() * free.length)];
  const trait = MONKEY_TRAITS[Math.floor(Math.random() * MONKEY_TRAITS.length)];
  S.roster.push({ name, trait, gen: genId, since: Date.now() });
  log(`🐵 新入り「${name}」（${trait}）が加わった。`);
}

function randomMonkeyName() {
  if (!S.roster.length) return null;
  return S.roster[Math.floor(Math.random() * S.roster.length)].name;
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
}

function buyTier(genId, ti) {
  const g = GENERATORS.find(x => x.id === genId);
  if (!spend(g.cost * GEN_TIERS[ti].costMul)) return;
  S.tiers[genId + '_' + ti] = true;
  log(`${g.icon} ${g.name}の${GEN_TIERS[ti].name}完了！ 生産 ×2`);
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
  poolCache = null;
  log(`📚 ${r.name}が Lv${S.lv[id]} になった。`);
}

// ───────── イベント（金のバナナ・ストライキ） ─────────

function updateEvents(dt) {
  if (S.missionIdx < 1) return;
  const now = performance.now();
  const golden = $('golden');
  if (!golden.hidden && now > ev.goldenUntil) golden.hidden = true;
  $('strikeBanner').hidden = now >= ev.strikeUntil;
  if (!golden.hidden) return;
  ev.nextGolden -= dt;
  if (ev.nextGolden > 0) return;
  ev.nextGolden = 90 + Math.random() * 150;
  if (S.missionIdx >= 3 && now >= ev.strikeUntil && Math.random() < 0.2) {
    ev.strikeUntil = now + 45000;
    log('✊ 猿たちがバナナの待遇改善を求めてストライキを始めた！');
    return;
  }
  golden.style.left = (10 + Math.random() * 75) + '%';
  golden.style.top = (15 + Math.random() * 65) + '%';
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
    const bonus = Math.max(50, kps() * 90);
    S.keys += bonus;
    S.totalKeys += bonus;
    log(`🍌 金のバナナ！ 猿たちの臨時ボーナス +${fmt(bonus)} 打鍵`);
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

// ───────── 実績 ─────────

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (S.ach[a.id] || !a.check(S)) return;
    S.ach[a.id] = Date.now();
    toast(`🏆 実績「${a.name}」 生産 +${ACH_BONUS * 100}%`);
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
}

// まとまった時間をまとめて進める（留守中・バックグラウンド）
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
  const base = newState();
  const s = Object.assign(base, data);
  s.lv = Object.assign(newState().lv, data.lv || {});
  const m = MISSIONS[s.missionIdx];
  if (!Array.isArray(s.lines) || (m && s.lines.length !== m.lines.length)) s.lines = freshLines(s.missionIdx);
  S = s;
  poolCache = null;
  Sound.muted = S.muted;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* 読み込めない環境 */ }
  if (!raw) return;
  try { loadFrom(JSON.parse(raw)); } catch (e) { console.warn('セーブデータを読み込めませんでした', e); }
}

function applyOffline() {
  const elapsed = (Date.now() - S.lastTime) / 1000;
  if (elapsed < 30 || baseKps() <= 0) return;
  const eff = Math.min(1, 0.5 + 0.1 * S.lv.away);
  const capH = 2 + 2 * S.lv.away;
  const secs = Math.min(elapsed, capH * 3600);
  const before = S.totalKeys;
  const beforeMission = S.missionIdx;
  simulate(secs, eff);
  const gained = S.totalKeys - before;
  const done = S.missionIdx - beforeMission;
  const capped = elapsed > secs ? `（上限 ${capH} 時間まで）` : '';
  queueModal(`<h2>おかえりなさい</h2>
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
const dirty = { shop: true, ach: true, books: true, roster: true };
let shopSig = '';
let paperSig = '';

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  const sig = S.missionIdx + '|' + S.lines.map(l => l.chunk + ',' + l.partial).join(';') + '|' + act.join(',');
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
    $('odds').innerHTML = '';
    return;
  }

  $('missionChapter').textContent = `第一章　日本編　— ミッション ${S.missionIdx + 1} / ${MISSIONS.length}`;
  $('missionTitle').textContent = m.title;
  $('missionSource').textContent = m.source ? `出典：${m.source}` : '';

  const chunks = chunksOf(S.missionIdx);
  const html = chunks.map((ch, li) => {
    const line = S.lines[li];
    const done = line.chunk >= ch.length;
    const active = act.includes(li);
    const mark = done ? '✓' : active ? '🐒' : '・';
    const body = ch.map((chunk, j) => {
      const cls = m.lock > 1 ? ' chunk' : '';
      if (j < line.chunk) return `<span class="done${cls}">${esc(chunk)}</span>`;
      if (j > line.chunk) return `<span class="todo${cls}">${esc(chunk)}</span>`;
      const chars = [...chunk].map((c, k) => {
        if (k < line.partial) return `<span class="partial">${esc(c)}</span>`;
        if (k === line.partial && active) return `<span class="cursor">${esc(c)}</span>`;
        return `<span class="todo-c">${esc(c)}</span>`;
      }).join('');
      return `<span class="current${cls}">${chars}</span>`;
    }).join('');
    return `<div class="pline${done ? ' is-done' : ''}${active ? ' is-active' : ''}"><span class="pmark">${mark}</span><span class="ptext">${body}</span></div>`;
  }).join('');
  $('paper').innerHTML = html;
  renderOdds();
}

function renderOdds() {
  const m = currentMission();
  if (!m) return;
  const pool = getPool();
  const n = pool.chars.length;
  const len = m.lines.join('').length;
  const exp = len * Math.log10(n);
  const p = pHit();
  const perChunk = 1 / Math.pow(p, m.lock);
  $('odds').innerHTML = `
    <span>完全ランダムで一発で打てる確率 <b>1 / 10<sup>${exp.toFixed(1)}</sup></b></span>
    <span>抽選キー <b>${n}</b>${pool.sealed ? `（封印 ${pool.sealed}）` : ''}</span>
    <span>${m.lock > 1 ? `${m.lock}文字の文節` : '次の1文字'}が揃うまで 約 <b>${fmt(perChunk)}</b> 打鍵</span>`;
}

function renderStream() {
  const html = stream.items.map(it => `<span class="${it.hit ? 'hit' : ''}">${esc(it.c)}</span>`).join('');
  $('stream').innerHTML = html;
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
    const prev = GENERATORS[i - 1];
    return S.gens[prev.id] > 0 || S.totalKeys >= g.cost * 0.4;
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
      mh = `<div class="locked">🔒 まずは自分の手で「こんにちは」を打ち上げよう。<br>完成すると最初の猿が仲間になり、自動で打鍵してくれます。</div>`;
    } else {
      if (tiers.length) {
        mh += '<h3>特訓</h3>' + tiers.map(({ g, t, ti }) => itemHtml({
          id: g.id + ':' + ti, icon: g.icon, name: `${g.name}の${t.name}`, sub: `${g.name}の生産 ×2`,
          cost: g.cost * t.costMul, action: 'tier',
        })).join('');
      }
      mh += '<h3>猿を雇う</h3>' + gens.map(g => {
        const each = g.kps * genMult(g) * achMult();
        return itemHtml({
          id: g.id, icon: g.icon, name: g.name, sub: `${esc(g.desc)}<br>1体 毎秒 ${fmtRate(each)} 打鍵`,
          cost: genCost(g), owned: S.gens[g.id] || 0, action: 'gen',
        });
      }).join('');
      const next = GENERATORS[gens.length];
      if (next) mh += `<div class="locked small">？？？ — もっと打鍵を貯めると……</div>`;
    }
    $('panelMonkeys').innerHTML = mh;

    let rh = '';
    if (ups.length) {
      rh += '<h3>道具</h3>' + ups.map(u => itemHtml({ id: u.id, icon: '🔧', name: u.name, sub: u.desc, cost: u.cost, action: 'up' })).join('');
    }
    if (res.length) {
      rh += '<h3>研究</h3>' + res.map(r => {
        const maxed = S.lv[r.id] >= r.max;
        return itemHtml({
          id: r.id, icon: '📚', name: `${r.name} Lv${S.lv[r.id]}${maxed ? '（最大）' : ''}`,
          sub: maxed ? '研究しつくした' : r.desc(S.lv[r.id]), cost: maxed ? Infinity : researchCost(r), action: 'res', disabled: maxed,
        });
      }).join('');
    }
    const owned = UPGRADES.filter(u => S.ups[u.id]);
    if (owned.length) rh += `<h3>導入済み</h3><p class="muted small">${owned.map(u => u.name).join('・')}</p>`;
    if (!rh) rh = '<div class="locked">まだ研究できるものはない。</div>';
    $('panelResearch').innerHTML = rh;
  }
  // 購入できるかどうかだけ毎回更新
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
      <span class="ach-icon">${S.ach[a.id] ? '🏆' : '？'}</span><span class="ach-name">${S.ach[a.id] ? esc(a.name) : '？？？'}</span><span class="ach-desc">${esc(a.desc)}</span></div>`).join('')}</div>
    <h3>偶然の単語</h3>
    <p class="muted small">猿の打鍵ログに偶然あらわれた単語。見つけるたびにボーナス。</p>
    <div class="words">${WORDS.map(w => S.words[w] ? `<span class="word got">${esc(w)}<small>×${S.words[w]}</small></span>` : `<span class="word">${'？'.repeat(w.length)}</span>`).join('')}</div>`;
}

function renderBooks() {
  if (!dirty.books) return;
  dirty.books = false;
  if (!S.books.length) {
    $('panelBooks').innerHTML = '<div class="locked">まだ完成した作品はない。</div>';
    return;
  }
  $('panelBooks').innerHTML = '<div class="shelf">' + S.books.map((b, i) => {
    const m = MISSIONS.find(x => x.id === b.id);
    return `<button class="book" data-book="${i}" style="--hue:${(i * 47) % 360}"><span>${esc(m.display.split('\n')[0])}</span></button>`;
  }).join('') + '</div><p class="muted small">背表紙をクリックすると読めます。</p>';
}

function renderRoster() {
  if (!dirty.roster) return;
  dirty.roster = false;
  if (!S.roster.length) {
    $('panelRoster').innerHTML = '<div class="locked">まだ猿はいない。</div>';
    return;
  }
  const others = totalMonkeys(S) - S.roster.length;
  $('panelRoster').innerHTML = '<ul class="roster">' + S.roster.map(r => {
    const g = GENERATORS.find(x => x.id === r.gen);
    return `<li><span class="r-icon">${g.icon}</span><span class="r-name">${esc(r.name)}</span><span class="r-meta">${esc(g.name)}・${esc(r.trait)}</span></li>`;
  }).join('') + '</ul>' + (others > 0 ? `<p class="muted small">ほか、名もなき打鍵者たち ${fmt(others)}。</p>` : '');
}

function render() {
  renderStats();
  renderPaper();
  renderStream();
  renderShop();
  const tab = document.querySelector('.tab.active').dataset.tab;
  if (tab === 'ach') renderAch();
  if (tab === 'books') renderBooks();
  if (tab === 'roster') renderRoster();
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

function missionModalHtml(m) {
  return `<div class="mission-clear">完成！</div>
    <div class="scroll">${esc(m.display).replace(/\n/g, '<br>')}</div>
    ${m.source ? `<div class="muted">— ${esc(m.source)}</div>` : ''}
    <p class="reward">${esc(m.reward)}</p>`;
}

function bookModalHtml(b) {
  const m = MISSIONS.find(x => x.id === b.id);
  const d = new Date(b.time);
  return `<div class="scroll">${esc(m.display).replace(/\n/g, '<br>')}</div>
    ${m.source ? `<div class="muted">— ${esc(m.source)}</div>` : ''}
    <p class="muted small">${d.toLocaleString('ja-JP')} 完成（ひらがなで「${esc(m.lines.join(' '))}」）</p>`;
}

function floatText(text) {
  const key = $('typeKey');
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.left = (40 + Math.random() * 20) + '%';
  key.parentElement.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function doClick() {
  Sound.ensure();
  S.clicks++;
  const cp = clickPower() + S.clickFrac;
  const K = Math.floor(cp);
  S.clickFrac = cp - K;
  addKeystrokes(K, true, true, 0);
  Sound.click(true);
  const key = $('typeKey');
  key.classList.remove('pressed');
  void key.offsetWidth;
  key.classList.add('pressed');
  floatText('+' + fmt(K));
  renderStats();
  renderPaper();
  renderStream();
}

function bindUI() {
  $('typeKey').addEventListener('click', doClick);
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
      Object.keys(dirty).forEach(k => { dirty[k] = true; });
      chunkCache = {};
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
    poolCache = null;
    paperSig = '';
    Object.keys(dirty).forEach(k => { dirty[k] = true; });
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
  setInterval(() => { dirty.roster = dirty.books = true; }, 2000);
}

init();
