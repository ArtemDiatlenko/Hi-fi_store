// Генератор демо-иллюстраций товаров: node scripts/demo-images.mjs (из папки web).
// Рисует SVG в public/demo/products/{slug}-{1,2,3}.svg — общий вид, деталь крупно, товар в интерьере.
// Это заглушки для демо-каталога (api/.../Seeding/DemoCatalog.cs), а не фото: заменяются настоящими
// снимками через админку (раздел «Зображення» товара).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo", "products");
const W = 1200;
const H = 900;

// Отделки корпусов: [светлый, тёмный] края градиента.
const FINISH = {
  silver: ["#e4e5e7", "#a7a9ad"],
  black: ["#3a3a3e", "#141416"],
  champagne: ["#e8dcc2", "#b9a882"],
  walnut: ["#8a5a36", "#4e2f1a"],
  oak: ["#c99d6b", "#8c6439"],
  white: ["#f4f3f0", "#cfccc6"],
  graphite: ["#55575c", "#2a2b2e"],
};

const PRODUCTS = [
  { slug: "aurora-i-80", kind: "integrated", brand: "AURORA", finish: "silver", knobs: 2, buttons: 4, display: "BT", led: "#4aa3ff" },
  { slug: "aurora-i-150-pro", kind: "integrated", brand: "AURORA", finish: "black", knobs: 2, buttons: 6, vu: true, led: "#f6c56b" },
  { slug: "nord-audio-na-40", kind: "integrated", brand: "NORD AUDIO", finish: "graphite", knobs: 1, buttons: 3, display: "BT", led: "#4aa3ff", compact: true },
  { slug: "kvarts-lampa-25", kind: "tube", brand: "KVARTS", finish: "black", tubes: 4, tall: true, trim: "#c9a24e" },
  { slug: "kvarts-lampa-8-demo", kind: "tube", brand: "KVARTS", finish: "walnut", tubes: 2, tall: false, trim: "#c9a24e" },
  { slug: "vega-se-300-draft", kind: "tube", brand: "VEGA", finish: "champagne", tubes: 4, tall: true, trim: "#8d8d8d" },
  { slug: "liniya-mini-2", kind: "bookshelf", brand: "LINIYA", finish: "white", baffle: "#1c1c1e" },
  { slug: "nord-audio-ns-5-walnut", kind: "bookshelf", brand: "NORD", finish: "walnut", baffle: "#2a1d14" },
  { slug: "liniya-tower-9", kind: "floor", brand: "LINIYA", finish: "black", baffle: "#111113", woofers: 2, mid: true },
  { slug: "vega-floor-3", kind: "floor", brand: "VEGA", finish: "oak", baffle: "#2b2118", woofers: 1, mid: false },
  { slug: "kvarts-vrashchenie-1", kind: "turntable", brand: "KVARTS", finish: "black", label: "#c0392b", drive: "belt" },
  { slug: "aurora-direct-x", kind: "turntable", brand: "AURORA", finish: "silver", label: "#e0b23a", drive: "direct" },
  { slug: "liniya-silver-rca-1", kind: "cable", connector: "rca", jacket: "#b9bcc2", braid: "#e6e8ec", accent: ["#d43c3c", "#e8e8e8"] },
  { slug: "nord-audio-xlr-2", kind: "cable", connector: "xlr", jacket: "#232326", braid: "#3b3b40", accent: ["#2f6fd6", "#d43c3c"] },
  { slug: "kvarts-rca-0-5-demo", kind: "cable", connector: "rca", jacket: "#5b1f22", braid: "#8a3036", accent: ["#d43c3c", "#e8e8e8"], short: true },
];

// ---------- Общие элементы ----------

let uid = 0;
const id = (name) => `${name}${++uid}`;

function grad(name, a, b, vertical = true) {
  const g = id(name);
  const dir = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
  return { id: g, def: `<linearGradient id="${g}" ${dir}><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` };
}

