// ゲームデータ定義（ミッション・猿・研究・実績など）
'use strict';

// 外れ用に追加されていくキーの順番
const DECOY_JP = 'あいうえおかけくそたてなぬねひへほまめやゆよらろれわをんせすしつぬむ' +
  'ぎぐげござぜぞだぢづどばぶべぱぴぷぺぽ';

// decoys: そのミッション開始時に追加される外れキーの数
const MISSIONS_JP = [
  { id: 'konnichiwa', title: 'はじめてのあいさつ', lines: ['こんにちは'], decoys: 3, display: 'こんにちは', source: '',
    reward: '最初の猿が仲間に！ 猿の雇用が解禁されました。' },
  { id: 'saru', title: '自己紹介', lines: ['さる'], decoys: 2, display: '猿', source: '',
    reward: '猿たちは自分が何者かを知った。' },
  { id: 'arigatou', title: '感謝の言葉', lines: ['ありがとう'], decoys: 3, display: 'ありがとう', source: '',
    reward: '「ひらめき」の研究が解禁。' },
  { id: 'nekoni', title: 'ことわざ その一', lines: ['ねこにこばん'], decoys: 4, display: '猫に小判', source: 'ことわざ',
    reward: '執筆チームの研究が解禁。複数行を別々の猿チームで同時に打てます。' },
  { id: 'kotowaza', title: 'ことわざ その二', lines: ['さるもきから', 'おちる'], decoys: 5, display: '猿も木から落ちる', source: 'ことわざ',
    reward: '猿も木から落ちる。でも猿は打ち続ける。' },
  { id: 'makura', title: '随筆の書き出し', lines: ['はるはあけぼの'], decoys: 5, display: '春はあけぼの', source: '清少納言『枕草子』',
    reward: '猿たちは季節を感じ始めた。' },
  { id: 'tsurezure', title: 'もうひとつの随筆', lines: ['つれづれなる', 'ままに'], decoys: 6, display: 'つれづれなるままに', source: '吉田兼好『徒然草』',
    reward: '猿たちは暇を持て余さなくなった。' },
  { id: 'haiku', title: '俳句', lines: ['ふるいけや', 'かわずとびこむ', 'みずのおと'], decoys: 6, display: '古池や\n蛙飛び込む\n水の音', source: '松尾芭蕉',
    reward: '猿の俳人が誕生した。' },
  { id: 'haiku2', title: 'もうひとつの俳句', lines: ['かきくえば', 'かねがなるなり', 'ほうりゅうじ'], decoys: 6, display: '柿食えば\n鐘が鳴るなり\n法隆寺', source: '正岡子規',
    reward: '猿たちは柿を食べたくなった。' },
  { id: 'heike', title: '軍記物語', lines: ['ぎおんしょうじゃの', 'かねのこえ', 'しょぎょうむじょうの', 'ひびきあり'], decoys: 8,
    display: '祇園精舎の\n鐘の声\n諸行無常の\n響きあり', source: '『平家物語』',
    reward: '猿たちは世の無常を知った。' },
  { id: 'tanka', title: '短歌', lines: ['たごのうらに', 'うちいでてみれば', 'しろたえの', 'ふじのたかねに', 'ゆきはふりつつ'], decoys: 12,
    display: '田子の浦に\nうち出でて見れば\n白妙の\n富士の高嶺に\n雪は降りつつ', source: '山部赤人（小倉百人一首 第4番）',
    reward: '日本編クリア！ 猿たちはイギリスへの渡航準備を始めた……', final: true },
];

// 偶然の単語
const WORDS_JP = ['さる', 'ねこ', 'いぬ', 'はな', 'うみ', 'やま', 'さくら', 'ばなな', 'ごりら', 'すいか', 'めだか', 'からす', 'きつね',
  'たぬき', 'うさぎ', 'こあら', 'とまと', 'みかん', 'りんご', 'ことば', 'しあわせ', 'うきうき'];

// ───────── 第二章 英国編 ─────────
// 本物のタイプライターと同じく、大文字・小文字・句読点・空白もすべてキー。
const DECOY_EN = "etaoinshrdlu TAOSWIBHMcmfwypvbgkjqxz,.'?!;:-CDEFGJKLNPQRUVXYZ";

