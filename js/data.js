// ゲームデータ定義（ミッション・猿・研究・実績など）
'use strict';

const KANA_BASE = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KANA_DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';

// lock: 何文字連続で当てたら確定するか（1 = 1文字ずつ確定）
const MISSIONS = [
  {
    id: 'konnichiwa', title: 'はじめてのあいさつ', lines: ['こんにちは'], lock: 1,
    display: 'こんにちは', source: '',
    reward: '最初の猿「子猿」が仲間に！　猿の雇用が解禁されました。',
  },
  {
    id: 'saru', title: '自己紹介', lines: ['さる'], lock: 1,
    display: '猿', source: '',
    reward: '濁点・半濁点キーが追加されました（が・ぱ など）。辞書の研究が解禁。',
  },
  {
    id: 'arigatou', title: '感謝の言葉', lines: ['ありがとう'], lock: 1,
    display: 'ありがとう', source: '',
    reward: '執筆チームの研究が解禁。複数行を別々の猿チームで同時に打てます。',
  },
  {
    id: 'kotowaza', title: 'ことわざ', lines: ['さるもきから', 'おちる'], lock: 2,
    display: '猿も木から落ちる', source: 'ことわざ',
    reward: 'ここから2文字連続で当てないと確定しない「文節ロック」になります。',
  },
  {
    id: 'makura', title: '随筆の書き出し', lines: ['はるはあけぼの'], lock: 2,
    display: '春はあけぼの', source: '清少納言『枕草子』',
    reward: '猿たちは季節を感じ始めた。次の俳句からは3文字連続で当てる必要があります。',
  },
  {
    id: 'haiku', title: '俳句', lines: ['ふるいけや', 'かわずとびこむ', 'みずのおと'], lock: 3,
    display: '古池や\n蛙飛び込む\n水の音', source: '松尾芭蕉',
    reward: '猿の俳人が誕生した。',
  },
  {
    id: 'tanka', title: '短歌', lines: ['たごのうらに', 'うちいでてみれば', 'しろたえの', 'ふじのたかねに', 'ゆきはふりつつ'], lock: 4,
    display: '田子の浦に\nうち出でて見れば\n白妙の\n富士の高嶺に\n雪は降りつつ', source: '山部赤人（小倉百人一首 第4番）',
    reward: '日本編クリア！　猿たちはイギリスへの渡航準備を始めた……',
  },
];

const GENERATORS = [
  { id: 'kozaru',     icon: '🐒', name: '子猿',               kps: 0.5,    cost: 15,    desc: 'キーボードを叩くのが大好き。' },
  { id: 'chimp',      icon: '🦧', name: 'チンパンジー',       kps: 3,      cost: 110,   desc: '両手で叩ける。' },
  { id: 'gorilla',    icon: '🦍', name: 'ゴリラ',             kps: 16,     cost: 1200,  desc: 'キーが壊れるほどの打鍵力。' },
  { id: 'school',     icon: '🏫', name: '猿のタイピング教室', kps: 90,     cost: 13000, desc: '猿が猿に打鍵を教える。' },
  { id: 'factory',    icon: '🏭', name: 'タイプライター工場', kps: 520,    cost: 150000, desc: '何千台ものタイプライターが並ぶ。' },
  { id: 'planet',     icon: '🪐', name: '猿の惑星',           kps: 3200,   cost: 1.8e6, desc: '惑星まるごと打鍵中。' },
  { id: 'quantum',    icon: '⚛️', name: '量子猿',             kps: 22000,  cost: 2.4e7, desc: 'あらゆるキーを同時に押している状態。' },
  { id: 'multiverse', icon: '🌌', name: '並行宇宙の猿',       kps: 160000, cost: 3.5e8, desc: 'どこかの宇宙ではもう完成している。' },
];
const GEN_GROWTH = 1.15;

// 猿の特訓（所持数に応じた生産倍率）
const GEN_TIERS = [
  { need: 10, costMul: 25,    name: '特訓' },
  { need: 25, costMul: 500,   name: '猛特訓' },
  { need: 50, costMul: 25000, name: '免許皆伝' },
];

// 一回きりの強化
const UPGRADES = [
  { id: 'hands',   name: '両手打ち',             desc: 'クリックの打鍵数 ×2',                 cost: 25,    clickMul: 2, cond: () => true },
  { id: 'finger',  name: '指サック',             desc: 'クリックの打鍵数 ×2',                 cost: 300,   clickMul: 2, cond: s => s.missionIdx >= 1 },
  { id: 'mech',    name: 'メカニカルキーボード', desc: 'クリックの打鍵数 ×2',                 cost: 8000,  clickMul: 2, cond: s => s.missionIdx >= 3 },
  { id: 'banana1', name: 'バナナの差し入れ',     desc: 'クリックに毎秒打鍵の1%を上乗せ',      cost: 1500,  clickPct: 0.01, cond: s => totalMonkeys(s) >= 5 },
  { id: 'banana2', name: 'バナナの房',           desc: 'クリックに毎秒打鍵の2%を上乗せ',      cost: 1.2e5, clickPct: 0.02, cond: s => s.ups.banana1 },
  { id: 'banana3', name: 'バナナ農園',           desc: 'クリックに毎秒打鍵の3%を上乗せ',      cost: 2e7,   clickPct: 0.03, cond: s => s.ups.banana2 },
];

