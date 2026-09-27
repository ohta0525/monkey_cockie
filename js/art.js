// 猿とタイプライターの線画（Lucide と同じ線画スタイルで自作）
'use strict';

const MONKEY_HEADS = {
  // 子猿：丸い頭と大きな耳
  kozaru: `
    <circle cx="15" cy="27" r="6"/><circle cx="15" cy="27" r="2.5" class="fill-soft"/>
    <circle cx="49" cy="27" r="6"/><circle cx="49" cy="27" r="2.5" class="fill-soft"/>
    <circle cx="32" cy="26" r="14"/>
    <path d="M24.5 22.5c2.2-3 5-3.2 7.5-1.2 2.5-2 5.3-1.8 7.5 1.2 2.2 3 1.6 7.3-.6 10.3-3.8 5-10 5-13.8 0-2.2-3-2.8-7.3-.6-10.3z"/>
    <circle cx="28.5" cy="25.5" r="1.3" class="fill"/><circle cx="35.5" cy="25.5" r="1.3" class="fill"/>
    <path d="M30 31.5c1.3 1 2.7 1 4 0"/>
    <path d="M29 12.5c1.5-2.5 4.5-2.5 6 0"/>`,
  // チンパンジー：眉の張り出しと大きな耳
  chimp: `
    <path d="M17.5 21a7 7 0 1 0 0 12"/><path d="M46.5 21a7 7 0 1 1 0 12"/>
    <path d="M18 26c0-9 6.3-15 14-15s14 6 14 15c0 9-6.3 15-14 15s-14-6-14-15z"/>
    <path d="M23 22.5c3-2.5 6-2.8 9-1 3-1.8 6-1.5 9 1"/>
    <path d="M24 27c0 6 3.6 10 8 10s8-4 8-10"/>
    <circle cx="28.5" cy="25.8" r="1.3" class="fill"/><circle cx="35.5" cy="25.8" r="1.3" class="fill"/>
    <path d="M29.5 30.5h1M33.5 30.5h1"/><path d="M28.5 33.8c2.3 1.4 4.7 1.4 7 0"/>`,
  // ゴリラ：頭頂のとさかと重い眉
  gorilla: `
    <path d="M16 30c0-12 7-20 16-22 9 2 16 10 16 22 0 8-7 12-16 12s-16-4-16-12z"/>
    <path d="M20 23.5h24"/><path d="M22 23.5c1-3 4-4 10-4s9 1 10 4"/>
    <circle cx="27.5" cy="27" r="1.3" class="fill"/><circle cx="36.5" cy="27" r="1.3" class="fill"/>
    <path d="M23 33c1-3.5 4.5-5 9-5s8 1.5 9 5c-1 4-4.5 6-9 6s-8-2-9-6z"/>
    <path d="M29.5 31.2c.6.6 1.4.6 2 0M32.5 31.2c.6.6 1.4.6 2 0"/><path d="M28.5 35.5h7"/>
    <path d="M16.5 27.5c-2 0-3.5 1.2-3.5 3s1.5 3 3.5 3"/><path d="M47.5 27.5c2 0 3.5 1.2 3.5 3s-1.5 3-3.5 3"/>`,
  // 文豪猿：丸眼鏡と羽根ペン
  bungo: `
    <circle cx="15" cy="27" r="6"/><circle cx="49" cy="27" r="6"/>
    <circle cx="32" cy="26" r="14"/>
    <path d="M24.5 22.5c2.2-3 5-3.2 7.5-1.2 2.5-2 5.3-1.8 7.5 1.2 2.2 3 1.6 7.3-.6 10.3-3.8 5-10 5-13.8 0-2.2-3-2.8-7.3-.6-10.3z"/>
    <circle cx="28" cy="25.5" r="3.6"/><circle cx="36" cy="25.5" r="3.6"/><path d="M31.6 25.3h.8"/>
    <circle cx="28" cy="25.5" r="1" class="fill"/><circle cx="36" cy="25.5" r="1" class="fill"/>
    <path d="M30 32c1.3.8 2.7.8 4 0"/>
    <path d="M50 21c3-7 7-10 11-11-1 4-4 8-11 11z"/><path d="M50 21l6-6"/>
    <path d="M20 14.5c3-4.5 7-6.5 12-6.5s9 2 12 6.5"/>`,
};

const STAGE_HEAD = ['kozaru', 'chimp', 'gorilla', 'bungo'];

// タイプライターに向かう猿（部屋用、64x64）
function typistSvg(head, cls) {
  return `<svg class="typist ${cls || ''}" viewBox="0 0 64 76" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g class="t-head">${MONKEY_HEADS[head]}</g>
    <path class="t-body" d="M22 40c-4 3-6 7-6 12M42 40c4 3 6 7 6 12"/>
    <path class="t-arm t-arm-l" d="M19 44c-3 4-3 8 1 12"/>
    <path class="t-arm t-arm-r" d="M45 44c3 4 3 8-1 12"/>
    <path class="t-paper" d="M24 52V44h16v8"/>
    <path class="t-line" d="M27 47h10M27 49.5h7"/>
    <rect x="8" y="52" width="48" height="16" rx="3"/>
    <path d="M6 55h52"/>
    <g class="t-keys"><circle cx="16" cy="61" r="1.4"/><circle cx="22" cy="61" r="1.4"/><circle cx="28" cy="61" r="1.4"/><circle cx="34" cy="61" r="1.4"/><circle cx="40" cy="61" r="1.4"/><circle cx="46" cy="61" r="1.4"/><circle cx="19" cy="65" r="1.2"/><circle cx="43" cy="65" r="1.2"/><path d="M25 65h14"/></g>
  </svg>`;
}

// 名簿などで使う頭だけのアイコン
function headSvg(head, cls) {
  return `<svg class="head ${cls || ''}" viewBox="6 6 52 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MONKEY_HEADS[head]}</svg>`;
}
