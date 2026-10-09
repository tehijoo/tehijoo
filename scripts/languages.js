// node scripts/languages.js <out.svg>
// Builds the "Most Used Languages" card for the profile README: sums the language bytes of every
// public, non-fork repo of the user (GitHub API), keeps the top languages, and draws an animated
// SVG. Run daily by .github/workflows/languages.yml (Node 22, no npm packages needed).
const fs = require('fs');
const path = require('path');

const USER = process.env.GH_USER || 'tehijoo';
const TOKEN = process.env.GITHUB_TOKEN || '';
const OUT = process.argv[2] || 'dist/languages.svg';

const TOP = 6;
const EXCLUDE = [];
const USE_LANGUAGE_COLORS = false;

const C = {
  bg1: '#170a14', bg2: '#2a0b24', accent: '#f472b6', deep: '#c026d3',
  text: '#fce7f3', muted: '#f9a8d4', track: '#3a1232',
};
const MONO = "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace";

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Kotlin: '#A97BFF', Java: '#b07219',
  PHP: '#4F5D95', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c', Dart: '#00B4AB', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Go: '#00ADD8', Vue: '#41b883', Blade: '#f7523f', Shell: '#89e051',
  'Jupyter Notebook': '#DA5B0B',
};
const DEVICON = {
  JavaScript: 'javascript/javascript-original', TypeScript: 'typescript/typescript-original',
  Python: 'python/python-original', Kotlin: 'kotlin/kotlin-original', Java: 'java/java-original',
  PHP: 'php/php-original', HTML: 'html5/html5-original', CSS: 'css3/css3-original', SCSS: 'sass/sass-original',
  Dart: 'dart/dart-original', 'C++': 'cplusplus/cplusplus-original', C: 'c/c-original', 'C#': 'csharp/csharp-original',
  Go: 'go/go-original', Vue: 'vuejs/vuejs-original', Blade: 'laravel/laravel-original', Shell: 'bash/bash-original',
  'Jupyter Notebook': 'jupyter/jupyter-original',
};

async function api(url) {
  const res = await fetch(`https://api.github.com${url}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tehijoo-profile-languages',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function icon(lang) {
  if (!DEVICON[lang]) return null;
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${DEVICON[lang]}.svg`);
    if (!res.ok) return null;
    return `data:image/svg+xml;base64,${Buffer.from(await res.text()).toString('base64')}`;
  } catch {
    return null;
  }
}