// レベル制の研究
const RESEARCH = [
  { id: 'edu',  name: '教育',       max: 12, base: 150,  growth: 8,
    desc: lv => `次に必要な文字が出やすくなる（当たり重み ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}）`,
    cond: s => s.missionIdx >= 1 },
  { id: 'dict', name: '辞書',       max: 12, base: 400,  growth: 7,
    desc: () => 'この先使わないキーを4つ封印して、抽選対象を減らす',
    cond: s => s.dakuten },
  { id: 'team', name: '執筆チーム', max: 4,  base: 800,  growth: 15,
    desc: lv => `猿チームを追加して ${lv + 2} 行を同時に打つ`,
    cond: s => s.missionIdx >= 3 },
  { id: 'away', name: '留守番',     max: 5,  base: 1000, growth: 8,
    desc: lv => `留守中の効率 ${50 + 10 * lv}%→${50 + 10 * (lv + 1)}%、上限 ${2 + 2 * lv}→${4 + 2 * lv}時間`,
    cond: s => s.missionIdx >= 1 },
];

// 偶然の単語（外れ文字の中から見つかるとボーナス）
const WORDS = ['さる', 'ねこ', 'いぬ', 'さくら', 'ばなな', 'ごりら', 'すいか', 'めだか', 'からす', 'きつね',
  'たぬき', 'うさぎ', 'こあら', 'とまと', 'みかん', 'りんご', 'ことば', 'しあわせ', 'ほんやく', 'うきうき'];

const MONKEY_NAMES = ['ジョージ', 'モモ', 'サスケ', 'ハヌマン', 'ウィリアム', 'ココ', 'ボノ', 'キキ', 'タロウ', 'ハナコ',
  'ゴン', 'チャチャ', 'マロン', 'ポポ', 'ルル', 'シーザー', 'ケンタ', 'ミミ', 'バナ太', 'ウッキー', 'ソウセキ', 'バショウ',
  'イッサ', 'ブソン', 'セイ', 'シキ'];
const MONKEY_TRAITS = ['几帳面', '気まぐれ', '詩人肌', '寝坊助', 'バナナ中毒', '哲学者', '早打ち', '物静か', '目立ちたがり', '文学青年'];
const ROSTER_MAX = 24;

const ACHIEVEMENTS = [
  ...[[100, '百打鍵'], [1e3, '千打鍵'], [1e4, '一万打鍵'], [1e5, '十万打鍵'], [1e6, '百万打鍵'], [1e8, '一億打鍵'], [1e10, '百億打鍵'], [1e12, '一兆打鍵']]
    .map(([n, name]) => ({ id: 'keys' + n, name, desc: `通算 ${fmt(n)} 打鍵`, check: s => s.totalKeys >= n })),
  ...[[100, '連打の心得'], [1000, '腱鞘炎予備軍'], [5000, '人間タイプライター']]
    .map(([n, name]) => ({ id: 'click' + n, name, desc: `${fmt(n)} 回クリック`, check: s => s.clicks >= n })),
  ...[[1, '最初の同僚'], [10, '小さな群れ'], [50, '猿山'], [100, '猿の大行進'], [250, '猿の帝国']]
    .map(([n, name]) => ({ id: 'monkey' + n, name, desc: `猿系を合計 ${n} 体所持`, check: s => totalMonkeys(s) >= n })),
  ...[[1, 'セレンディピティ'], [5, '偶然の語彙'], [10, '猿の国語辞典'], [WORDS.length, '無限の語彙']]
    .map(([n, name]) => ({ id: 'word' + n, name, desc: `偶然の単語を ${n} 種類発見`, check: s => Object.keys(s.words).length >= n })),
  ...MISSIONS.map((m, i) => ({ id: 'm_' + m.id, name: `『${m.display.split('\n')[0]}』`, desc: `ミッション「${m.title}」を完成`, check: s => s.missionIdx > i })),
  { id: 'golden1', name: '金のバナナ', desc: '金のバナナを拾う', check: s => s.goldenClicks >= 1 },
  { id: 'golden10', name: 'バナナ長者', desc: '金のバナナを10回拾う', check: s => s.goldenClicks >= 10 },
  { id: 'edu3', name: '猿の学校', desc: '教育をLv3に', check: s => s.lv.edu >= 3 },
  { id: 'dict3', name: '辞書引き', desc: '辞書をLv3に', check: s => s.lv.dict >= 3 },
  { id: 'team1', name: '分業制', desc: '執筆チームを1つ追加', check: s => s.lv.team >= 1 },
  { id: 'strike', name: '団体交渉', desc: 'ストライキをバナナで説得', check: s => s.strikesSettled >= 1 },
];
const ACH_BONUS = 0.02;

// 数値を日本式の単位で表示
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
