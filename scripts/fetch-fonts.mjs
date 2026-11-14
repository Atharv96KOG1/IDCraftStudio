// Downloads open-licence fonts (SIL OFL / Apache 2.0) from Google Fonts so the
// app can use them offline. Run with:  node scripts/fetch-fonts.mjs
// Output: public/fonts/** (font files + fonts.css) and src/lib/fontCatalog.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const KEEP_SUBSETS = new Set(['latin', 'latin-ext', 'devanagari']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'fonts');

// [family, category]  — categories: sans, serif, display, script, mono, marathi
const FONTS = [
  // ---------- English: sans-serif ----------
  ...[
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Raleway', 'Nunito', 'Nunito Sans', 'PT Sans',
    'Source Sans 3', 'Ubuntu', 'Rubik', 'Work Sans', 'Fira Sans', 'Barlow', 'Barlow Condensed', 'Josefin Sans',
    'Quicksand', 'DM Sans', 'Manrope', 'Mulish', 'Kanit', 'Titillium Web', 'Noto Sans', 'Outfit', 'Plus Jakarta Sans',
    'Lexend', 'Sora', 'Space Grotesk', 'Archivo', 'Heebo', 'Karla', 'Cabin', 'Oxygen', 'Exo 2', 'Saira',
    'Varela Round', 'Comfortaa', 'Fredoka', 'Asap', 'Signika', 'Maven Pro', 'Catamaran', 'Red Hat Display', 'Figtree',
    'Urbanist', 'Libre Franklin', 'Overpass', 'Questrial', 'Encode Sans', 'Prompt', 'IBM Plex Sans',
    'Roboto Condensed', 'Oswald', 'Abel', 'Dosis', 'Play', 'Jost', 'Chivo', 'Assistant', 'Public Sans',
  ].map((f) => [f, 'sans']),
  // ---------- English: serif ----------
  ...[
    'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Libre Baskerville', 'EB Garamond', 'Crimson Text',
    'Cormorant Garamond', 'Noto Serif', 'Roboto Slab', 'Bitter', 'Arvo', 'Zilla Slab', 'Prata', 'Domine',
    'Source Serif 4', 'Alegreya', 'Cardo', 'Spectral', 'Vollkorn', 'Old Standard TT', 'Josefin Slab',
    'Libre Caslon Text', 'Frank Ruhl Libre', 'DM Serif Display', 'Cinzel', 'Rokkitt', 'Aleo', 'Crete Round',
    'Gelasio', 'Marcellus', 'Noticia Text', 'Cormorant',
  ].map((f) => [f, 'serif']),
  // ---------- English: display / headline ----------
  ...[
    'Bebas Neue', 'Anton', 'Archivo Black', 'Alfa Slab One', 'Abril Fatface', 'Bangers', 'Black Ops One',
    'Russo One', 'Orbitron', 'Passion One', 'Bungee', 'Lilita One', 'Luckiest Guy', 'Fjalla One', 'Staatliches',
    'Monoton', 'Audiowide', 'Concert One', 'Ultra', 'Titan One', 'Paytone One', 'Squada One', 'Chakra Petch',
    'Racing Sans One', 'Secular One', 'Carter One', 'Cinzel Decorative', 'Poiret One', 'Righteous', 'Lobster',
    'Yeseva One', 'Bowlby One SC', 'Teko', 'Rajdhani', 'Khand',
  ].map((f) => [f, 'display']),
  // ---------- English: script / handwriting / signature ----------
  ...[
    'Dancing Script', 'Pacifico', 'Great Vibes', 'Caveat', 'Satisfy', 'Courgette', 'Kaushan Script',
    'Permanent Marker', 'Shadows Into Light', 'Indie Flower', 'Amatic SC', 'Sacramento', 'Allura', 'Alex Brush',
    'Parisienne', 'Tangerine', 'Cookie', 'Yellowtail', 'Marck Script', 'Gloria Hallelujah', 'Patrick Hand',
    'Architects Daughter', 'Handlee', 'Rock Salt', 'Homemade Apple', 'Mr Dafoe', 'Pinyon Script', 'Italianno',
    'Herr Von Muellerhoff', 'Mrs Saint Delafield', 'Monsieur La Doulaise', 'Birthstone', 'Whisper', 'Lobster Two',
    'Playball', 'Damion', 'Norican', 'Kalam',
  ].map((f) => [f, 'script']),
  // ---------- English: monospace ----------
  ...[
    'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Inconsolata',
    'Courier Prime', 'Ubuntu Mono', 'Share Tech Mono',
  ].map((f) => [f, 'mono']),
  // ---------- Marathi / Devanagari ----------
  ...[
    'Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tiro Devanagari Marathi', 'Tiro Devanagari Hindi',
    'Tiro Devanagari Sanskrit', 'Mukta', 'Hind', 'Baloo 2', 'Martel', 'Martel Sans', 'Yatra One', 'Rozha One',
    'Sarpanch', 'Amita', 'Arya', 'Eczar', 'Gotu', 'Halant', 'Jaldi', 'Karma', 'Khula', 'Kurale', 'Laila',
    'Palanquin', 'Palanquin Dark', 'Sahitya', 'Sumana', 'Sura', 'Vesper Libre', 'Glegoo', 'Biryani', 'Modak',
    'Pragati Narrow', 'Sarala', 'Dekko', 'Kadwa', 'Cambay', 'Amiko', 'Inknut Antiqua', 'Tillana', 'Yantramanav',
    'Anek Devanagari', 'Akshar', 'Ranga', 'Asar', 'Rhodium Libre', 'Jaini', 'Jaini Purva', 'Kalam', 'Poppins',
    'Teko', 'Rajdhani', 'Khand',
  ].map((f) => [f, 'marathi']),
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function getCss(family) {
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  for (const q of [`${fam}:ital,wght@0,400;0,700;1,400;1,700`, `${fam}:wght@400;700`, fam]) {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${q}&display=swap`, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.text();
  }
  return null;
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  // Merge categories: one family can be both English and Marathi.
  const byFamily = new Map();
  for (const [f, cat] of FONTS) {
    const e = byFamily.get(f) ?? { family: f, categories: [] };
    if (!e.categories.includes(cat)) e.categories.push(cat);
    byFamily.set(f, e);
  }

  const css = [];
  const catalog = [];
  const failed = [];
  let bytes = 0;
  const entries = [...byFamily.values()];
  let i = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < entries.length) {
        const e = entries[i++];
        const text = await getCss(e.family);
        if (!text) {
          failed.push(e.family);
          continue;
        }
        const blocks = [...text.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*{[^}]+})/g)];
        const kept = blocks.filter(([, subset]) => KEEP_SUBSETS.has(subset));
        const dir = path.join(OUT, slug(e.family));
        await fs.mkdir(dir, { recursive: true });
        const subsets = new Set();
        const weights = new Set();
        let italic = false;
        let fontCss = '';
        for (const [, subset, block] of kept) {
          const url = block.match(/url\((https:[^)]+)\)/)[1];
          const file = `${slug(path.basename(new URL(url).pathname, '.woff2'))}-${subset}.woff2`;
          const target = path.join(dir, file);
          try {
            await fs.access(target);
          } catch {
            const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
            await fs.writeFile(target, buf);
            bytes += buf.length;
          }
          subsets.add(subset);
          weights.add(Number(block.match(/font-weight:\s*(\d+)/)[1]));
          if (/font-style:\s*italic/.test(block)) italic = true;
          fontCss += block.replace(url, `${slug(e.family)}/${file}`).replace(/font-display:\s*\w+;/, 'font-display: block;') + '\n';
        }
        if (!subsets.size) {
          failed.push(e.family);
          continue;
        }
        css.push({ family: e.family, css: fontCss });
        catalog.push({
          family: e.family,
          categories: e.categories,
          devanagari: subsets.has('devanagari'),
          bold: weights.has(700),
          italic,
        });
      }
    }),
  );

  css.sort((a, b) => a.family.localeCompare(b.family));
  catalog.sort((a, b) => a.family.localeCompare(b.family));
  await fs.writeFile(path.join(OUT, 'fonts.css'), css.map((c) => `/* ${c.family} */\n${c.css}`).join('\n'));
  await fs.writeFile(
    path.join(OUT, 'LICENSES.txt'),
    'The fonts in this folder are open-source fonts from Google Fonts (https://fonts.google.com),\n' +
      'licensed under the SIL Open Font License 1.1 or the Apache License 2.0, which allow\n' +
      'bundling and redistribution with software. Each font remains the property of its authors.\n\n' +
      catalog.map((c) => `- ${c.family}: https://fonts.google.com/specimen/${c.family.replace(/ /g, '+')}`).join('\n') +
      '\n',
  );
  await fs.writeFile(path.join(ROOT, 'src', 'lib', 'fontCatalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log(`fonts: ${catalog.length}, devanagari: ${catalog.filter((c) => c.devanagari).length}, downloaded ${(bytes / 1e6).toFixed(1)} MB`);
  if (failed.length) console.log('FAILED:', failed.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
