/**
 * Marathi text helpers:
 *  - toKrutiDev(): converts Unicode Devanagari to the Kruti Dev 010 key layout,
 *    so text shows correctly in legacy (non-Unicode) fonts like "Kruti Dev 010".
 *  - toMarathi(): approximate English → Marathi (Devanagari) transliteration of
 *    names/addresses, meant as a starting point the user checks and corrects.
 */

const DEV_DIGITS = '०१२३४५६७८९';
const isConsonant = (c: string | undefined) => !!c && /[क-हक़-य़ळ]/.test(c);
const MATRAS = 'ािीुूृेैोौंँॅॉ';

// ---------- Unicode → Kruti Dev 010 ----------

const FULL: Record<string, string> = {
  क: 'd', ख: '[k', ग: 'x', घ: '?k', ङ: '³', च: 'p', छ: 'N', ज: 't', झ: '>', ञ: '¥',
  ट: 'V', ठ: 'B', ड: 'M', ढ: '<', ण: '.k', त: 'r', थ: 'Fk', द: 'n', ध: '/k', न: 'u',
  प: 'i', फ: 'Q', ब: 'c', भ: 'Hk', म: 'e', य: ';', र: 'j', ल: 'y', व: 'o', श: "'k",
  ष: '"k', स: 'l', ह: 'g', ळ: 'G',
};
const HALF: Record<string, string> = {
  क: 'D', ख: '[', ग: 'X', घ: '?', च: 'P', ज: 'T', ण: '.', त: 'R', थ: 'F', ध: '/', न: 'U',
  प: 'I', ब: 'C', भ: 'H', म: 'E', य: '¸', ल: 'Y', व: 'O', श: "'", ष: '"', स: 'L',
};
/** Special conjuncts and pairs, longest first. */
const SPECIAL: [string, string][] = [
  ['क्ष्', '{'], ['क्ष', '{k'], ['त्र', '='], ['ज्ञ', 'K'], ['श्र', 'J'], ['क्र', 'Ø'], ['द्र', 'æ'],
  ['ट्र', 'Vª'], ['ड्र', 'Mª'], ['द्ध', ')'], ['द्व', '}'], ['द्य', '|'], ['ह्म', 'ã'], ['ह्य', 'á'],
  ['रु', ':'], ['रू', '#'],
];
const SINGLE: Record<string, string> = {
  अ: 'v', आ: 'vk', इ: 'b', ई: 'bZ', उ: 'm', ऊ: 'Å', ऋ: '_', ए: ',', ऐ: ',s', ओ: 'vks', औ: 'vkS', ऑ: 'vkW',
  'ा': 'k', 'ि': 'f', 'ी': 'h', 'ु': 'q', 'ू': 'w', 'ृ': '`', 'े': 's', 'ै': 'S', 'ो': 'ks', 'ौ': 'kS', 'ॉ': 'kW',
  'ं': 'a', 'ँ': '¡', 'ः': '%', '्': '~', '़': '+', '।': 'A', '॥': 'AA',
  ',': ']', '.': '-', '-': '&', '/': '@', '?': '\\', '(': '¼', ')': '½', ':': '%',
};
const REPH = '';

export function toKrutiDev(input: string): string {
  let s = input.normalize('NFC').replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
  const chars = [...s];

  // 1. Reph: "र्" before a consonant is written as "Z" after the syllable (and its vowel signs).
  for (let i = 0; i < chars.length - 2; i++) {
    if (chars[i] === 'र' && chars[i + 1] === '्' && isConsonant(chars[i + 2]) && !(i > 0 && chars[i - 1] === '्')) {
      chars.splice(i, 2);
      let j = i;
      while (j < chars.length && isConsonant(chars[j])) {
        j++;
        if (chars[j] === '़') j++;
        if (chars[j] === '्' && isConsonant(chars[j + 1])) j++;
        else break;
      }
      while (j < chars.length && MATRAS.includes(chars[j])) j++;
      chars.splice(j, 0, REPH);
    }
  }
  // 2. The "ि" sign is typed before the whole consonant cluster.
  for (let i = 1; i < chars.length; i++) {
    if (chars[i] !== 'ि') continue;
    let start = i - 1;
    if (chars[start] === '़') start--;
    while (start >= 2 && chars[start - 1] === '्' && isConsonant(chars[start - 2])) start -= 2;
    if (!isConsonant(chars[start])) continue;
    chars.splice(i, 1);
    chars.splice(start, 0, 'ि');
  }
  s = chars.join('');

  // 3. Character mapping (longest match first).
  let out = '';
  for (let i = 0; i < s.length; ) {
    const sp = SPECIAL.find(([u]) => s.startsWith(u, i));
    if (sp) {
      out += sp[1];
      i += sp[0].length;
      continue;
    }
    const c = s[i];
    if (c === REPH) {
      out += 'Z';
      i++;
      continue;
    }
    if (FULL[c]) {
      if (s[i + 1] === '्' && s[i + 2] === 'र') {
        out += FULL[c] + 'z';
        i += 3;
      } else if (s[i + 1] === '्' && isConsonant(s[i + 2])) {
        out += HALF[c] ?? FULL[c] + '~';
        i += 2;
      } else {
        out += FULL[c];
        i++;
      }
      continue;
    }
    out += SINGLE[c] ?? c;
    i++;
  }
  return out;
}