const MISSIONS_EN = [
  { id: 'hello', title: 'はじめての英語', lines: ['Hello'], decoys: 3, display: 'Hello', source: '',
    reward: '猿たちはロンドンの言葉を覚え始めた。' },
  { id: 'monkey', title: '自己紹介', lines: ['Monkey'], decoys: 2, display: 'Monkey', source: '',
    reward: '猿たちは自分の英語名を知った。' },
  { id: 'tobe', title: 'あの一節の、はじまり', lines: ['To be'], decoys: 3, display: 'To be', source: '',
    reward: 'どこかで聞いたことのある響き……' },
  { id: 'name', title: '名前とは', lines: ["What's in a name?"], decoys: 3, display: "What's in a name?", source: 'Romeo and Juliet',
    reward: '猿たちは恋を知った。' },
  { id: 'stage', title: '世界は舞台', lines: ["All the world's", 'a stage'], decoys: 3, display: "All the world's\na stage", source: 'As You Like It',
    reward: '猿たちは自分が役者であることに気づいた。' },
  { id: 'brevity', title: '簡潔こそ', lines: ['Brevity is the soul', 'of wit'], decoys: 3, display: 'Brevity is the soul\nof wit', source: 'Hamlet',
    reward: '猿たちは短く打つことを覚えた。' },
  { id: 'sonnet', title: 'ソネット十八番', lines: ['Shall I compare thee', "to a summer's day?"], decoys: 4, display: "Shall I compare thee\nto a summer's day?", source: 'Sonnet 18',
    reward: '猿たちは夏の日を想った。' },
  { id: 'winter', title: '不満の冬', lines: ['Now is the winter', 'of our discontent'], decoys: 4, display: 'Now is the winter\nof our discontent', source: 'Richard III',
    reward: '猿たちの冬が、いま終わろうとしている。' },
  { id: 'dreams', title: '夢と同じもの', lines: ['We are such stuff', 'as dreams are made on'], decoys: 4, display: 'We are such stuff\nas dreams are made on', source: 'The Tempest',
    reward: '猿たちは、自分が夢でできていると知った。' },
  { id: 'question', title: 'それが問題だ', lines: ['To be, or not to be,', 'that is the question'], decoys: 8, display: 'To be, or not to be,\nthat is the question', source: 'Hamlet',
    reward: '猿たちはついに、あの問いに辿り着いた。' },
  { id: 'soliloquy', title: 'ハムレットの独白', lines: ["Whether 'tis nobler in the mind to suffer", 'The slings and arrows of outrageous fortune,', 'Or to take arms against a sea of troubles,', 'And by opposing end them.'], decoys: 26,
    display: "Whether 'tis nobler in the mind to suffer\nThe slings and arrows of outrageous fortune,\nOr to take arms against a sea of troubles,\nAnd by opposing end them.", source: 'Hamlet, Act III, Scene 1',
    reward: '英国編クリア！ 猿たちの噂は、ついにグローブ座まで届いた。', final: true },
];

