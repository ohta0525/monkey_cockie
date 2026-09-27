// 演出エンジン：文字の叩きつけ・衝撃波・火花・完成シーケンス
'use strict';

const FX = {
  canvas: null,
  ctx: null,
  parts: [],
  slamBusyUntil: 0,
  dpr: 1,

  init() {
    this.canvas = document.getElementById('fxCanvas');
    this.ctx = this.canvas.getContext('2d');
    const resize = () => {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = innerWidth * this.dpr;
      this.canvas.height = innerHeight * this.dpr;
    };
    resize();
    addEventListener('resize', resize);
    const loop = () => {
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  // ── パーティクル ──
  burst(x, y, opt) {
    const o = Object.assign({ n: 40, speed: 9, life: 0.9, size: 2.2, gravity: 0.18, colors: ['#f3d38a', '#d8a84a', '#fff4d6'], streak: true }, opt);
    if (this.parts.length > 900) return;
    for (let i = 0; i < o.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = o.speed * (0.25 + Math.random() * 0.9);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - o.speed * 0.15,
        life: o.life * (0.5 + Math.random() * 0.7), age: 0,
        size: o.size * (0.5 + Math.random()), g: o.gravity,
        color: o.colors[Math.floor(Math.random() * o.colors.length)], streak: o.streak,
      });
    }
  },

  draw() {
    const c = this.ctx;
    const d = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.parts.length) return;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.globalCompositeOperation = 'lighter';
    const dt = 1 / 60;
    this.parts = this.parts.filter(p => {
      p.age += dt;
      if (p.age > p.life) return false;
      p.vx *= 0.965;
      p.vy = p.vy * 0.965 + p.g;
      p.x += p.vx;
      p.y += p.vy;
      const k = 1 - p.age / p.life;
      c.globalAlpha = k;
      c.strokeStyle = c.fillStyle = p.color;
      if (p.streak) {
        c.lineWidth = p.size * k;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        c.stroke();
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.size * (0.4 + k), 0, Math.PI * 2);
        c.fill();
      }
      return true;
    });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  },

  // ── 画面効果 ──
  shockwave(x, y, cls) {
    const el = document.createElement('div');
    el.className = 'shockwave ' + (cls || '');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

  shake(el, cls) {
    if (!el) return;
    el.classList.remove('shake-s', 'shake-l');
    void el.offsetWidth;
    el.classList.add(cls || 'shake-s');
  },

  flash(el, cls) {
    const f = document.createElement('div');
    f.className = 'flash ' + (cls || '');
    el.appendChild(f);
    setTimeout(() => f.remove(), 500);
  },

  center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  },

  colorsFor(how) {
    if (how === 'insp') return ['#ffe08a', '#ffb347', '#fff6d8'];
    if (how === 'hint') return ['#a8e6cf', '#dff7ec', '#7cc6a8'];
    return ['#f3d38a', '#d8a84a', '#fff4d6', '#e8553f'];
  },

  // ── 1文字の確定演出 ──
  // 大きく叩きつけてから原稿の位置へ飛ばす。連続しているときは小さく弾ける演出にする。
  confirm(ch, how, combo, findTarget) {
    const now = performance.now();
    const stage = document.getElementById('stage');
    if (!stage || document.hidden) return;
    if (now < this.slamBusyUntil) {
      requestAnimationFrame(() => this.pop(findTarget(), how));
      return;
    }
    this.slamBusyUntil = now + 640;

    const layer = document.getElementById('slamLayer');
    const size = Math.min(stage.clientHeight * 0.62, stage.clientWidth * 0.5);
    const label = how === 'insp' ? 'ひらめき' : how === 'hint' ? 'ヒント' : combo >= 3 ? `${combo} COMBO` : '';
    const el = document.createElement('div');
    el.className = `slam slam-${how}`;
    el.innerHTML = `<div class="slam-rays"></div><div class="slam-char" style="font-size:${size}px">${ch}</div>${label ? `<div class="slam-label">${label}</div>` : ''}`;
    layer.appendChild(el);
    Sound.whoosh();

    setTimeout(() => {
      const c = this.center(layer);
      Sound.boom(combo >= 10 ? 1 : 0.75);
      this.shake(stage, combo >= 10 ? 'shake-l' : 'shake-s');
      this.flash(stage, 'flash-' + how);
      this.shockwave(c.x, c.y, 'sw-' + how);
      this.burst(c.x, c.y, { n: 70, speed: 13, colors: this.colorsFor(how) });
      this.burst(c.x, c.y, { n: 24, speed: 5, size: 3.5, streak: false, gravity: 0.05, life: 1.4, colors: ['#ffffff', '#f3d38a'] });
    }, 140);

    setTimeout(() => {
      const glyph = el.querySelector('.slam-char');
      const target = findTarget();
      el.classList.add('leaving');
      if (!target || !glyph) return;
      const a = glyph.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      const s = Math.max(0.05, b.height / a.height);
      glyph.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      glyph.style.opacity = '0.3';
    }, 520);

    setTimeout(() => {
      el.remove();
      this.land(findTarget(), how);
    }, 820);
  },

  land(target, how) {
    if (!target) return;
    target.classList.remove('landed');
    void target.offsetWidth;
    target.classList.add('landed');
    const c = this.center(target);
    this.burst(c.x, c.y, { n: 18, speed: 5, colors: this.colorsFor(how) });
  },

  pop(target, how) {
    if (!target) return;
    target.classList.remove('popped');
    void target.offsetWidth;
    target.classList.add('popped');
    const c = this.center(target);
    this.burst(c.x, c.y, { n: 14, speed: 6, colors: this.colorsFor(how) });
    Sound.tick();
  },

  // ── 作品完成のシネマティック ──
  cinematic({ kicker, display, source, reward, keysHtml }, onDone) {
    const cine = document.getElementById('cine');
    const text = cine.querySelector('.cine-text');
    const seal = cine.querySelector('.cine-seal');
    cine.querySelector('.cine-kicker').textContent = kicker;
    cine.querySelector('.cine-source').textContent = source ? `— ${source}` : '';
    cine.querySelector('.cine-reward').textContent = reward || '';
    cine.querySelector('.cine-keys').innerHTML = keysHtml || '';
    const lines = display.split('\n');
    const longest = Math.max(...lines.map(l => l.length));
    const size = Math.min(innerHeight * 0.46 / longest, innerWidth * 0.62 / (lines.length * 1.4), 120);
    text.style.fontSize = size + 'px';
    text.innerHTML = lines.map(l => `<div class="cine-col">${[...l].map(c => `<span class="cc">${c}</span>`).join('')}</div>`).join('');
    cine.classList.remove('done', 'sealed');
    cine.hidden = false;
    void cine.offsetWidth;
    cine.classList.add('open');

    const chars = [...text.querySelectorAll('.cc')];
    const timers = [];
    let finished = false;
    const step = Math.max(70, Math.min(200, 2200 / chars.length));
    chars.forEach((span, i) => {
      timers.push(setTimeout(() => {
        span.classList.add('in');
        Sound.boom(0.35);
        const c = this.center(span);
        this.burst(c.x, c.y, { n: 12, speed: 5 });
      }, 650 + i * step));
    });
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      chars.forEach(s => s.classList.add('in'));
      cine.classList.add('sealed');
      Sound.stamp();
      const c = this.center(seal);
      this.shake(cine.querySelector('.cine-inner'), 'shake-l');
      this.shockwave(c.x, c.y, 'sw-seal');
      this.burst(c.x, c.y, { n: 90, speed: 14, colors: ['#ff7a5c', '#e8553f', '#f3d38a'] });
      setTimeout(() => cine.classList.add('done'), 450);
    };
    timers.push(setTimeout(finish, 650 + chars.length * step + 350));

    const btn = cine.querySelector('.cine-next');
    const skip = e => {
      if (e.target === btn) return;
      if (!finished) finish();
    };
    cine.addEventListener('click', skip);
    btn.onclick = () => {
      if (!finished) { finish(); return; }
      cine.removeEventListener('click', skip);
      cine.classList.remove('open');
      setTimeout(() => {
        cine.hidden = true;
        onDone && onDone();
      }, 350);
    };
    this.cineSkip = () => (finished ? btn.onclick() : finish());
  },
};
