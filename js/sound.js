// WebAudio で生成する効果音（音声ファイル不要）
'use strict';

const Sound = {
  ctx: null,
  muted: false,
  lastClick: 0,

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  },

  // タイプライターの打鍵音（短いノイズ）
  click(force) {
    if (this.muted) return;
    const now = performance.now();
    if (!force && now - this.lastClick < 120) return;
    this.lastClick = now;
    const ctx = this.ensure();
    if (!ctx) return;
    const len = 0.035;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 1400;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = force ? 0.5 : 0.18;
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start();
  },

  tone(freq, start, dur, vol, type) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  // 文字確定のベル
  ding() {
    if (this.muted) return;
    this.tone(1760, 0, 0.5, 0.12);
    this.tone(2637, 0, 0.3, 0.04);
  },

  // ミッション完成のファンファーレ
  fanfare() {
    if (this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.12, 0.35, 0.14, 'triangle'));
    this.tone(1047, 0.5, 0.9, 0.12, 'triangle');
    this.tone(1319, 0.5, 0.9, 0.08, 'triangle');
  },

  word() {
    if (this.muted) return;
    [880, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.07, 0.25, 0.08, 'square'));
  },
};