// ───────── 終章 グローブ座 ─────────
// ハムレットの独白の続きから、最後の台詞まで。
const MISSIONS_FINAL = [
  { id: 'todie', title: '死ぬこと、眠ること', lines: ['To die: to sleep;', 'No more;'], decoys: 6,
    display: 'To die: to sleep;\nNo more;', source: 'Hamlet, Act III, Scene 1',
    reward: '猿たちは舞台の上で、独白の続きを打ち始めた。' },
  { id: 'heartache', title: '心の痛み', lines: ['and by a sleep to say we end', 'The heart-ache and the thousand natural shocks', 'That flesh is heir to,'], decoys: 8,
    display: 'and by a sleep to say we end\nThe heart-ache and the thousand natural shocks\nThat flesh is heir to,', source: 'Hamlet, Act III, Scene 1',
    reward: '観客席が、少しずつ埋まっていく。' },
  { id: 'consummation', title: '願ってもない結末', lines: ["'tis a consummation", "Devoutly to be wish'd.", 'To die, to sleep;'], decoys: 10,
    display: "'tis a consummation\nDevoutly to be wish'd.\nTo die, to sleep;", source: 'Hamlet, Act III, Scene 1',
    reward: '猿たちの指は、もう迷わない。' },
  { id: 'dream', title: '夢を見るかもしれない', lines: ["To sleep: perchance to dream: ay, there's the rub;", 'For in that sleep of death what dreams may come', 'When we have shuffled off this mortal coil,', "Must give us pause: there's the respect", 'That makes calamity of so long life;'], decoys: 99,
    display: "To sleep: perchance to dream: ay, there's the rub;\nFor in that sleep of death what dreams may come\nWhen we have shuffled off this mortal coil,\nMust give us pause: there's the respect\nThat makes calamity of so long life;", source: 'Hamlet, Act III, Scene 1',
    reward: '猿たちは、眠りの中で夢を見るだろうか。' },
  { id: 'whips', title: '時の鞭', lines: ['For who would bear the whips and scorns of time,', "The oppressor's wrong, the proud man's contumely,", "The pangs of despised love, the law's delay,", 'The insolence of office and the spurns', 'That patient merit of the unworthy takes,', 'When he himself might his quietus make', 'With a bare bodkin?'], decoys: 99,
    display: "For who would bear the whips and scorns of time,\nThe oppressor's wrong, the proud man's contumely,\nThe pangs of despised love, the law's delay,\nThe insolence of office and the spurns\nThat patient merit of the unworthy takes,\nWhen he himself might his quietus make\nWith a bare bodkin?", source: 'Hamlet, Act III, Scene 1',
    reward: '劇場は、息をひそめている。' },
  { id: 'country', title: '未知の国', lines: ['who would fardels bear,', 'To grunt and sweat under a weary life,', 'But that the dread of something after death,', "The undiscover'd country from whose bourn", 'No traveller returns, puzzles the will', 'And makes us rather bear those ills we have', 'Than fly to others that we know not of?'], decoys: 99,
    display: "who would fardels bear,\nTo grunt and sweat under a weary life,\nBut that the dread of something after death,\nThe undiscover'd country from whose bourn\nNo traveller returns, puzzles the will\nAnd makes us rather bear those ills we have\nThan fly to others that we know not of?", source: 'Hamlet, Act III, Scene 1',
    reward: '独白は、終わりに近づいている。' },
  { id: 'action', title: '行動という名', lines: ['Thus conscience does make cowards of us all;', 'And thus the native hue of resolution', "Is sicklied o'er with the pale cast of thought,", 'And enterprises of great pith and moment', 'With this regard their currents turn awry,', 'And lose the name of action.'], decoys: 99,
    display: "Thus conscience does make cowards of us all;\nAnd thus the native hue of resolution\nIs sicklied o'er with the pale cast of thought,\nAnd enterprises of great pith and moment\nWith this regard their currents turn awry,\nAnd lose the name of action.", source: 'Hamlet, Act III, Scene 1',
    reward: '独白は完成した。残る台詞は、あとひとつ。' },
  { id: 'silence', title: '最後の台詞', lines: ['The rest is silence.'], decoys: 99, display: 'The rest is silence.', source: 'Hamlet, Act V, Scene 2',
    reward: '無限の猿は、ついにシェイクスピアを書き上げた。', final: true },
];

const WORDS_EN = ['ape', 'cat', 'dog', 'sea', 'sun', 'art', 'tea', 'ham', 'love', 'king', 'bard', 'play', 'rose', 'moon', 'star', 'queen', 'hello', 'monkey'];

const CHAPTERS = [
  { id: 'jp', roman: 'I', name: '日本編', missions: MISSIONS_JP, decoys: DECOY_JP, words: WORDS_JP, vertical: true, costMul: 1 },
  // 章が進むと物価が少し上がる（名声ボーナスと釣り合わせる）
  { id: 'en', roman: 'II', name: '英国編', missions: MISSIONS_EN, decoys: DECOY_EN, words: WORDS_EN, vertical: false, costMul: 6,
    travel: { title: 'イギリスへ渡る', button: '出航する', seal: '航', motto: 'To be, or not to be.',
      arrive: '猿たちはロンドンに着いた。英字のタイプライターは、まだキーが少ない。' } },
  { id: 'globe', roman: 'III', name: '終章 グローブ座', missions: MISSIONS_FINAL, decoys: DECOY_EN, words: WORDS_EN, vertical: false, costMul: 20,
    travel: { title: 'グローブ座へ向かう', button: '幕を上げる', seal: '幕', motto: 'The play is the thing.',
      arrive: '猿たちはグローブ座の舞台に立った。最後の演目は『ハムレット』。' } },
];

