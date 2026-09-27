// ゲームデータ定義（ミッション・猿・研究・実績など）
'use strict';

// 外れ用に追加されていくキーの順番
const DECOY_ORDER = 'あいうえおかけくそたてなぬねひへほまめやゆよらろれわをんせすしつぬむ' +
  'ぎぐげござぜぞだぢづどばぶべぱぴぷぺぽ';

// decoys: そのミッション開始時に追加される外れキーの数
const MISSIONS = [
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
    reward: '日本編クリア！ 猿たちはイギリスへの渡航準備を始めた……' },
];

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

const GEN_TIERS = [
  { need: 10, costMul: 20,    name: '特訓' },
  { need: 25, costMul: 300,   name: '猛特訓' },
  { need: 50, costMul: 10000, name: '免許皆伝' },
];

const UPGRADES = [
  { id: 'hands',   icon: 'hand', name: '両手打ち',             desc: 'クリックの打鍵数 ×2',             cost: 40,    clickMul: 2, cond: () => true },
  { id: 'finger',  icon: 'pointer', name: '指サック',             desc: 'クリックの打鍵数 ×2',             cost: 600,   clickMul: 2, cond: s => s.missionIdx >= 1 },
  { id: 'mech',    icon: 'keyboard', name: 'メカニカルキーボード', desc: 'クリックの打鍵数 ×2',             cost: 9000,  clickMul: 2, cond: s => s.missionIdx >= 3 },
  { id: 'banana1', icon: 'banana', name: 'バナナの差し入れ',     desc: 'クリックに毎秒打鍵の3%を上乗せ',  cost: 800,   clickPct: 0.03, cond: s => totalMonkeys(s) >= 3 },
  { id: 'banana2', icon: 'banana', name: 'バナナの房',           desc: 'クリックに毎秒打鍵の5%を上乗せ',  cost: 3e4,   clickPct: 0.05, cond: s => s.ups.banana1 },
  { id: 'banana3', icon: 'banana', name: 'バナナ農園',           desc: 'クリックに毎秒打鍵の8%を上乗せ',  cost: 2e6,   clickPct: 0.08, cond: s => s.ups.banana2 },
];

const RESEARCH = [
  { id: 'edu',  name: '教育',       icon: 'graduation-cap', max: 10, base: 120, growth: 5,
    desc: lv => `次に必要な文字が出やすくなる（当たり重み ×${(1 + 0.5 * lv).toFixed(1)} → ×${(1 + 0.5 * (lv + 1)).toFixed(1)}）`,
    cond: s => s.missionIdx >= 1 },
  { id: 'insp', name: 'ひらめき',   icon: 'lightbulb', max: 7, base: 100, growth: 4,
    desc: lv => `ひらめきゲージが満タンになるまでの外れ回数 キー数×${inspMaxAt(lv).toFixed(1)} → ×${inspMaxAt(lv + 1).toFixed(1)}`,
    cond: s => s.missionIdx >= 3 },
  { id: 'hint', name: '助言',       icon: 'notebook-pen', max: 6, base: 150, growth: 5,
    desc: lv => `ヒントの待ち時間 ${hintCdAt(lv)}秒 → ${hintCdAt(lv + 1)}秒`,
    cond: s => s.missionIdx >= 1 },
  { id: 'team', name: '執筆チーム', icon: 'users', max: 4, base: 300, growth: 8,
    desc: lv => `猿チームを追加して ${lv + 2} 行を同時に打つ`,
    cond: s => s.missionIdx >= 4 },
  { id: 'away', name: '留守番',     icon: 'moon', max: 5, base: 500, growth: 6,
    desc: lv => `留守中の効率 ${50 + 10 * lv}%→${50 + 10 * (lv + 1)}%、上限 ${2 + 2 * lv}→${4 + 2 * lv}時間`,
    cond: s => s.missionIdx >= 1 },
];

function inspMaxAt(lv) { return Math.max(0.5, 1.5 - 0.15 * lv); }
function hintCdAt(lv) { return Math.max(8, 30 - 4 * lv); }

// 偶然の単語
const WORDS = ['さる', 'ねこ', 'いぬ', 'はな', 'うみ', 'やま', 'さくら', 'ばなな', 'ごりら', 'すいか', 'めだか', 'からす', 'きつね',
  'たぬき', 'うさぎ', 'こあら', 'とまと', 'みかん', 'りんご', 'ことば', 'しあわせ', 'うきうき'];

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
  ...[[1, 'セレンディピティ'], [5, '偶然の語彙'], [10, '猿の国語辞典'], [WORDS.length, '無限の語彙']]
    .map(([n, name]) => ({ id: 'word' + n, name, desc: `偶然の単語を ${n} 種類発見`, check: s => Object.keys(s.words).length >= n })),
  ...MISSIONS.map((m, i) => ({ id: 'm_' + m.id, name: `『${m.display.split('\n')[0]}』`, desc: `ミッション「${m.title}」を完成`, check: s => s.missionIdx > i })),
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
