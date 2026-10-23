import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createGunzip } from "node:zlib";

const projectRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  projectRoot,
  "src/components/sites/piece-of-art/paintingCatalog.generated.ts",
);
const provenancePath = resolve(
  projectRoot,
  "docs/research/piece-of-art/artwork-sources.json",
);
const curation = JSON.parse(
  await readFile(resolve(import.meta.dirname, "painting-catalog-curation.json"), "utf8"),
);

const themes = [
  { id: "night-sky", query: "night moon nocturne", keywords: ["night", "moon", "nocturne", "evening", "twilight", "dusk", "star", "window", "galette", "astra", "blue"], en: "Night & Sky", zh: "夜色与星空", accent: "hsl(218 38% 35%)" },
  { id: "portraits", query: "portrait", keywords: ["portrait", "head", "bust", "self-portrait"], en: "Portraits & Gazes", zh: "肖像与凝视", accent: "hsl(18 34% 43%)" },
  { id: "gardens", query: "garden flower", keywords: ["garden", "flower", "lily", "blossom", "paradise"], en: "Gardens & Flowers", zh: "花园与花卉", accent: "hsl(102 28% 38%)" },
  { id: "sea-water", query: "sea river water boat", keywords: ["sea", "water", "river", "boat", "beach", "canal", "gulf", "nile", "rower", "fishing"], en: "Sea & Water", zh: "海洋与水", accent: "hsl(198 41% 39%)" },
  { id: "landscapes", query: "landscape mountains", keywords: ["landscape", "mountain", "view", "valley", "field", "alpine", "river"], en: "Landscapes & Distance", zh: "山野与远方", accent: "hsl(74 24% 40%)" },
  { id: "city-life", query: "city street Paris", keywords: ["city", "street", "paris", "london", "venice", "new york", "montmartre", "parliament", "seine"], en: "City & Modern Life", zh: "城市与现代生活", accent: "hsl(34 22% 40%)" },
  { id: "leisure-daily", query: "interior leisure family", keywords: ["family", "woman", "interior", "reading", "concert", "café", "cafe", "lunch", "toilette", "winter", "moulin"], en: "Daily Life & Leisure", zh: "日常与闲暇", accent: "hsl(42 35% 48%)" },
  { id: "dance-music", query: "dance music theater", keywords: ["dance", "music", "piano", "circus", "revel", "merrymaker", "theater", "theatre"], en: "Dance & Music", zh: "舞蹈与音乐", accent: "hsl(252 26% 43%)" },
  { id: "love-intimacy", query: "mother child lovers", keywords: ["mother", "child", "love", "kiss", "lover", "embrace", "family"], en: "Love & Intimacy", zh: "爱与亲密", accent: "hsl(345 31% 47%)" },
  { id: "myths-sacred", query: "mythology biblical saint", keywords: ["saint", "virgin", "christ", "apollo", "venus", "myth", "salome", "assumption", "angel", "baptist"], en: "Myths & Faith", zh: "神话与信仰", accent: "hsl(281 18% 39%)" },
  { id: "still-life", query: "still life fruit flowers", keywords: ["still life", "fruit", "apple", "grape", "pear", "strawberr", "magnolia", "fish"], en: "Still Life & Table", zh: "静物与餐桌", accent: "hsl(26 35% 39%)" },
  { id: "emotion-dreams", query: "dream solitude melancholy", keywords: ["dream", "melanchol", "solitude", "sorrow", "mourn", "reverie", "lonely"], en: "Emotion & Dreams", zh: "情绪与梦境", accent: "hsl(230 25% 38%)" },
];