// 現在の章のデータ（setChapter で切り替える）
let MISSIONS = MISSIONS_JP;
let DECOY_ORDER = DECOY_JP;
let WORDS = WORDS_JP;
const ALL_MISSIONS = CHAPTERS.flatMap(c => c.missions);
const ALL_WORDS = [...new Set(CHAPTERS.flatMap(c => c.words))];

function setChapter(i) {
  const c = CHAPTERS[i] || CHAPTERS[0];
  MISSIONS = c.missions;
  DECOY_ORDER = c.decoys;
  WORDS = c.words;
}

// 渡航で得る永続ボーナス：完成させた作品1つにつき +5%
function fameFor(booksCount) {
  return 1 + 0.05 * booksCount;
}

const GENERATORS = [
  { id: 'kozaru',     art: 'h:kozaru',      name: '子猿',               kps: 0.125,      cost: 15,    desc: 'キーボードを叩くのが大好き。' },
  { id: 'chimp',      art: 'h:chimp',       name: 'チンパンジー',       kps: 0.6,      cost: 110,    desc: '両手で叩ける。' },
  { id: 'gorilla',    art: 'h:gorilla',     name: 'ゴリラ',             kps: 3,     cost: 1200,   desc: 'キーが壊れるほどの打鍵力。' },
  { id: 'school',     art: 'school',        name: '猿のタイピング教室', kps: 16,    cost: 13000,  desc: '猿が猿に打鍵を教える。' },
  { id: 'factory',    art: 'factory',       name: 'タイプライター工場', kps: 85,    cost: 140000, desc: '何千台ものタイプライターが並ぶ。' },
  { id: 'planet',     art: 'orbit',         name: '猿の惑星',           kps: 450,   cost: 1.5e+06, desc: '惑星まるごと打鍵中。' },
  { id: 'quantum',    art: 'atom',          name: '量子猿',             kps: 2500,  cost: 2e+07, desc: 'あらゆるキーを同時に押している状態。' },
  { id: 'multiverse', art: 'infinity',      name: '並行宇宙の猿',       kps: 14000, cost: 3e+08,   desc: 'どこかの宇宙ではもう完成している。' },
];
const GEN_GROWTH = 1.15;
// 全体の物価（難易度調整用）。章ごとの costMul と掛け合わせる。
const BASE_COST = 3.5;

// 同じ猿を一定数そろえると買える「まとめて強化」
const GEN_TIERS = [
  { need: 10, costMul: 20,    name: '特訓' },
  { need: 25, costMul: 300,   name: '猛特訓' },
  { need: 50, costMul: 10000, name: '免許皆伝' },
];

const UPGRADES = [
  { id: 'hands',   icon: 'hand', name: '両手打ち',             desc: '1クリックで打てる数が2倍',             cost: 40,    clickMul: 2, cond: () => true },
  { id: 'finger',  icon: 'pointer', name: '指サック',             desc: '1クリックで打てる数が2倍',             cost: 600,   clickMul: 2, cond: s => s.chapter > 0 || s.missionIdx >= 1 },
  { id: 'mech',    icon: 'keyboard', name: 'メカニカルキーボード', desc: '1クリックで打てる数が2倍',             cost: 9000,  clickMul: 2, cond: s => s.chapter > 0 || s.missionIdx >= 3 },
  { id: 'banana1', icon: 'banana', name: 'バナナの差し入れ',     desc: 'クリック1回に、猿たちの毎秒打鍵の3%ぶんを上乗せ',  cost: 800,   clickPct: 0.03, cond: s => totalMonkeys(s) >= 3 },
  { id: 'banana2', icon: 'banana', name: 'バナナの房',           desc: 'クリック1回に、猿たちの毎秒打鍵の5%ぶんを上乗せ',  cost: 3e4,   clickPct: 0.05, cond: s => s.ups.banana1 },
  { id: 'banana3', icon: 'banana', name: 'バナナ農園',           desc: 'クリック1回に、猿たちの毎秒打鍵の8%ぶんを上乗せ',  cost: 2e6,   clickPct: 0.08, cond: s => s.ups.banana2 },
];

