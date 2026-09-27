// 無限の猿タイピスト — ティザー映像（約30秒）
// 1920x1080 の固定フレームを画面に合わせて拡大縮小し、音声クロックを基準に1本のタイムラインで演出する。
'use strict';

const W = 1920;
const H = 1080;
const DURATION = 31.2;
const $ = id => document.getElementById(id);
const KANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼ';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,.;!?';

// ───────── タイムシート（秒） ─────────
const T = {
  rainStart: 3.2, infinityCut: 6.9,
  monkey: 7.0, typing: 9.0,
  slams: [10.2, 10.85, 11.45, 12.0, 12.5], bell: 13.05,
  grid: [14.0, 14.6, 15.2, 15.8], cuts: [16.4, 16.9, 17.4, 17.9],
  haiku: 18.6, haikuChar0: 18.95, haikuStep: 0.19, seal: 21.4,
  latin: 23.0, words: [24.3, 24.95, 25.6], silence: 26.75,
  title: 27.0, titleChars: 27.35, soon: 29.6,
};

// ───────── 音（WebAudio で合成） ─────────
const A = {
  ctx: null,
  muted: false,

  init() {
    if (this.ctx) return;
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.comp).connect(c.destination);
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(3.4, 2.6);
    const vg = c.createGain();
    vg.gain.value = 0.55;
    this.verb.connect(vg).connect(this.master);
    const n = c.sampleRate * 2;
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },

  impulse(sec, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  },

  route(node, wet) {
    node.connect(this.master);
    if (wet) {
      const s = this.ctx.createGain();
      s.gain.value = wet;
      node.connect(s);
      s.connect(this.verb);
    }
  },

  env(t, a, peak, d) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  },

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t);
    s.stop(t + dur + 0.05);
    return s;
  },

  filter(type, f, q) {
    const f0 = this.ctx.createBiquadFilter();
    f0.type = type;
    f0.frequency.value = f;
    if (q) f0.Q.value = q;
    return f0;
  },

  // ドン
  boom(t, k = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    const g = this.env(t, 0.005, 0.9 * k, 0.8);
    o.connect(g);
    this.route(g, 0.25);
    o.start(t);
    o.stop(t + 0.9);
    const sub = c.createOscillator();
    sub.frequency.value = 44;
    const gs = this.env(t, 0.01, 0.45 * k, 1.3);
    sub.connect(gs);
    this.route(gs, 0);
    sub.start(t);
    sub.stop(t + 1.4);
    const n = this.noiseSrc(t, 0.4);
    const lp = this.filter('lowpass', 2600);
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    const gn = this.env(t, 0.003, 0.5 * k, 0.35);
    n.connect(lp).connect(gn);
    this.route(gn, 0.35);
  },

  crash(t, v = 0.22) {
    const n = this.noiseSrc(t, 2.4);
    const hp = this.filter('highpass', 4200);
    const g = this.env(t, 0.004, v, 2.2);
    n.connect(hp).connect(g);
    this.route(g, 0.6);
  },

  click(t, v = 0.2) {
    const n = this.noiseSrc(t, 0.05);
    const bp = this.filter('bandpass', 2000 + Math.random() * 1800, 1.6);
    const g = this.env(t, 0.001, v, 0.035);
    n.connect(bp).connect(g);
    this.route(g, 0.15);
  },

  whoosh(t, d = 0.5, v = 0.22) {
    const n = this.noiseSrc(t, d);
    const bp = this.filter('bandpass', 300, 0.9);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + d * 0.7);
    bp.frequency.exponentialRampToValueAtTime(900, t + d);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(bp).connect(g);
    this.route(g, 0.4);
  },

  kick(t, v = 0.7) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = this.env(t, 0.002, v, 0.28);
    o.connect(g);
    this.route(g, 0.05);
    o.start(t);
    o.stop(t + 0.35);
  },

  bell(t, v = 0.16) {
    const base = 1567.98;
    [[1, 2.6], [2.76, 1.3], [5.4, 0.6]].forEach(([m, d], i) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = base * m;
      const g = this.env(t, 0.004, v / (i + 1), d);
      o.connect(g);
      this.route(g, 0.7);
      o.start(t);
      o.stop(t + d + 0.1);
    });
  },

  pad(t, dur, notes, v = 0.05) {
    notes.forEach(f => {
      [-4, 4].forEach(det => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const lp = this.filter('lowpass', 1100);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + 0.8);
        g.gain.setValueAtTime(v, t + dur);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 3);
        o.connect(lp).connect(g);
        this.route(g, 0.7);
        o.start(t);
        o.stop(t + dur + 3.1);
      });
    });
  },

  // 低く唸り続け、少しずつ明るくなるドローン
  drone(t0, t1) {
    const c = this.ctx;
    const lp = this.filter('lowpass', 160, 3);
    lp.frequency.setValueAtTime(160, t0);
    lp.frequency.linearRampToValueAtTime(1500, t1 - 0.2);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoG = c.createGain();
    lfoG.gain.value = 60;
    lfo.connect(lfoG).connect(lp.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 2.5);
    g.gain.setValueAtTime(1, t1 - 0.03);
    g.gain.linearRampToValueAtTime(0, t1);
    lp.connect(g);
    this.route(g, 0.4);
    [55, 55.35, 82.41, 110.2].forEach(f => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = 0.06;
      o.connect(og).connect(lp);
      o.start(t0);
      o.stop(t1 + 0.1);
    });
    lfo.start(t0);
    lfo.stop(t1 + 0.1);
  },

  riser(t0, t1, v = 0.2) {
    const c = this.ctx;
    const d = t1 - t0;
    const n = this.noiseSrc(t0, d);
    const hp = this.filter('highpass', 300);
    hp.frequency.setValueAtTime(300, t0);
    hp.frequency.exponentialRampToValueAtTime(7000, t1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t1 - 0.02);
    g.gain.linearRampToValueAtTime(0, t1);
    n.connect(hp).connect(g);
    this.route(g, 0.3);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t0);
    o.frequency.exponentialRampToValueAtTime(720, t1);
    const lp = this.filter('lowpass', 500);
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.exponentialRampToValueAtTime(5000, t1);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(v * 0.4, t1 - 0.02);
    og.gain.linearRampToValueAtTime(0, t1);
    o.connect(lp).connect(og);
    this.route(og, 0.3);
    o.start(t0);
    o.stop(t1 + 0.05);
  },

  score(t0) {
    const at = x => t0 + x;
    // A: 静寂とタイプ音
    [0.35, 1.25, 2.2].forEach((x, i) => this.click(at(x), 0.32 - i * 0.05));
    this.pad(at(0.6), 2.2, [110, 164.81], 0.035);
    this.drone(at(3.1), at(T.silence));
    // B: 無数の打鍵が加速していく
    for (let x = T.rainStart; x < T.infinityCut - 0.05;) {
      this.click(at(x), 0.06 + Math.random() * 0.12);
      const p = (x - T.rainStart) / (T.infinityCut - T.rainStart);
      x += 0.2 * (1 - p) * (1 - p) + 0.012;
    }
    this.riser(at(5.0), at(T.infinityCut), 0.16);
    this.boom(at(T.infinityCut), 1.4);
    this.crash(at(T.infinityCut), 0.26);
    // C: 一匹の猿
    this.whoosh(at(7.1), 1.4, 0.1);
    this.pad(at(7.2), 2.6, [110, 164.81, 246.94], 0.03);
    for (let x = T.typing; x < 10.05; x += 0.11) this.click(at(x), 0.14);
    // D: こんにちは
    T.slams.forEach((s, i) => {
      this.whoosh(at(s - 0.16), 0.2, 0.1);
      this.boom(at(s), 0.95 + i * 0.06);
    });
    this.bell(at(T.bell));
    // E: 増殖するモンタージュ
    for (let x = 14.0; x < 16.35; x += 0.3) this.kick(at(x), 0.6);
    for (let x = 14.0; x < 16.35; x += 0.045) this.click(at(x), 0.03 + Math.random() * 0.05);
    T.grid.forEach(s => { this.boom(at(s), 0.6); this.whoosh(at(s - 0.25), 0.3, 0.12); });
    T.cuts.forEach(s => {
      this.whoosh(at(s - 0.22), 0.24, 0.16);
      this.boom(at(s), 1.1);
      this.kick(at(s + 0.25), 0.5);
    });
    this.crash(at(T.cuts[3]), 0.2);
    // F: 俳句
    this.pad(at(T.haiku), 3.4, [110, 130.81, 164.81, 196], 0.035);
    for (let i = 0; i < 11; i++) this.boom(at(T.haikuChar0 + i * T.haikuStep), 0.32);
    this.boom(at(T.seal), 1.3);
    this.crash(at(T.seal), 0.3);
    // G: 英語へ
    this.riser(at(T.latin), at(T.silence), 0.2);
    for (let x = T.latin; x < 24.2; x += 0.03) this.click(at(x), 0.03 + Math.random() * 0.06);
    T.words.forEach(s => { this.boom(at(s), 1.05); this.crash(at(s), 0.08); });
    // H: タイトル
    this.boom(at(T.title), 1.7);
    this.crash(at(T.title), 0.34);
    this.pad(at(T.title), 3.6, [110, 164.81, 220, 261.63, 329.63, 493.88], 0.045);
    for (let i = 0; i < 9; i++) this.click(at(T.titleChars + i * 0.07), 0.22);
    this.bell(at(T.soon), 0.14);
    this.boom(at(29.2), 0.4);
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  },
};