const localSources = {
  starryNight: { sourceName: "Museum of Modern Art", sourceUrl: "https://www.moma.org/collection/works/79802", publicDomain: true },
  monaLisa: { sourceName: "Musée du Louvre", sourceUrl: "https://collections.louvre.fr/en/ark:/53355/cl010062370", publicDomain: true },
  pearlEarring: { sourceName: "Mauritshuis", sourceUrl: "https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring/", publicDomain: true },
  birthOfVenus: { sourceName: "Uffizi Galleries", sourceUrl: "https://www.uffizi.it/en/artworks/birth-of-venus", publicDomain: true },
  waterLilies: { sourceName: "The Metropolitan Museum of Art", sourceUrl: "https://www.metmuseum.org/art/collection/search/438008", publicDomain: true },
  theKiss: { sourceName: "Belvedere Museum Vienna", sourceUrl: "https://www.belvedere.at/en/press/klimt-collection-belvedere", publicDomain: true },
  theScream: { sourceName: "National Museum of Norway", sourceUrl: "https://www.nasjonalmuseet.no/en/collection/object/NG.M.00939", publicDomain: true },
  picassoLeReve: { sourceName: "User-provided image", sourceUrl: "https://en.wikipedia.org/wiki/Le_R%C3%AAve_%28Picasso%29", publicDomain: false },
  greatWave: { sourceName: "The Metropolitan Museum of Art", sourceUrl: "https://www.metmuseum.org/art/collection/search/45434", publicDomain: true },
  luncheon: { sourceName: "Musée d’Orsay", sourceUrl: "https://www.musee-orsay.fr/en/artworks/le-dejeuner-sur-lherbe-904", publicDomain: true },
  blueDancers: { sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/File:Edgar_Degas_-_Blue_Dancers_-_Google_Art_Project.jpg", publicDomain: true },
};

const basePaintings = [
  {
    id: "starry-night",
    image: "/sites/piece-of-art/starry-night.png",
    workTitle: "The Starry Night",
    artist: "Vincent van Gogh",
    date: "1889",
    title: { en: "vincent van gogh / the starry night 1889", zh: "文森特·梵高 / 星月夜 1889" },
    plaqueTitle: "THE STARRY NIGHT",
    plaqueSub: "VAN GOGH · 1889",
    description: {
      en: "Inspired by the view from his window at the Saint-Paul-de-Mausole asylum in Saint-Rémy, where Van Gogh spent twelve months seeking reprieve from his mental illness.",
      zh: "这幅画取材于梵高在圣雷米圣保罗精神疗养院窗外的景色；他曾在那里休养十二个月，寻求精神疾病带来的喘息。",
    },
    themeId: "night-sky",
    accent: "hsl(214 55% 33%)",
    ...localSources.starryNight,
  },
  {
    id: "mona-lisa",
    image: "/sites/piece-of-art/mona-lisa.png",
    workTitle: "Mona Lisa",
    artist: "Leonardo da Vinci",
    date: "1503",
    title: { en: "leonardo da vinci / mona lisa 1503", zh: "列奥纳多·达·芬奇 / 蒙娜丽莎 1503" },
    plaqueTitle: "MONA LISA",
    plaqueSub: "LEONARDO DA VINCI · 1503",
    description: {
      en: "Believed to portray Lisa Gherardini, the wife of Florentine merchant Francesco del Giocondo. Leonardo’s sfumato technique gives her famous smile its soft, elusive quality.",
      zh: "普遍认为画中人是佛罗伦萨商人弗朗切斯科·德尔·焦孔多的妻子丽莎·盖拉尔迪尼。达·芬奇的晕涂法赋予她的微笑柔和而神秘的质感。",
    },
    themeId: "portraits",
    accent: "hsl(48 26% 35%)",
    ...localSources.monaLisa,
  },
  {
    id: "girl-with-a-pearl-earring",
    image: "/sites/piece-of-art/girl-with-a-pearl-earring.png",
    workTitle: "Girl with a Pearl Earring",
    artist: "Johannes Vermeer",
    date: "1665",
    title: { en: "johannes vermeer / girl with a pearl earring 1665", zh: "约翰内斯·维米尔 / 戴珍珠耳环的少女 1665" },
    plaqueTitle: "GIRL WITH A PEARL EARRING",
    plaqueSub: "JOHANNES VERMEER · 1665",
    description: {
      en: "This isn’t a traditional portrait but a tronie — a study of a character or expression. The oversized pearl may not even have been a real pearl.",
      zh: "这并非传统肖像，而是一幅人物头像习作，用于研究角色与表情。画中那颗夸张的珍珠甚至可能并不是真正的珍珠。",
    },
    themeId: "portraits",
    accent: "hsl(207 39% 34%)",
    ...localSources.pearlEarring,
  },
  {
    id: "met-12127",
    image: "https://images.metmuseum.org/CRDImages/ad/web-large/DP-29006-001.jpg",
    workTitle: "Madame X (Virginie Amélie Avegno Gautreau)",
    artist: "John Singer Sargent",
    date: "1883–84",
    title: {
      en: "john singer sargent / madame x (virginie amélie avegno gautreau) 1883–84",
      zh: "约翰·辛格·萨金特 / X 夫人 1883–84",
    },
    plaqueTitle: "MADAME X",
    plaqueSub: "JOHN SINGER SARGENT · 1883–84",
    description: {
      en: "Sargent's dramatic profile portrait of Virginie Gautreau became one of the defining images of late nineteenth-century society portraiture.",
      zh: "萨金特以强烈的侧面轮廓描绘维吉尼亚·戈特罗，成为十九世纪末上流社会肖像的代表作。",
    },
    themeId: "portraits",
    accent: "hsl(18 34% 43%)",
    sourceName: "The Metropolitan Museum of Art",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/12127",
    publicDomain: true,
  },
  {
    id: "met-437869",
    image: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-14286-001.jpg",
    workTitle: "Juan de Pareja (ca. 1608–1670)",
    artist: "Velázquez (Diego Rodríguez de Silva y Velázquez)",
    date: "1650",
    title: {
      en: "velázquez / juan de pareja 1650",
      zh: "迪戈·委拉斯开兹 / 胡安·德·帕雷哈 1650",
    },
    plaqueTitle: "JUAN DE PAREJA",
    plaqueSub: "DIEGO VELÁZQUEZ · 1650",
    description: {
      en: "Velázquez painted his studio assistant Juan de Pareja with exceptional presence, directness, and psychological depth.",
      zh: "委拉斯开兹以非凡的存在感与心理深度，描绘了他的工作室助手胡安·德·帕雷哈。",
    },
    themeId: "portraits",
    accent: "hsl(18 34% 43%)",
    sourceName: "The Metropolitan Museum of Art",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/437869",
    publicDomain: true,
  },
  {
    id: "met-436896",
    image: "https://images.metmuseum.org/CRDImages/ep/web-large/DP159891.jpg",
    workTitle: "Portrait of a Woman with a Man at a Casement",
    artist: "Fra Filippo Lippi",
    date: "ca. 1440",
    title: {
      en: "fra filippo lippi / portrait of a woman with a man at a casement ca. 1440",
      zh: "菲利波·利皮修士 / 窗前的女子与男子肖像 约1440",
    },
    plaqueTitle: "PORTRAIT OF A WOMAN WITH A MAN AT A CASEMENT",
    plaqueSub: "FRA FILIPPO LIPPI · CA. 1440",
    description: {
      en: "This early double portrait stages a richly dressed woman before a window while a man looks in from beyond the architectural frame.",
      zh: "这幅早期双人肖像让华服女子立于窗前，男子则从建筑框架之外望向室内。",
    },
    themeId: "portraits",
    accent: "hsl(18 34% 43%)",
    sourceName: "The Metropolitan Museum of Art",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/436896",
    publicDomain: true,
  },
  {
    id: "birth-of-venus",
    image: "/sites/piece-of-art/birth-of-venus.png",
    workTitle: "The Birth of Venus",
    artist: "Sandro Botticelli",
    date: "1485",
    title: { en: "sandro botticelli / the birth of venus 1485", zh: "桑德罗·波提切利 / 维纳斯的诞生 1485" },
    plaqueTitle: "THE BIRTH OF VENUS",
    plaqueSub: "SANDRO BOTTICELLI · 1485",
    description: {
      en: "The scene shows Venus arriving on the shore after her birth from the sea, standing on a giant shell as the winds carry her toward land.",
      zh: "画面描绘维纳斯从海中诞生后乘巨大贝壳抵达岸边，风神将她吹向陆地。",
    },
    themeId: "myths-sacred",
    accent: "hsl(183 26% 52%)",
    ...localSources.birthOfVenus,
  },
  {
    id: "water-lilies",
    image: "/sites/piece-of-art/water-lilies.png",
    workTitle: "Water Lilies",
    artist: "Claude Monet",
    date: "1919",
    title: { en: "claude monet / water lilies 1919", zh: "克劳德·莫奈 / 睡莲 1919" },
    plaqueTitle: "WATER LILIES",
    plaqueSub: "CLAUDE MONET · 1919",
    description: {
      en: "Part of Monet’s famous Water Lilies series, inspired by the water garden he created at his home in Giverny, France.",
      zh: "属于莫奈著名的《睡莲》系列，灵感来自他在法国吉维尼故居亲手营造的水上花园。",
    },
    themeId: "gardens",
    accent: "hsl(164 25% 42%)",
    ...localSources.waterLilies,
  },
  {
    id: "the-kiss",
    image: "/sites/piece-of-art/the-kiss.png",
    workTitle: "The Kiss",
    artist: "Gustav Klimt",
    date: "1909",
    title: { en: "gustav klimt / the kiss 1909", zh: "古斯塔夫·克里姆特 / 吻 1909" },
    plaqueTitle: "THE KISS",
    plaqueSub: "GUSTAV KLIMT · 1909",
    description: {
      en: "Painted during Klimt’s famous Golden Period, it shows a couple wrapped in richly patterned robes, surrounded by gold leaf and a flower-filled meadow.",
      zh: "创作于克里姆特著名的黄金时期，一对恋人身披华丽图案长袍，被金箔与繁花草地环绕。",
    },
    themeId: "love-intimacy",
    accent: "hsl(43 58% 44%)",
    ...localSources.theKiss,
  },
  {
    id: "the-scream",
    image: "/sites/piece-of-art/the-scream.png",
    workTitle: "The Scream",
    artist: "Edvard Munch",
    date: "1893",
    title: { en: "edvard munch / the scream 1893", zh: "爱德华·蒙克 / 呐喊 1893" },
    plaqueTitle: "THE SCREAM",
    plaqueSub: "EDVARD MUNCH · 1893",
    description: {
      en: "Inspired by a walk near Oslo, Munch described suddenly sensing an infinite scream passing through nature as the sky turned blood red.",
      zh: "灵感来自蒙克在奥斯陆附近的一次散步。他描述天空变得血红时，突然感到一声无尽的呐喊穿过自然。",
    },
    themeId: "emotion-dreams",
    accent: "hsl(16 55% 45%)",
    ...localSources.theScream,
  },
  {
    id: "picasso-le-reve",
    image: "/sites/piece-of-art/picasso-le-reve.jpg",
    workTitle: "Le Rêve (The Dream)",
    artist: "Pablo Picasso",
    date: "1932",
    title: { en: "pablo picasso / le rêve (the dream) 1932", zh: "巴勃罗·毕加索 / 梦（Le Rêve）1932" },
    plaqueTitle: "LE RÊVE (THE DREAM)",
    plaqueSub: "PABLO PICASSO · 1932",
    description: {
      en: "Painted in 1932, Le Rêve portrays Marie-Thérèse Walter asleep in a red armchair, using sweeping curves, bold color blocks, and a dreamlike split profile.",
      zh: "《梦》创作于 1932 年，画中玛丽-特蕾兹·沃尔特在红色扶手椅中沉睡。毕加索以流动曲线、强烈色块与梦境般的双面轮廓塑造她的形象。",
    },
    themeId: "emotion-dreams",
    accent: "hsl(354 72% 45%)",
    ...localSources.picassoLeReve,
  },
  {
    id: "the-great-wave-off-kanagawa",
    image: "/sites/piece-of-art/great-wave.png",
    workTitle: "The Great Wave off Kanagawa",
    artist: "Katsushika Hokusai",
    date: "1832",
    title: { en: "katsushika hokusai / the great wave off kanagawa 1832", zh: "葛饰北斋 / 神奈川冲浪里 1832" },
    plaqueTitle: "THE GREAT WAVE OFF KANAGAWA",
    plaqueSub: "KATSUSHIKA HOKUSAI · 1832",
    description: {
      en: "Part of Hokusai’s Thirty-Six Views of Mount Fuji series, the print shows three boats battling a huge wave, with Mount Fuji appearing tiny in the distance.",
      zh: "《富岳三十六景》系列之一，画面中三艘船在巨浪间搏斗，远处的富士山显得格外渺小。",
    },
    themeId: "sea-water",
    accent: "hsl(205 49% 39%)",
    ...localSources.greatWave,
  },
  {
    id: "luncheon-on-the-grass",
    image: "/sites/piece-of-art/luncheon-on-the-grass.png",
    workTitle: "Luncheon on the Grass",
    artist: "Édouard Manet",
    date: "1863",
    title: { en: "édouard manet / luncheon on the grass 1863", zh: "爱德华·马奈 / 草地上的午餐 1863" },
    plaqueTitle: "LUNCHEON ON THE GRASS",
    plaqueSub: "ÉDOUARD MANET · 1863",
    description: {
      en: "The painting caused a scandal in Paris by placing a nude woman alongside two fully dressed men in an ordinary contemporary picnic scene.",
      zh: "画中把一位裸体女子与两位衣着整齐的男子置于普通的现代野餐场景，曾在巴黎引起巨大争议。",
    },
    themeId: "leisure-daily",
    accent: "hsl(91 28% 32%)",
    ...localSources.luncheon,
  },
  {
    id: "blue-dancers",
    image: "/sites/piece-of-art/blue-dancers.png",
    workTitle: "Blue Dancers",
    artist: "Edgar Degas",
    date: "c. 1897",
    title: { en: "edgar degas / blue dancers c. 1897", zh: "埃德加·德加 / 蓝衣舞者 约1897" },
    plaqueTitle: "BLUE DANCERS",
    plaqueSub: "EDGAR DEGAS · C. 1897",
    description: {
      en: "Degas shows four ballerinas adjusting their costumes before a performance, using vivid blue pastels and an unusual cropped, almost overhead composition.",
      zh: "德加描绘四位芭蕾舞者在演出前整理服装，以鲜艳的蓝色粉彩和近似俯视的非常规裁切构图呈现。",
    },
    themeId: "dance-music",
    accent: "hsl(205 52% 46%)",
    ...localSources.blueDancers,
  },
];

function compact(value, fallback) {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : fallback;
}

function toPainting(artwork, theme) {
  const artist = compact(artwork.artistDisplayName, "Unknown artist");
  const date = compact(artwork.objectDate, "Date unknown");
  const title = compact(artwork.title, "Untitled");
  return {
    id: `met-${artwork.objectID}`,
    image: artwork.primaryImageSmall,
    workTitle: title,
    artist,
    date,
    title: {
      en: `${artist.toLowerCase()} / ${title.toLowerCase()} ${date}`,
      zh: `${artist} / ${title} ${date}`,
    },
    plaqueTitle: title.toUpperCase(),
    plaqueSub: `${artist.toUpperCase()} · ${date.toUpperCase()}`,
    description: {
      en: `${title} was created by ${artist}, ${date}. This public-domain work belongs to The Metropolitan Museum of Art.`,
      zh: `《${title}》由 ${artist} 创作，年代为 ${date}。这件公版作品来自纽约大都会艺术博物馆馆藏。`,
    },
    themeId: theme.id,
    accent: theme.accent,
    sourceName: "The Metropolitan Museum of Art",
    sourceUrl: artwork.objectURL,
    publicDomain: true,
  };
}

const datasetUrl = "https://huggingface.co/datasets/metmuseum/openaccess/resolve/main/source/metadata_images.csv.gz?download=true";
const datasetPath = existsSync("/tmp/met-metadata-images.csv.gz")
  ? "/tmp/met-metadata-images.csv.gz"
  : resolve(tmpdir(), "piece-of-art-met-metadata-images.csv.gz");

async function ensureDataset() {
  if (existsSync(datasetPath)) return;
  const response = await fetch(datasetUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Met dataset download failed: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(datasetPath));
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

async function loadMuseumCandidates() {
  await ensureDataset();
  const input = createReadStream(datasetPath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers;
  let indices;
  const candidates = [];

  for await (const line of lines) {
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields.map((field) => field.replace(/^\uFEFF/, ""));
      const indexOf = (name) => headers.indexOf(name);
      indices = {
        highlight: indexOf("Is Highlight"),
        publicDomain: indexOf("Is Public Domain"),
        objectID: indexOf("Object ID"),
        department: indexOf("Department"),
        objectName: indexOf("Object Name"),
        title: indexOf("Title"),
        artist: indexOf("Artist Display Name"),
        date: indexOf("Object Date"),
        medium: indexOf("Medium"),
        classification: indexOf("Classification"),
        objectURL: indexOf("Link Resource"),
        tags: indexOf("Tags"),
        image: indexOf("primaryImageSmall"),
      };
      continue;
    }

    const image = fields[indices.image];
    const medium = fields[indices.medium] ?? "";
    const classification = fields[indices.classification] ?? "";
    const objectName = fields[indices.objectName] ?? "";
    if (
      fields[indices.publicDomain] !== "True" ||
      !image?.startsWith("https://images.metmuseum.org/") ||
      !(/painting/i.test(`${classification} ${objectName}`) || /(^|;|,|\s)(oil|tempera|watercolor|gouache|fresco)(\s|,|;|$)/i.test(medium))
    ) {
      continue;
    }

    const title = fields[indices.title] ?? "Untitled";
    const tags = fields[indices.tags] ?? "";
    candidates.push({
      objectID: Number(fields[indices.objectID]),
      isHighlight: fields[indices.highlight] === "True",
      department: fields[indices.department] ?? "",
      primaryImageSmall: image,
      title,
      artistDisplayName: fields[indices.artist],
      objectDate: fields[indices.date],
      objectURL: (fields[indices.objectURL] || `https://www.metmuseum.org/art/collection/search/${fields[indices.objectID]}`).replace("http://", "https://"),
      searchText: `${title} ${tags} ${medium} ${classification}`.toLowerCase(),
    });
  }
  return candidates;
}

const museumCandidates = await loadMuseumCandidates();
const museumById = new Map(
  museumCandidates.map((artwork) => [`met-${artwork.objectID}`, artwork]),
);
const baseById = new Map(basePaintings.map((painting) => [painting.id, painting]));
const excludedIds = new Set(curation.excludedIds);
const selectedIds = new Set();
const paintings = [];

if (
  Object.keys(curation.themes).length !== themes.length ||
  Object.keys(curation.themes).some((id) => !themes.some((theme) => theme.id === id))
) {
  throw new Error("Curation must contain exactly the 12 catalog themes.");
}

// Media keywords cannot distinguish a finished color painting from a sketch or
// a black-and-white museum scan. Only this visually reviewed allowlist can ship.
for (const theme of themes) {
  const ids = curation.themes[theme.id];
  if (!Array.isArray(ids) || ids.length !== 10) {
    throw new Error(`${theme.id}: expected 10 visually reviewed paintings.`);
  }
  for (const id of ids) {
    if (excludedIds.has(id) || selectedIds.has(id)) {
      throw new Error(`Excluded or duplicate painting in curation: ${id}`);
    }
    selectedIds.add(id);
    const museumArtwork = museumById.get(id);
    const painting = baseById.get(id) ?? (museumArtwork && toPainting(museumArtwork, theme));
    if (!painting || painting.themeId !== theme.id) {
      throw new Error(`${id}: missing public-domain source or mismatched theme.`);
    }
    const replacement = curation.replacements[id];
    if (replacement) {
      const expectedPath = `/sites/piece-of-art/paintings/${id}.jpg`;
      if (replacement.image !== expectedPath || !replacement.sourceImage.startsWith("https://images.metmuseum.org/")) {
        throw new Error(`${id}: invalid reviewed image path or source.`);
      }
      const bytes = await readFile(resolve(projectRoot, `public${replacement.image}`));
      if (createHash("sha256").update(bytes).digest("hex") !== replacement.sha256) {
        throw new Error(`${id}: image has changed; visually review it before updating the manifest.`);
      }
      painting.image = replacement.image;
    }
    paintings.push(painting);
  }
}

if (paintings.length !== 120) throw new Error(`Expected 120 paintings, found ${paintings.length}`);
const paintingIdReplacements = Object.fromEntries(
  Object.entries(curation.replacements).map(([id, { replaces }]) => {
    if (!selectedIds.has(id) || !excludedIds.has(replaces) || selectedIds.has(replaces)) {
      throw new Error(`${id}: invalid replacement mapping for ${replaces}`);
    }
    return [replaces, id];
  }),
);
if (Object.keys(paintingIdReplacements).length !== Object.keys(curation.replacements).length) {
  throw new Error("Each removed painting must map to exactly one replacement.");
}

const types = `export type Language = "en" | "zh";\n\nexport type LocalizedText = Record<Language, string>;\n\nexport type Theme = {\n  id: string;\n  name: LocalizedText;\n  accent: string;\n};\n\nexport type Painting = {\n  id: string;\n  image: string;\n  workTitle: string;\n  artist: string;\n  date: string;\n  title: LocalizedText;\n  plaqueTitle: string;\n  plaqueSub: string;\n  description: LocalizedText;\n  themeId: string;\n  accent: string;\n  sourceName: string;\n  sourceUrl: string;\n  publicDomain: boolean;\n};`;
const publicThemes = themes.map(({ id, en, zh, accent }) => ({ id, name: { en, zh }, accent }));
const moduleSource = `// Generated by scripts/build-painting-catalog.mjs. Do not edit by hand.\n// Museum imports are public-domain works; local user-provided assets retain their recorded rights status.\n// Artworks are pinned to the visually reviewed full-color curation manifest.\n\n${types}\n\nexport const themes: Theme[] = ${JSON.stringify(publicThemes, null, 2)};\n\nexport const paintings: Painting[] = ${JSON.stringify(paintings, null, 2)};\n\n// Preserve completed level slots when a monochrome work is replaced.\nexport const paintingIdReplacements: Record<string, string> = ${JSON.stringify(paintingIdReplacements, null, 2)};\n`;

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(provenancePath), { recursive: true });
await writeFile(outputPath, moduleSource, "utf8");
await writeFile(
  provenancePath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      catalogSize: paintings.length,
      policy: "Museum imports must be explicitly public domain; local user-provided assets are tracked with their own rights status.",
      visualReview: { reviewedAt: curation.reviewedAt, policy: curation.policy, manifest: "scripts/painting-catalog-curation.json" },
      apiDocumentation: "https://metmuseum.github.io/",
      datasetSource: datasetUrl,
      works: paintings.map(({ id, image, workTitle, artist, date, themeId, sourceName, sourceUrl, publicDomain }) => ({
        id,
        image,
        workTitle,
        artist,
        date,
        themeId,
        sourceName,
        sourceUrl,
        publicDomain,
        ...(curation.replacements[id] ? { colorReplacement: curation.replacements[id] } : {}),
      })),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${paintings.length} paintings across ${themes.length} themes.`);