async function collect() {
  const repos = (await api(`/users/${USER}/repos?per_page=100&type=owner`))
    .filter((r) => !r.fork && r.name.toLowerCase() !== USER.toLowerCase());
  const totals = {};
  for (const r of repos) {
    const langs = await api(`/repos/${r.full_name}/languages`);
    for (const [lang, bytes] of Object.entries(langs)) {
      if (EXCLUDE.includes(lang)) continue;
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }));
  return { repos: repos.length, top };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(top, icons) {
  const W = 900;
  const ROW_START = 150;
  const ROW_H = 60;
  const BAR_X = 80;
  const BAR_W = 690;
  const H = ROW_START + top.length * ROW_H + 52;
  const max = top.length ? top[0].pct : 1;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).toUpperCase();
  const glow = (id, sd) => `<filter id="${id}" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  const rows = top.map((l, i) => {
    const y = ROW_START + i * ROW_H;
    const barY = y + 12;
    const w = Math.max(6, (l.pct / max) * BAR_W);
    const color = USE_LANGUAGE_COLORS ? (LANG_COLORS[l.name] || C.accent) : null;
    const fill = color || 'url(#bar)';
    const delay = 0.3 + i * 0.15;
    const total = delay + 1.6;
    const kt = `0;${(delay / total).toFixed(3)};1`;
    const grow = (attr, from, to) => `<animate attributeName="${attr}" values="${from};${from};${to}" keyTimes="${kt}" dur="${total.toFixed(2)}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>`;
    return `
<g>
<circle cx="88" cy="${y - 5}" r="5" fill="${color || C.accent}" filter="url(#g)"/>
<text x="102" y="${y}" font-family="${MONO}" font-size="13" letter-spacing="3" fill="${C.muted}">${esc(l.name.toUpperCase())}</text>
<text x="${BAR_X + BAR_W}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="15" font-weight="700" fill="${C.text}">${l.pct.toFixed(1)}%</text>
${icons[i] ? `<image href="${icons[i]}" x="${BAR_X + BAR_W + 22}" y="${y - 21}" width="30" height="30"/>` : ''}
<rect x="${BAR_X}" y="${barY}" width="${BAR_W}" height="10" rx="5" fill="${C.track}"/>
<rect x="${BAR_X}" y="${barY}" width="${w.toFixed(1)}" height="10" rx="5" fill="${fill}" filter="url(#gs)">${grow('width', 0, w.toFixed(1))}</rect>
<clipPath id="c${i}"><rect x="${BAR_X}" y="${barY}" width="${w.toFixed(1)}" height="10" rx="5"/></clipPath>
<g clip-path="url(#c${i})"><rect x="${BAR_X - 120}" y="${barY}" width="110" height="10" fill="url(#shine)"><animate attributeName="x" values="${BAR_X - 120};${BAR_X + w}" dur="2.6s" begin="${(total + i * 0.4).toFixed(2)}s" repeatCount="indefinite"/></rect></g>
<circle cx="${(BAR_X + w).toFixed(1)}" cy="${barY + 5}" r="4.5" fill="#ffffff" filter="url(#g)">${grow('cx', BAR_X, (BAR_X + w).toFixed(1))}<animate attributeName="r" values="4.5;3;4.5" dur="1.8s" repeatCount="indefinite"/></circle>
</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Most used languages">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
<radialGradient id="halo" cx=".5" cy="0" r=".6"><stop offset="0" stop-color="${C.deep}" stop-opacity=".28"/><stop offset="1" stop-color="${C.deep}" stop-opacity="0"/></radialGradient>
<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.deep}"/><stop offset=".5" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>
<linearGradient id="bar" gradientUnits="userSpaceOnUse" x1="${BAR_X}" y1="0" x2="${BAR_X + BAR_W}" y2="0"><stop offset="0" stop-color="${C.deep}"/><stop offset="1" stop-color="${C.accent}"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>
<pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="${C.accent}" stroke-width=".5" opacity=".06"/></pattern>
${glow('g', 2.4)}
${glow('gs', 1.6)}
</defs>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="22" fill="url(#bg)"/>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="22" fill="url(#grid)"/>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="22" fill="url(#halo)"/>
<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="22" fill="none" stroke="url(#edge)" stroke-width="2" filter="url(#g)"><animate attributeName="opacity" values=".55;1;.55" dur="3.2s" repeatCount="indefinite"/></rect>
<text x="${W / 2}" y="72" text-anchor="middle" font-family="${MONO}" font-size="27" font-weight="700" letter-spacing="8" fill="${C.text}" filter="url(#g)">MOST USED LANGUAGES</text>
<rect x="${W / 2 - 60}" y="86" width="120" height="3" rx="1.5" fill="${C.accent}" filter="url(#g)"><animate attributeName="width" values="60;120;60" dur="3s" repeatCount="indefinite"/><animate attributeName="x" values="${W / 2 - 30};${W / 2 - 60};${W / 2 - 30}" dur="3s" repeatCount="indefinite"/></rect>
<rect x="${BAR_X}" y="112" width="${BAR_W + 52}" height="1.2" fill="url(#rule)"/>
<circle cx="${BAR_X}" cy="112.6" r="2.4" fill="${C.accent}" filter="url(#g)"><animate attributeName="cx" values="${BAR_X};${BAR_X + BAR_W + 52};${BAR_X}" dur="6s" repeatCount="indefinite"/></circle>
${rows}
<text x="${W / 2}" y="${H - 26}" text-anchor="middle" font-family="${MONO}" font-size="11" letter-spacing="3" fill="${C.muted}" opacity=".85">AUTO-UPDATED DAILY // ${date}<tspan fill="${C.accent}">_<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan></text>
</svg>
`;
}

(async () => {
  const { repos, top } = await collect();
  const icons = await Promise.all(top.map((l) => icon(l.name)));
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(OUT, render(top, icons));
  console.log(`${OUT}: ${repos} repo, ${top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