/** Font names that use the Kruti Dev layout. */
export const isKrutiFont = (family: string) => /kruti|k010|krutidev/i.test(family);

// ---------- English → Marathi (approximate) ----------

const T_CONS: [string, string][] = [
  ['ksh', 'क्ष'], ['chh', 'छ'], ['gy', 'ज्ञ'], ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'],
  ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['ck', 'क'], ['k', 'क'], ['g', 'ग'], ['c', 'क'], ['j', 'ज'], ['t', 'त'], ['d', 'द'],
  ['n', 'न'], ['p', 'प'], ['f', 'फ'], ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'],
  ['s', 'स'], ['h', 'ह'], ['z', 'झ'], ['x', 'क्स'], ['q', 'क'],
];
const T_VOW: [string, string, string][] = [
  // latin, independent, sign
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ou', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ii', 'ई', 'ी'], ['oo', 'ऊ', 'ू'],
  ['uu', 'ऊ', 'ू'], ['a', 'अ', ''], ['i', 'इ', 'ि'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो'], ['u', 'उ', 'ु'],
];

/** Two consonants written as a conjunct (otherwise an "a" sound is assumed between them). */
function joins(a: string, b: string, i: number, s: string): boolean {
  if (a === b) return i + b.length < s.length; // "tt" → त्त, but a final "ss" is just स
  if (['r', 'y', 'v', 'w'].includes(b)) return true;
  if (b === 'l' && ['c', 'k', 'p', 'b', 'g', 'f'].includes(a)) return true;
  return ['r', 's', 'sh'].includes(a);
}

function wordToMarathi(w: string): string {
  const s = w.toLowerCase();
  let out = '';
  let prev = '';
  for (let i = 0; i < s.length; ) {
    const v = T_VOW.find(([l]) => s.startsWith(l, i));
    if (v) {
      const atEnd = i + v[0].length === s.length;
      if (prev) {
        let sign = v[2];
        if (atEnd && s.length > 2 && v[0] === 'a') sign = 'ा';
        if (atEnd && s.length > 2 && v[0] === 'i') sign = 'ी';
        if (atEnd && s.length > 2 && v[0] === 'u') sign = 'ू';
        out += sign;
      } else out += v[1];
      prev = '';
      i += v[0].length;
      continue;
    }
    let c = T_CONS.find(([l]) => s.startsWith(l, i));
    if (c) {
      if (c[0] === 'c' && /[eiy]/.test(s[i + 1] ?? '')) c = ['c', 'स'];
      const next = s.slice(i + c[0].length);
      const nextCons = next.length > 0 && !T_VOW.some(([l]) => next.startsWith(l)) ? T_CONS.find(([l]) => next.startsWith(l))?.[0] : undefined;
      if (prev === c[0] && !next) {
        i += c[0].length; // final double letter
        continue;
      }
      if (prev && joins(prev, c[0], i, s)) out += '्';
      if ((c[0] === 'n' || c[0] === 'm') && nextCons && !['y', 'r', 'v', 'w', 'n', 'm', 'h'].includes(nextCons) && out) {
        out += 'ं';
        prev = '';
      } else {
        out += c[1];
        prev = c[0];
      }
      i += c[0].length;
      continue;
    }
    out += s[i];
    prev = '';
    i++;
  }
  return out;
}

/** Approximate transliteration; text already in Devanagari is left as it is. */
export function toMarathi(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => wordToMarathi(w)).replace(/[0-9]/g, (d) => DEV_DIGITS[Number(d)]);
}