function radial(name, stops) {
  const g = id(name);
  const s = stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join("");
  return { id: g, def: `<radialGradient id="${g}" cx="0.5" cy="0.45" r="0.6">${s}</radialGradient>` };
}

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${defs.join("")}<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>` +
    `<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter></defs>${body}</svg>\n`;
}

// Студийный фон: тёмный градиент и мягкая тень под товаром.
function studio(defs) {
  const bg = radial("studio", [[0, "#3a3a40"], [0.7, "#17171a"], [1, "#0b0b0d"]]);
  defs.push(bg.def);
  return `<rect width="${W}" height="${H}" fill="url(#${bg.id})"/>` +
    `<ellipse cx="600" cy="700" rx="430" ry="38" fill="#000" opacity="0.55" filter="url(#blur)"/>`;
}

// Пол из досок — для напольной акустики (вместо комода).
function woodFloor(defs) {
  const boards = grad("floor", "#a57650", "#6f4a2c");
  defs.push(boards.def);
  const lines = Array.from({ length: 6 }, (_, i) =>
    `<line x1="0" y1="${712 + i * 32}" x2="${W}" y2="${712 + i * 32}" stroke="#4a2f1b" stroke-opacity="0.35" stroke-width="2"/>`).join("");
  return `<rect x="0" y="700" width="${W}" height="${H - 700}" fill="url(#${boards.id})"/>${lines}` +
    `<rect x="0" y="690" width="${W}" height="14" fill="#f6f2ea"/>` +
    `<ellipse cx="600" cy="712" rx="380" ry="18" fill="#000" opacity="0.3" filter="url(#blur)"/>`;
}

// Интерьер: стена, окно-свет, картина и комод из дерева (или пол — для напольной акустики).
function room(defs, onFloor = false) {
  const wall = grad("wall", "#efe8dc", "#d9cfbf");
  const wood = grad("wood", "#9a6b43", "#6b4528");
  const light = radial("light", [[0, "#fffaf0", 0.85], [1, "#fffaf0", 0]]);
  defs.push(wall.def, wood.def, light.def);
  const grain = Array.from({ length: 7 }, (_, i) =>
    `<path d="M150 ${742 + i * 18} C 450 ${735 + i * 18}, 750 ${752 + i * 18}, 1050 ${740 + i * 18}" stroke="#5a3a22" stroke-opacity="0.25" stroke-width="2" fill="none"/>`).join("");
  const walls = `<rect width="${W}" height="${H}" fill="url(#${wall.id})"/>` +
    `<ellipse cx="260" cy="200" rx="420" ry="320" fill="url(#${light.id})"/>` +
    `<rect x="${onFloor ? 860 : 760}" y="120" width="250" height="190" rx="4" fill="#2d2a26"/><rect x="${onFloor ? 875 : 775}" y="135" width="220" height="160" fill="#c8b79a"/>` +
    `<circle cx="${onFloor ? 950 : 850}" cy="205" r="42" fill="#a2593a" opacity="0.85"/><rect x="${onFloor ? 990 : 890}" y="170" width="80" height="90" fill="#3e5a63" opacity="0.8"/>`;
  if (onFloor) {
    return walls + woodFloor(defs);
  }
  return walls +
    `<rect x="120" y="720" width="960" height="150" rx="6" fill="url(#${wood.id})"/>${grain}` +
    `<rect x="120" y="712" width="960" height="14" rx="4" fill="#b07d50"/>` +
    `<ellipse cx="600" cy="716" rx="360" ry="16" fill="#000" opacity="0.25" filter="url(#blur)"/>`;
}

// Ручка регулятора: металлический круг с риской.
function knob(cx, cy, r, angle = -40) {
  const g = radial("knob", [[0, "#f2f3f5"], [0.6, "#b9bcc1"], [1, "#6f7277"]]);
  const rad = (angle * Math.PI) / 180;
  return {
    def: g.def,
    svg: `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#000" opacity="0.35"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g.id})" stroke="#55585d" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(rad) * r * 0.8}" y2="${cy - Math.cos(rad) * r * 0.8}" stroke="#2b2b2e" stroke-width="4" stroke-linecap="round"/>`,
  };
}

// ---------- Товары (рисуются в своих координатах, ширина ~ до 760) ----------