// 研究（強化タブ）。説明文は game.js の researchDesc() が「今 → 次」の数値つきで作る。
const RESEARCH = [
  { id: 'edu',  name: '当たりやすさ', icon: 'graduation-cap', max: 10, base: 120, growth: 5,
    cond: s => s.chapter > 0 || s.missionIdx >= 1 },
  { id: 'hint', name: 'ヒント短縮',   icon: 'notebook-pen',   max: 6,  base: 150, growth: 5,
    cond: s => s.chapter > 0 || s.missionIdx >= 1 },
  { id: 'away', name: '放置効率',     icon: 'moon',           max: 5,  base: 500, growth: 6,
    cond: s => s.chapter > 0 || s.missionIdx >= 2 },
  { id: 'team', name: '同時執筆',     icon: 'users',          max: 4,  base: 300, growth: 8,
    cond: s => s.chapter > 0 || s.missionIdx >= 4 },
  { id: 'insp', name: 'ひらめき',     icon: 'lightbulb',      max: 6,  base: 300, growth: 5,
    cond: s => s.chapter > 0 || s.missionIdx >= 6 },
];

// ひらめき：外れが「キー数 × この倍率」回続くと次の1文字が必ず当たる（序盤は控えめ）
function inspMaxAt(lv) { return Math.max(1.0, 2.5 - 0.25 * lv); }
const INSP_MIN = 20;
function hintCdAt(lv) { return Math.max(8, 30 - 4 * lv); }


// 名前つきの猿
const MONKEY_NAMES = ['ジョージ', 'モモ', 'サスケ', 'ハヌマン', 'ウィリアム', 'ココ', 'ボノ', 'キキ', 'タロウ', 'ハナコ',
  'ゴン', 'チャチャ', 'マロン', 'ポポ', 'ルル', 'シーザー', 'ケンタ', 'ミミ', 'バナ太', 'ウッキー', 'ソウセキ', 'バショウ',
  'イッサ', 'ブソン', 'セイ', 'シキ'];
const ROSTER_MAX = 16;

// 性格＝能力。数値は1匹あたり（レベルで強化される）
const TRAITS = {
  hayauchi:  { name: '早打ち',       desc: '全体の毎秒打鍵 +4%' },
  shijin:    { name: '詩人肌',       desc: '当たり重み +0.15' },
  nebou:     { name: '寝坊助',       desc: 'よく寝る。起きている間は毎秒打鍵 +10%' },
  banana:    { name: 'バナナ中毒',   desc: '金のバナナが出やすくなる +8%' },
  kichoumen: { name: '几帳面',       desc: 'ひらめきゲージ満タンまで -0.5回' },
  kimagure:  { name: '気まぐれ',     desc: '偶然の単語ボーナス +25%' },
  tetsugaku: { name: '哲学者',       desc: 'ヒントの待ち時間 -1.5秒' },
  medachi:   { name: '目立ちたがり', desc: 'コンボが途切れにくい +0.4秒' },
  shizuka:   { name: '物静か',       desc: '留守中の効率 +3%' },
  bungaku:   { name: '文学青年',     desc: 'クリックの打鍵数 +10%' },
};
const TRAIT_IDS = Object.keys(TRAITS);

// 名前つきの猿の進化
const EVOLUTION = [
  { lv: 1,  head: 'kozaru',  title: '子猿' },
  { lv: 10, head: 'chimp',   title: 'チンパンジー' },
  { lv: 20, head: 'gorilla', title: 'ゴリラ' },
  { lv: 35, head: 'bungo',   title: '文豪猿' },
];