// ───────── フレームの拡大縮小 ─────────
let scale = 1;
function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  const f = $('frame');
  f.style.transform = `translate(-50%, -50%) scale(${scale})`;
  const res = Math.min(2, scale * (window.devicePixelRatio || 1));
  ['rain', 'fx'].forEach(id => {
    const c = $(id);
    c.width = Math.round(W * res);
    c.height = Math.round(H * res);
    c.getContext('2d').setTransform(res, 0, 0, res, 0, 0);
  });
  rainRes = res;
}

// ───────── パーティクル ─────────
let parts = [];
function burst(x, y, o) {
  o = Object.assign({ n: 60, speed: 16, life: 1, size: 3, g: 0.22, colors: ['#f3d38a', '#d8a84a', '#fff4d6'], streak: true }, o);
  for (let i = 0; i < o.n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = o.speed * (0.2 + Math.random() * 0.9);
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - o.speed * 0.12, age: 0,
      life: o.life * (0.5 + Math.random() * 0.7), size: o.size * (0.5 + Math.random()), g: o.g,
      color: o.colors[Math.floor(Math.random() * o.colors.length)], streak: o.streak,
    });
  }
}

function drawFx(dt) {
  const c = $('fx').getContext('2d');
  c.clearRect(0, 0, W, H);
  if (!parts.length) return;
  c.globalCompositeOperation = 'lighter';
  const k60 = dt * 60;
  parts = parts.filter(p => {
    p.age += dt;
    if (p.age > p.life) return false;
    const damp = Math.pow(0.965, k60);
    p.vx *= damp;
    p.vy = p.vy * damp + p.g * k60;
    p.x += p.vx * k60;
    p.y += p.vy * k60;
    const a = 1 - p.age / p.life;
    c.globalAlpha = a;
    c.strokeStyle = c.fillStyle = p.color;
    if (p.streak) {
      c.lineWidth = p.size * a;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(p.x, p.y, p.size * (0.4 + a), 0, Math.PI * 2);
      c.fill();
    }
    return true;
  });
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

// ───────── 文字の雨 ─────────
let rainRes = 1;
const rain = { cols: [], mode: 'off', latinMix: 0, intensity: 0, speed: 1 };
function resetRain() {
  rain.cols = [];
  const colW = 42;
  for (let x = colW / 2; x < W; x += colW) {
    rain.cols.push({ x, y: -Math.random() * H, v: 300 + Math.random() * 500, last: 0 });
  }
}

function drawRain(dt) {
  const c = $('rain').getContext('2d');
  const fade = rain.mode === 'off' ? 0.25 : 0.12;
  c.fillStyle = `rgba(4, 3, 3, ${Math.min(1, fade * dt * 60)})`;
  c.fillRect(0, 0, W, H);
  if (rain.mode === 'off' || rain.intensity <= 0) return;
  c.textAlign = 'center';
  rain.cols.forEach(col => {
    col.y += col.v * rain.speed * dt;
    if (col.y > H + 60) {
      col.y = -Math.random() * 300;
      col.v = 300 + Math.random() * 500;
    }
    const step = 40;
    if (col.y - col.last < step && col.last !== 0) return;
    col.last = col.y;
    const latin = Math.random() < rain.latinMix;
    const set = latin ? LATIN : KANA;
    const ch = set[Math.floor(Math.random() * set.length)];
    c.font = latin ? 'italic 600 36px "Cormorant Garamond", serif' : '34px "Yuji Syuku", serif';
    c.fillStyle = `rgba(255, 244, 214, ${0.9 * rain.intensity})`;
    c.shadowColor = 'rgba(216, 168, 74, 0.9)';
    c.shadowBlur = 14;
    c.fillText(ch, col.x, col.y);
    c.shadowBlur = 0;
    if (Math.random() < 0.5) {
      c.fillStyle = `rgba(216, 168, 74, ${0.55 * rain.intensity})`;
      c.fillText(set[Math.floor(Math.random() * set.length)], col.x, col.y - step);
    }
  });
}

// ───────── 画面効果 ─────────
function shake(big) {
  const cam = $('scenes');
  cam.classList.remove('shake-s', 'shake-l');
  void cam.offsetWidth;
  cam.classList.add(big ? 'shake-l' : 'shake-s');
}

function flash(strength, color) {
  const f = $('flash');
  f.style.transition = 'none';
  f.style.background = color || '#fff6e0';
  f.style.opacity = strength;
  void f.offsetWidth;
  f.style.transition = 'opacity 0.6s ease-out';
  f.style.opacity = 0;
}

function shockwave(x, y, cls) {
  const el = document.createElement('div');
  el.className = 'shockwave ' + (cls || '');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('scenes').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function impact(x, y, k, opt) {
  shake(k >= 1.1);
  flash(0.35 * k, opt && opt.flashColor);
  shockwave(x, y, opt && opt.sw);
  burst(x, y, Object.assign({ n: Math.round(80 * k), speed: 18 * k }, opt && opt.colors ? { colors: opt.colors } : {}));
  burst(x, y, { n: 26, speed: 6, size: 4, streak: false, g: 0.05, life: 1.6, colors: ['#ffffff', '#f3d38a'] });
}

// フレーム座標での要素の中心
function frameCenter(el) {
  const r = el.getBoundingClientRect();
  const f = $('frame').getBoundingClientRect();
  return { x: (r.left + r.width / 2 - f.left) / scale, y: (r.top + r.height / 2 - f.top) / scale, h: r.height / scale };
}

// 巨大な文字を叩きつけ、必要なら目標の位置へ飛ばす
function slam(ch, opt) {
  const o = Object.assign({ size: 620, x: W / 2, y: H / 2, hold: 0.42, font: 'brush', target: null, k: 1 }, opt);
  const el = document.createElement('div');
  el.className = `slam slam-${o.font}`;
  el.style.left = o.x + 'px';
  el.style.top = o.y + 'px';
  el.innerHTML = `<div class="rays"></div><div class="glyph" style="font-size:${o.size}px">${ch}</div>`;
  $('slamLayer').appendChild(el);
  setTimeout(() => impact(o.x, o.y, o.k), 120);
  setTimeout(() => {
    const g = el.querySelector('.glyph');
    el.classList.add('leaving');
    if (o.target) {
      const t = frameCenter(o.target);
      g.style.animation = 'none';
      void g.offsetWidth;
      g.style.transform = `translate(calc(-50% + ${t.x - o.x}px), calc(-50% + ${t.y - o.y}px)) scale(${t.h / (o.size * 1.05)})`;
      g.style.opacity = '0.4';
    } else {
      el.classList.add('gone');
    }
  }, o.hold * 1000);
  setTimeout(() => {
    el.remove();
    if (o.target) {
      o.target.classList.add('lit');
      const t = frameCenter(o.target);
      burst(t.x, t.y, { n: 22, speed: 7 });
    }
  }, o.hold * 1000 + 320);
}

// SVG の線を描き順に引いていく
function drawIn(svg, dur, stagger) {
  const shapes = svg.querySelectorAll('path, circle, rect, line, polyline, ellipse');
  shapes.forEach((s, i) => {
    s.setAttribute('pathLength', '1');
    s.style.strokeDasharray = '1';
    s.style.strokeDashoffset = '1';
    s.style.transition = `stroke-dashoffset ${dur}s cubic-bezier(.6,.05,.3,1) ${i * stagger}s`;
  });
  void svg.getBoundingClientRect();
  requestAnimationFrame(() => shapes.forEach(s => { s.style.strokeDashoffset = '0'; }));
}

function caption(jp, en, dur) {
  const c = $('caption');
  c.querySelector('.cap-jp').textContent = jp;
  c.querySelector('.cap-en').textContent = en;
  c.classList.remove('on');
  void c.offsetWidth;
  c.classList.add('on');
  clearTimeout(caption.timer);
  caption.timer = setTimeout(() => c.classList.remove('on'), dur * 1000);
}

const on = id => $(id).classList.add('on');
const off = id => $(id).classList.remove('on');
const cut = id => { const el = $(id); el.classList.add('cut'); el.classList.remove('on'); };

// ───────── シーンの組み立て ─────────
function buildScenes() {
  const center = { c: 6, r: 3 };
  let cells = '';
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 13; c++) {
      const ring = Math.max(Math.abs(c - center.c), Math.abs(r - center.r));
      const head = ring === 0 ? 'kozaru' : ring === 1 ? 'chimp' : ring === 2 ? 'gorilla' : STAGE_HEAD[(c * 7 + r * 3) % 4];
      cells += `<div class="cell" data-ring="${ring}" style="--d:${((c * 13 + r * 7) % 40) / 100}s; left:${c * 150}px; top:${r * 170}px">${typistSvg(head)}</div>`;
    }
  }
  const haikuCols = ['古池や', '蛙飛び込む', '水の音'].map(l => `<div class="hk-col">${[...l].map(ch => `<span class="hk">${ch}</span>`).join('')}</div>`).join('');
  const title = [...'無限の猿タイピスト'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');

  $('scenes').innerHTML = `
    <div class="scene" id="sA">
      <div class="a-en">IF AN INFINITE NUMBER OF MONKEYS</div>
      <div class="a-jp">無限の猿が、無限にタイプライターを叩けば——</div>
      <div class="cursor"></div>
    </div>
    <div class="scene" id="sB">
      <div class="counter"><span>KEYSTROKES</span><b id="cnt">1</b></div>
    </div>
    <div class="scene" id="sC">
      <div class="spot"></div>
      <div class="c-monkey" id="cMonkey">${typistSvg('kozaru')}</div>
    </div>
    <div class="scene" id="sD">
      <div class="d-kicker">CHAPTER I　·　第 一 作</div>
      <div class="d-slots">${[...'こんにちは'].map((ch, i) => `<span class="slot" id="slot${i}">${ch}</span>`).join('')}</div>
    </div>
    <div class="scene" id="sE">
      <div class="grid-wrap"><div class="grid" id="grid">${cells}</div></div>
      <div class="e-label" id="eLabel"><b></b><span></span></div>
      <div class="e-cut" id="eCut"><div class="e-icon"></div><b></b><span></span></div>
    </div>
    <div class="scene" id="sF">
      <div class="haiku"><div class="hk-cols">${haikuCols}</div><div class="seal">完</div><div class="f-src">松尾芭蕉</div></div>
    </div>
    <div class="scene" id="sG">
      <div class="g-line"><span class="w" id="w0">To be,</span><span class="w" id="w1">or not</span><span class="w" id="w2">to be.</span></div>
      <div class="g-attr">— WILLIAM SHAKESPEARE</div>
    </div>
    <div class="scene" id="sH">
      <div class="h-logo" id="hLogo">${headSvg('bungo')}</div>
      <div class="h-title" id="hTitle">${title}</div>
      <div class="h-en">INFINITE MONKEY TYPIST</div>
      <div class="h-tag">猿は、いつかシェイクスピアを書けるのか。</div>
      <div class="h-soon">COMING SOON<i></i></div>
    </div>
    <div id="slamLayer"></div>`;
}

// グリッドのカメラ：だんだん引いていき、猿が増えていく
const GRID_STEPS = [
  { scale: 4.2, ring: 0, jp: '一匹が。', en: 'ONE' },
  { scale: 2.1, ring: 1, jp: '十匹に。', en: 'TEN' },
  { scale: 1.2, ring: 2, jp: '百匹に。', en: 'A HUNDRED' },
  { scale: 0.86, ring: 9, jp: 'そして、無限に。', en: 'INFINITY' },
];
const CUTS = [
  { icon: 'factory', jp: '工場', en: 'FACTORIES' },
  { icon: 'orbit', jp: '惑星', en: 'PLANETS' },
  { icon: 'atom', jp: '量子', en: 'QUANTUM' },
  { icon: 'infinity', jp: '並行宇宙', en: 'MULTIVERSE' },
];

function gridStep(i) {
  const s = GRID_STEPS[i];
  $('grid').style.transform = `translate(-50%, -50%) scale(${s.scale})`;
  $('grid').querySelectorAll('.cell').forEach(c => {
    const ring = +c.dataset.ring;
    if (ring <= s.ring && !c.classList.contains('in')) {
      c.style.transitionDelay = (ring * 0.04 + Math.random() * 0.18) + 's';
      c.classList.add('in');
    }
  });
  const l = $('eLabel');
  l.querySelector('b').textContent = s.jp;
  l.querySelector('span').textContent = s.en;
  l.classList.remove('pop');
  void l.offsetWidth;
  l.classList.add('pop');
  flash(0.18);
}

function iconCut(i) {
  const c = CUTS[i];
  const el = $('eCut');
  el.querySelector('.e-icon').innerHTML = icon(c.icon);
  el.querySelector('b').textContent = c.jp;
  el.querySelector('span').textContent = c.en;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop', 'on');
  drawIn(el.querySelector('svg'), 0.35, 0.03);
  impact(W / 2, H / 2 - 60, 1.05);
}

// ───────── キュー（映像の出来事） ─────────
function cues() {
  const list = [
    [0.05, () => { $('frame').classList.add('bars'); on('sA'); }],
    [0.3, () => $('sA').classList.add('cur')],
    [0.8, () => $('sA').classList.add('t1')],
    [1.3, () => $('sA').classList.add('t2')],
    [2.7, () => $('sA').classList.add('fade')],
    [T.rainStart, () => {
      off('sA');
      on('sB');
      rain.mode = 'kana';
      rain.intensity = 0.25;
      $('rain').classList.add('zoomB');
    }],
    [T.infinityCut - 0.08, () => { $('cnt').textContent = '∞'; $('sB').classList.add('inf'); }],
    [T.infinityCut, () => {
      impact(W / 2, H / 2, 1.3);
      flash(0.9);
      rain.mode = 'off';
    }],
    [T.monkey, () => {
      cut('sB');
      $('rain').classList.remove('zoomB');
      $('rain').classList.add('nozoom');
      on('sC');
      drawIn($('cMonkey').querySelector('svg'), 1.3, 0.035);
    }],
    [7.9, () => caption('たった一匹の猿から、すべては始まった。', 'IT BEGAN WITH A SINGLE MONKEY.', 2.0)],
    [T.typing, () => $('cMonkey').classList.add('typing')],
    [T.slams[0] - 0.25, () => { $('sC').classList.add('dim'); on('sD'); }],
    ...T.slams.map((s, i) => [s - 0.12, () => slam('こんにちは'[i], { target: $('slot' + i), k: 0.9 + i * 0.06 })]),
    [T.bell, () => { $('sD').classList.add('glow'); flash(0.25); }],
    [13.2, () => caption('こんにちは、世界。', 'HELLO, WORLD.', 0.75)],
    [T.grid[0] - 0.05, () => { cut('sC'); cut('sD'); on('sE'); }],
    ...T.grid.map((s, i) => [s, () => gridStep(i)]),
    ...T.cuts.map((s, i) => [s - 0.02, () => {
      if (i === 0) { $('sE').classList.add('cuts'); }
      iconCut(i);
    }]),
    [T.haiku, () => { cut('sE'); on('sF'); $('frame').classList.add('tight'); }],
    ...Array.from({ length: 11 }, (_, i) => [T.haikuChar0 + i * T.haikuStep, () => {
      const el = $('sF').querySelectorAll('.hk')[i];
      el.classList.add('in');
      const c = frameCenter(el);
      burst(c.x, c.y, { n: 18, speed: 7 });
      shake(false);
    }]),
    [T.seal, () => {
      $('sF').classList.add('sealed');
      const c = frameCenter($('sF').querySelector('.seal'));
      impact(c.x, c.y, 1.25, { colors: ['#ff7a5c', '#e8553f', '#f3d38a'], sw: 'sw-red', flashColor: '#ffb49f' });
    }],
    [22.7, () => off('sF')],
    [T.latin, () => {
      $('frame').classList.remove('tight');
      rain.mode = 'kana';
      rain.intensity = 0.3;
      rain.latinMix = 0;
      $('rain').classList.remove('nozoom');
    }],
    [24.1, () => { rain.intensity = 0.12; on('sG'); }],
    ...T.words.map((s, i) => [s - 0.12, () => {
      const w = $('w' + i);
      slam(w.textContent, { font: 'serif', size: 300, hold: 0.36, target: w, k: 1 });
    }]),
    [26.0, () => $('sG').classList.add('attr')],
    [25.95, () => caption('その確率、限りなくゼロ。', 'THE ODDS: ALMOST ZERO.', 0.8)],
    [T.silence, () => { cut('sG'); rain.mode = 'off'; $('caption').classList.remove('on'); }],
    [T.title, () => {
      on('sH');
      flash(1);
      impact(W / 2, H / 2, 1.5);
      rain.mode = 'kana';
      rain.intensity = 0.1;
      rain.speed = 0.35;
      rain.latinMix = 0.5;
      drawIn($('hLogo').querySelector('svg'), 1.0, 0.04);
    }],
    [T.titleChars, () => $('sH').classList.add('go')],
    [28.25, () => $('sH').classList.add('en')],
    [28.5, () => $('sH').classList.add('shine')],
    [28.9, () => $('sH').classList.add('tag')],
    [T.soon, () => { $('sH').classList.add('soon'); flash(0.2); }],
    [30.4, () => $('frame').classList.add('fadeout')],
  ];
  return list.sort((a, b) => a[0] - b[0]);
}

// ───────── 再生 ─────────
let cueList = [];
let cueIdx = 0;
let t0 = 0;
let lastT = 0;
let running = false;

function clock() {
  return A.ctx ? A.ctx.currentTime - t0 : 0;
}

function frame() {
  const t = clock();
  const dt = Math.min(0.1, Math.max(0, t - lastT));
  lastT = t;
  while (cueIdx < cueList.length && cueList[cueIdx][0] <= t) cueList[cueIdx++][1]();

  if (t >= T.rainStart && t < T.infinityCut) {
    const p = (t - T.rainStart) / (T.infinityCut - T.rainStart);
    rain.intensity = 0.25 + 0.75 * p;
    rain.speed = 0.6 + 2.6 * p * p;
    const v = Math.pow(10, 0.2 + p * 12.2);
    $('cnt').textContent = Math.floor(v).toLocaleString('en-US');
  }
  if (t >= T.latin && t < 24.2) {
    const p = (t - T.latin) / 1.2;
    rain.latinMix = p;
    rain.speed = 1 + 2 * p;
    rain.intensity = 0.3 + 0.6 * p;
  }
  drawRain(dt);
  drawFx(dt);
  $('progressFill').style.width = Math.min(100, (t / DURATION) * 100) + '%';

  if (t < DURATION) {
    requestAnimationFrame(frame);
  } else {
    running = false;
    $('end').hidden = false;
    requestAnimationFrame(() => $('end').classList.add('show'));
  }
}

function start() {
  A.init();
  A.ctx.resume();
  buildScenes();
  resetRain();
  parts = [];
  ['rain', 'fx'].forEach(id => $(id).getContext('2d').clearRect(0, 0, W, H));
  $('frame').className = '';
  $('cam').className = '';
  $('rain').className = '';
  $('caption').classList.remove('on');
  $('flash').style.opacity = 0;
  $('end').hidden = true;
  $('end').classList.remove('show');
  cueList = cues();
  cueIdx = 0;
  t0 = A.ctx.currentTime + 0.2;
  lastT = 0;
  A.score(t0);
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

// ───────── 起動 ─────────
function init() {
  fit();
  addEventListener('resize', fit);
  $('playBtn').innerHTML = icon('play');
  $('replayBtn').innerHTML = `${icon('rotate-ccw')}<span>もう一度見る</span>`;
  $('gameLink').innerHTML = `${icon('gamepad-2')}<span>ゲームで遊ぶ</span>`;
  buildScenes();

  const fontsReady = Promise.race([
    Promise.all(['34px "Yuji Syuku"', '36px Cinzel', 'italic 600 36px "Cormorant Garamond"', '36px "Zen Old Mincho"'].map(f => document.fonts.load(f, 'あA'))),
    new Promise(r => setTimeout(r, 4000)),
  ]);
  fontsReady.then(() => {
    $('start').classList.add('ready');
    $('loadNote').textContent = '音が出ます　·　約30秒　·　F で全画面';
  });

  $('playBtn').addEventListener('click', () => {
    $('start').classList.add('gone');
    setTimeout(() => { $('start').hidden = true; }, 600);
    start();
  });
  $('replayBtn').addEventListener('click', start);
  addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    }
    if (e.key === 'm' || e.key === 'M') A.setMuted(!A.muted);
    if ((e.key === ' ' || e.key === 'Enter') && !$('start').hidden) {
      e.preventDefault();
      $('playBtn').click();
    }
  });
}

init();