function integrated(p, defs) {
  const [a, b] = FINISH[p.finish];
  const face = grad("face", a, b);
  const top = grad("top", b, a);
  defs.push(face.def, top.def);
  const w = p.compact ? 560 : 700;
  const h = p.compact ? 150 : 190;
  const x0 = (760 - w) / 2;
  const dark = p.finish !== "silver" && p.finish !== "champagne";
  const text = dark ? "#c9cbd0" : "#3b3d42";
  const parts = [];
  parts.push(`<polygon points="${x0 + 30},${200 - 40} ${x0 + w - 30},${200 - 40} ${x0 + w},200 ${x0},200" fill="url(#${top.id})" opacity="0.9"/>`);
  parts.push(`<rect x="${x0}" y="200" width="${w}" height="${h}" rx="10" fill="url(#${face.id})" stroke="#000" stroke-opacity="0.35"/>`);
  parts.push(`<rect x="${x0 + 40}" y="${200 + h}" width="40" height="12" rx="3" fill="#111"/><rect x="${x0 + w - 80}" y="${200 + h}" width="40" height="12" rx="3" fill="#111"/>`);
  const cy = 200 + h / 2;
  const big = knob(x0 + w - 110, cy, h * 0.32, 35);
  defs.push(big.def);
  parts.push(big.svg);
  if (p.knobs > 1) {
    const small = knob(x0 + 105, cy, h * 0.22, -60);
    defs.push(small.def);
    parts.push(small.svg);
  }
  const midX = x0 + w / 2;
  if (p.vu) {
    for (const dx of [-150, 10]) {
      const vx = midX + dx;
      parts.push(`<rect x="${vx}" y="${200 + 28}" width="140" height="80" rx="6" fill="#f3c46a"/><rect x="${vx}" y="${200 + 28}" width="140" height="80" rx="6" fill="#ffdf9e" opacity="0.6" filter="url(#glow)"/>` +
        `<path d="M ${vx + 18} ${200 + 92} A 60 60 0 0 1 ${vx + 122} ${200 + 92}" stroke="#3a2a12" stroke-width="2" fill="none"/>` +
        `<line x1="${vx + 70}" y1="${200 + 100}" x2="${vx + 96}" y2="${200 + 48}" stroke="#1b1b1b" stroke-width="3"/>`);
    }
  } else {
    parts.push(`<rect x="${midX - 110}" y="${200 + 34}" width="220" height="${h * 0.32}" rx="6" fill="#0d0d0f" stroke="#000"/>` +
      `<text x="${midX}" y="${200 + 34 + h * 0.22}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${h * 0.13}" fill="${p.led}" letter-spacing="4">${p.display ?? "CD"} · 42</text>`);
  }
  const bw = 34;
  const total = p.buttons * bw + (p.buttons - 1) * 12;
  for (let i = 0; i < p.buttons; i++) {
    const bx = midX - total / 2 + i * (bw + 12);
    parts.push(`<rect x="${bx}" y="${200 + h - 52}" width="${bw}" height="18" rx="4" fill="${dark ? "#26262a" : "#c4c6ca"}" stroke="#000" stroke-opacity="0.4"/>`);
  }
  parts.push(`<circle cx="${x0 + 30}" cy="${200 + h - 26}" r="5" fill="${p.led}"/><circle cx="${x0 + 30}" cy="${200 + h - 26}" r="10" fill="${p.led}" opacity="0.5" filter="url(#glow)"/>`);
  parts.push(`<text x="${x0 + 50}" y="${200 + 30}" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="${text}" letter-spacing="6">${p.brand}</text>`);
  return { svg: parts.join(""), focus: [x0 + w - 110, cy] };
}