const ACHIEVEMENTS = [
  ...[[100, '百打鍵'], [1e3, '千打鍵'], [1e4, '一万打鍵'], [1e5, '十万打鍵'], [1e6, '百万打鍵'], [1e8, '一億打鍵'], [1e10, '百億打鍵']]
    .map(([n, name]) => ({ id: 'keys' + n, name, desc: `通算 ${fmt(n)} 打鍵`, check: s => s.totalKeys >= n })),
  ...[[100, '連打の心得'], [1000, '腱鞘炎予備軍'], [5000, '人間タイプライター']]
    .map(([n, name]) => ({ id: 'click' + n, name, desc: `${fmt(n)} 回クリック`, check: s => s.clicks >= n })),
  ...[[1, '最初の同僚'], [10, '小さな群れ'], [50, '猿山'], [100, '猿の大行進'], [250, '猿の帝国']]
    .map(([n, name]) => ({ id: 'monkey' + n, name, desc: `猿と施設を合計 ${n} 所持`, check: s => totalMonkeys(s) >= n })),
  ...[[1, 'セレンディピティ'], [5, '偶然の語彙'], [10, '猿の国語辞典'], [WORDS_JP.length, '無限の語彙']]
    .map(([n, name]) => ({ id: 'word' + n, name, desc: `偶然の単語を ${n} 種類発見`, check: s => Object.keys(s.words).length >= n })),
  ...ALL_MISSIONS.map(m => ({ id: 'm_' + m.id, name: `『${m.display.split('\n')[0]}』`, desc: `ミッション「${m.title}」を完成`, check: s => s.books.some(b => b.id === m.id) })),
  { id: 'travel', name: '渡航', desc: 'イギリスへ渡る', check: s => s.chapter >= 1 },
  { id: 'globe', name: '開幕', desc: 'グローブ座の舞台に立つ', check: s => s.chapter >= 2 },
  { id: 'fin', name: 'The rest is silence.', desc: '全編を完結させる', check: s => s.finished },
  { id: 'wordEn', name: 'Serendipity', desc: '英語の偶然の単語を5種類発見', check: s => WORDS_EN.filter(w => s.words[w]).length >= 5 },
  ...[[10, 'ノリノリ'], [30, 'トランス状態'], [60, '猿神降臨']]
    .map(([n, name]) => ({ id: 'combo' + n, name, desc: `コンボ ${n} 達成`, check: s => s.bestCombo >= n })),
  ...[[1, '迷作誕生'], [10, '迷作全集']]
    .map(([n, name]) => ({ id: 'meisaku' + n, name, desc: `迷作を ${n} 作集める`, check: s => s.meisaku.length >= n })),
  { id: 'evolve', name: '進化論', desc: '名前つきの猿を進化させる', check: s => s.roster.some(r => r.lv >= 10) },
  { id: 'insp1', name: 'ひらめいた！', desc: 'ひらめきゲージで文字を確定', check: s => s.inspUses >= 1 },
  { id: 'hint10', name: '口出し上司', desc: 'ヒントを10回使う', check: s => s.hintUses >= 10 },
  { id: 'golden1', name: '金のバナナ', desc: '金のバナナを拾う', check: s => s.goldenClicks >= 1 },
  { id: 'golden10', name: 'バナナ長者', desc: '金のバナナを10回拾う', check: s => s.goldenClicks >= 10 },
  { id: 'team1', name: '分業制', desc: '執筆チームを1つ追加', check: s => s.lv.team >= 1 },
  { id: 'strike', name: '団体交渉', desc: 'ストライキをバナナで説得', check: s => s.strikesSettled >= 1 },
];
const ACH_BONUS = 0.03;

function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1e4) return Math.floor(n).toLocaleString('ja-JP');
  const units = ['万', '億', '兆', '京', '垓', '𥝱', '穣', '溝', '澗', '正', '載', '極'];
  let i = Math.floor(Math.log10(n) / 4) - 1;
  if (i >= units.length) i = units.length - 1;
  const v = n / Math.pow(10, 4 * (i + 1));
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + units[i];
}

function fmtRate(n) {
  return n < 10 ? n.toFixed(1) : fmt(n);
}

function totalMonkeys(s) {
  return Object.values(s.gens).reduce((a, b) => a + b, 0);
}