function tube(p, defs) {
  const [a, b] = FINISH[p.finish];
  const face = grad("chassis", a, b);
  const plate = grad("plate", "#2a2a2d", "#121214");
  const glass = grad("glass", "#ffffff", "#9fb4c4", false);
  defs.push(face.def, plate.def, glass.def);
  const parts = [];
  parts.push(`<polygon points="80,300 680,300 730,340 30,340" fill="url(#${plate.id})"/>`);
  for (const tx of [520, 610]) {
    parts.push(`<rect x="${tx}" y="190" width="80" height="120" rx="10" fill="#1a1a1c" stroke="#000"/><rect x="${tx + 8}" y="196" width="64" height="20" rx="6" fill="#3a3a3e"/>`);
  }
  const tubeH = p.tall ? 190 : 120;
  const n = p.tubes;
  for (let i = 0; i < n; i++) {
    const tx = 110 + i * (n > 2 ? 95 : 140);
    const top = 320 - tubeH;
    parts.push(`<ellipse cx="${tx + 30}" cy="${top + tubeH * 0.62}" rx="22" ry="${tubeH * 0.2}" fill="#ff8a2a" opacity="0.9" filter="url(#glow)"/>` +
      `<rect x="${tx + 18}" y="${top + tubeH * 0.45}" width="24" height="${tubeH * 0.4}" rx="4" fill="#5d4a3a" opacity="0.8"/>` +
      `<rect x="${tx}" y="${top}" width="60" height="${tubeH}" rx="28" fill="url(#${glass.id})" opacity="0.28" stroke="#dfe7ee" stroke-opacity="0.6"/>` +
      `<rect x="${tx + 8}" y="${top + 10}" width="8" height="${tubeH - 40}" rx="4" fill="#fff" opacity="0.45"/>` +
      `<rect x="${tx - 4}" y="${318}" width="68" height="16" rx="3" fill="#0c0c0d"/>`);
  }
  parts.push(`<rect x="30" y="340" width="700" height="130" rx="8" fill="url(#${face.id})" stroke="#000" stroke-opacity="0.4"/>`);
  parts.push(`<rect x="30" y="340" width="700" height="8" fill="${p.trim}" opacity="0.85"/>`);
  for (const [kx, ang] of [[150, -50], [380, 20], [610, 40]]) {
    const k = knob(kx, 405, 30, ang);
    defs.push(k.def);
    parts.push(k.svg);
  }
  parts.push(`<text x="260" y="452" font-family="Georgia, serif" font-size="18" fill="${p.trim}" letter-spacing="8">${p.brand}</text>`);
  parts.push(`<rect x="70" y="470" width="50" height="14" rx="3" fill="#111"/><rect x="640" y="470" width="50" height="14" rx="3" fill="#111"/>`);
  return { svg: parts.join(""), focus: [190, 260] };
}

function driver(cx, cy, r, defs, kind = "woofer") {
  if (kind === "tweeter") {
    const dome = radial("dome", [[0, "#f6f1e7"], [0.7, "#bcae96"], [1, "#6d6253"]]);
    defs.push(dome.def);
    return `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="#0b0b0c"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${dome.id})"/>`;
  }
  const cone = radial("cone", [[0, "#5c5c60"], [0.55, "#2b2b2e"], [1, "#0e0e10"]]);
  defs.push(cone.def);
  return `<circle cx="${cx}" cy="${cy}" r="${r + 12}" fill="#1a1a1c" stroke="#3a3a3e" stroke-width="3"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${cone.id})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="#3d3d41"/><circle cx="${cx - r * 0.1}" cy="${cy - r * 0.1}" r="${r * 0.12}" fill="#77777c" opacity="0.6"/>`;
}

function speakerCabinet(x, y, w, h, p, defs, layout) {
  const [a, b] = FINISH[p.finish];
  const side = grad("side", a, b, false);
  defs.push(side.def);
  const parts = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#${side.id})" stroke="#000" stroke-opacity="0.35"/>`];
  if (p.finish === "walnut" || p.finish === "oak") {
    for (let i = 1; i < 9; i++) {
      parts.push(`<path d="M ${x + (w * i) / 9} ${y + 4} C ${x + (w * i) / 9 + 8} ${y + h / 3}, ${x + (w * i) / 9 - 8} ${y + (2 * h) / 3}, ${x + (w * i) / 9 + 4} ${y + h - 4}" stroke="#2a170b" stroke-opacity="0.25" fill="none"/>`);
    }
  }
  parts.push(`<rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" rx="6" fill="${p.baffle}"/>`);
  for (const [kind, fy, r] of layout) {
    parts.push(driver(x + w / 2, y + fy, r, defs, kind));
  }
  parts.push(`<text x="${x + w / 2}" y="${y + h - 26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#9a9aa0" letter-spacing="5">${p.brand}</text>`);
  return parts.join("");
}

function bookshelf(p, defs) {
  const layout = [["tweeter", 80, 26], ["woofer", 210, 72], ["port", 300, 0]];
  const parts = [];
  for (const x of [100, 440]) {
    parts.push(speakerCabinet(x, 120, 220, 360, p, defs, layout.filter(([k]) => k !== "port")));
    parts.push(`<circle cx="${x + 110}" cy="${120 + 312}" r="14" fill="#050506"/>`);
  }
  return { svg: parts.join(""), focus: [210, 230] };
}

function floor(p, defs) {
  const layout = [["tweeter", 70, 24]];
  if (p.mid) layout.push(["woofer", 160, 46]);
  layout.push(["woofer", p.mid ? 290 : 220, 62]);
  if (p.woofers > 1) layout.push(["woofer", 430, 62]);
  const parts = [];
  for (const x of [150, 430]) {
    parts.push(speakerCabinet(x, 40, 180, 560, p, defs, layout));
    parts.push(`<rect x="${x - 10}" y="600" width="200" height="14" rx="4" fill="#111"/>`);
  }
  return { svg: parts.join(""), focus: [240, 130] };
}

function turntable(p, defs) {
  const [a, b] = FINISH[p.finish];
  const plinth = grad("plinth", a, b);
  const vinyl = radial("vinyl", [[0, "#2b2b2e"], [0.98, "#0b0b0c"], [1, "#000"]]);
  const platter = grad("platter", "#d7d9dc", "#8d9095");
  defs.push(plinth.def, vinyl.def, platter.def);
  const parts = [];
  parts.push(`<rect x="60" y="110" width="640" height="440" rx="22" fill="url(#${plinth.id})" stroke="#000" stroke-opacity="0.4"/>`);
  parts.push(`<circle cx="300" cy="330" r="182" fill="url(#${platter.id})"/>`);
  if (p.drive === "direct") {
    for (let i = 0; i < 72; i++) {
      const ang = (i * 5 * Math.PI) / 180;
      parts.push(`<rect x="${300 + Math.cos(ang) * 178 - 2}" y="${330 + Math.sin(ang) * 178 - 2}" width="4" height="4" fill="#4a4c50"/>`);
    }
  }
  parts.push(`<circle cx="300" cy="330" r="168" fill="url(#${vinyl.id})"/>`);
  for (let r = 70; r < 165; r += 7) {
    parts.push(`<circle cx="300" cy="330" r="${r}" fill="none" stroke="#3a3a3e" stroke-opacity="0.55" stroke-width="1"/>`);
  }
  parts.push(`<path d="M 200 220 A 150 150 0 0 1 410 230" stroke="#fff" stroke-opacity="0.12" stroke-width="22" fill="none"/>`);
  parts.push(`<circle cx="300" cy="330" r="58" fill="${p.label}"/><circle cx="300" cy="330" r="6" fill="#d9d9dc"/>` +
    `<text x="300" y="312" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#fff" opacity="0.85">${p.brand}</text>`);
  parts.push(`<circle cx="590" cy="180" r="34" fill="#2a2a2d" stroke="#000"/><circle cx="590" cy="180" r="14" fill="#9a9da2"/>`);
  parts.push(`<path d="M 590 180 L 610 420 L 420 470" stroke="#c9ccd1" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  parts.push(`<rect x="392" y="452" width="46" height="26" rx="4" transform="rotate(-18 415 465)" fill="#1d1d20"/>`);
  parts.push(`<rect x="560" y="200" width="16" height="70" rx="6" fill="#77797e"/>`);
  for (const [bx, on] of [[100, true], [150, false]]) {
    parts.push(`<rect x="${bx}" y="505" width="38" height="20" rx="5" fill="#1c1c1f"/>${on ? `<circle cx="${bx + 19}" cy="515" r="4" fill="#ff5a3c"/>` : ""}`);
  }
  if (p.drive === "belt") {
    parts.push(`<circle cx="120" cy="160" r="18" fill="#9da0a5"/><path d="M 120 142 C 220 140, 360 140, 300 148" stroke="#0a0a0a" stroke-width="3" fill="none" opacity="0.6"/>`);
  }
  return { svg: parts.join(""), focus: [300, 330] };
}

function plug(x, y, angle, p, color) {
  const metal = grad("metal", "#f1f2f4", "#8e9196");
  const body = p.connector === "xlr"
    ? `<rect x="-26" y="-60" width="52" height="96" rx="12" fill="url(#${metal.id})" stroke="#555"/>` +
      `<circle cx="0" cy="-60" r="24" fill="#2a2a2d"/><circle cx="-8" cy="-64" r="3" fill="#d8b46a"/><circle cx="8" cy="-64" r="3" fill="#d8b46a"/><circle cx="0" cy="-52" r="3" fill="#d8b46a"/>` +
      `<rect x="-26" y="20" width="52" height="8" fill="${color}"/>`
    : `<rect x="-20" y="-50" width="40" height="86" rx="8" fill="url(#${metal.id})" stroke="#555"/>` +
      `<rect x="-20" y="-6" width="40" height="8" fill="${color}"/>` +
      `<rect x="-12" y="-82" width="24" height="34" rx="3" fill="#d8b46a"/><rect x="-4" y="-98" width="8" height="20" rx="2" fill="#efd28e"/>`;
  return { def: metal.def, svg: `<g transform="translate(${x} ${y}) rotate(${angle})">${body}</g>` };
}

function cable(p, defs) {
  const parts = [];
  const len = p.short ? 0.7 : 1;
  const paths = [
    `M 130 ${470} C 260 ${260}, ${400 * len + 150} ${620}, ${560 * len + 80} ${330}`,
    `M 180 ${520} C 310 ${310}, ${450 * len + 150} ${670}, ${610 * len + 80} ${380}`,
  ];
  paths.forEach((d, i) => {
    parts.push(`<path d="${d}" stroke="#000" stroke-opacity="0.35" stroke-width="34" fill="none" stroke-linecap="round" transform="translate(6 10)"/>`);
    parts.push(`<path d="${d}" stroke="${p.jacket}" stroke-width="30" fill="none" stroke-linecap="round"/>`);
    parts.push(`<path d="${d}" stroke="${p.braid}" stroke-width="30" stroke-dasharray="6 6" fill="none" opacity="0.55"/>`);
    parts.push(`<path d="${d}" stroke="#fff" stroke-opacity="0.18" stroke-width="6" fill="none" transform="translate(-6 -8)"/>`);
    const color = p.accent[i];
    const a = plug(i === 0 ? 130 : 180, i === 0 ? 470 : 520, -125, p, color);
    const b = plug(i === 0 ? 560 * len + 80 : 610 * len + 80, i === 0 ? 330 : 380, 55, p, color);
    defs.push(a.def, b.def);
    parts.push(a.svg, b.svg);
  });
  return { svg: parts.join(""), focus: [150, 470] };
}

const DRAW = { integrated, tube, bookshelf, floor, turntable, cable };

// ---------- Ракурсы ----------

function hero(p) {
  uid = 0;
  const defs = [];
  const bg = studio(defs);
  const item = DRAW[p.kind](p, defs);
  // Рисунки ~760 в ширину: центрируем и чуть увеличиваем; напольные колонки и так высокие.
  const s = p.kind === "floor" ? 1 : 1.2;
  const centerY = p.kind === "floor" ? 327 : 330;
  return svg(defs, `${bg}<g transform="translate(${600 - 380 * s} ${(p.kind === "floor" ? 400 : 430) - centerY * s}) scale(${s})">${item.svg}</g>`);
}

function detail(p) {
  uid = 0;
  const defs = [];
  const bg = studio(defs);
  const item = DRAW[p.kind](p, defs);
  const [fx, fy] = item.focus;
  const s = 2.3;
  return svg(defs, `${bg}<g transform="translate(${600 - fx * s} ${450 - fy * s}) scale(${s})">${item.svg}</g>`);
}

function scene(p) {
  uid = 0;
  const defs = [];
  const onFloor = p.kind === "floor";
  const bg = room(defs, onFloor);
  const item = DRAW[p.kind](p, defs);
  // Напольные колонки стоят на полу, остальное — на комоде.
  const place = onFloor ? "translate(190 92)" : "translate(330 405) scale(0.72)";
  return svg(defs, `${bg}<g transform="${place}">${item.svg}</g>`);
}

mkdirSync(OUT, { recursive: true });
for (const p of PRODUCTS) {
  writeFileSync(join(OUT, `${p.slug}-1.svg`), hero(p));
  writeFileSync(join(OUT, `${p.slug}-2.svg`), detail(p));
  writeFileSync(join(OUT, `${p.slug}-3.svg`), scene(p));
}
console.log(`Готово: ${PRODUCTS.length * 3} файлов в ${OUT}`);
