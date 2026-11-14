/**
 * Offline template generator. Reads a plain-language request (English or
 * Marathi), works out the card type, language, colours, style and parts, then
 * builds several distinct designs from layout recipes. Runs fully on the PC.
 */
import { makeElement as el } from './elements';
import type { CardElement, CardSide, Template } from './types';
import { uid } from './utils';

export type Kind = 'school' | 'college' | 'corporate' | 'event' | 'medical' | 'member' | 'press' | 'security' | 'visitor';
export type Lang = 'en' | 'mr';
export type Style = 'modern' | 'classic' | 'minimal' | 'bold' | 'dark';
export type CodeType = 'barcode' | 'qr' | 'both' | 'none';

export interface Brief {
  kind: Kind;
  lang: Lang;
  portrait: boolean;
  color: string;
  style: Style;
  code: CodeType;
  orgName: string;
  extras: { blood: boolean; emergency: boolean; address: boolean; validity: boolean; signature: boolean };
}

// ------------------------------------------------------------ understanding the request

const KIND_WORDS: [Kind, RegExp][] = [
  ['college', /college|university|campus|महाविद्यालय|कॉलेज|विद्यापीठ/i],
  ['school', /\b(school|student|pupil|class)\b|शाळा|विद्यार्थी|शालेय/i],
  ['medical', /hospital|clinic|medical|doctor|nurse|health|रुग्णालय|दवाखाना|डॉक्टर|वैद्यकीय/i],
  ['event', /\b(event|conference|seminar|expo|festival|summit|workshop|pass|delegate)\b|कार्यक्रम|परिषद|उत्सव|पास/i],
  ['press', /\b(press|media|reporter|journalist)\b|पत्रकार|प्रेस/i],
  ['security', /security|guard|सुरक्षा/i],
  ['visitor', /visitor|guest|अभ्यागत|पाहुणे/i],
  ['member', /\b(member|gym|club|library|society|membership)\b|सदस्य|मंडळ|ग्रंथालय/i],
  ['corporate', /employee|company|office|corporate|staff|business|कर्मचारी|कंपनी|कार्यालय/i],
];

const COLORS: [RegExp, string][] = [
  [/\bnavy\b|नेव्ही/i, '#1e3a8a'],
  [/\bsky\b|आकाशी/i, '#0284c7'],
  [/teal|turquoise/i, '#0f766e'],
  [/\bblue\b|निळा|निळ्या|निळी/i, '#1d4ed8'],
  [/maroon|wine|मरून/i, '#881337'],
  [/\bred\b|लाल/i, '#dc2626'],
  [/dark green|olive/i, '#166534'],
  [/\bgreen\b|हिरवा|हिरव्या|हिरवी/i, '#15803d'],
  [/saffron|bhagwa|केशरी|भगवा/i, '#ea580c'],
  [/orange|नारंगी/i, '#f97316'],
  [/purple|violet|जांभळा|जांभळ्या/i, '#7c3aed'],
  [/\bpink\b|गुलाबी/i, '#db2777'],
  [/\bgold(en)?\b|सोनेरी/i, '#b45309'],
  [/yellow|पिवळा|पिवळ्या/i, '#ca8a04'],
  [/brown|तपकिरी/i, '#78350f'],
  [/\bblack\b|काळा|काळ्या/i, '#111827'],
  [/gr[ae]y|राखाडी/i, '#475569'],
];

const DEFAULT_COLOR: Record<Kind, string> = {
  school: '#15803d', college: '#1e3a8a', corporate: '#1d4ed8', event: '#7c3aed', medical: '#0f766e',
  member: '#db2777', press: '#dc2626', security: '#111827', visitor: '#ea580c',
};

export function understand(text: string): Brief {
  const t = text.trim();
  const kind = KIND_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'corporate';
  const lang: Lang = /marathi|मराठी/i.test(t) || /[ऀ-ॿ]/.test(t) ? 'mr' : 'en';
  const portrait = /portrait|vertical|उभे|उभा/i.test(t)
    ? true
    : /landscape|horizontal|आडवे|आडवा/i.test(t)
      ? false
      : ['school', 'event', 'press', 'visitor', 'member'].includes(kind);
  const color = COLORS.find(([re]) => re.test(t))?.[1] ?? DEFAULT_COLOR[kind];
  const style: Style = /dark|night|गडद/i.test(t)
    ? 'dark'
    : /classic|elegant|formal|royal|traditional|पारंपरिक/i.test(t)
      ? 'classic'
      : /minimal|simple|clean|साधे|साधा/i.test(t)
        ? 'minimal'
        : /bold|vibrant|colorful|colourful|bright|आकर्षक/i.test(t)
          ? 'bold'
          : 'modern';
  const wantsQr = /\bqr\b|क्यूआर/i.test(t);
  const wantsBar = /barcode|बारकोड/i.test(t);
  const code: CodeType = wantsQr && wantsBar ? 'both' : wantsQr ? 'qr' : wantsBar ? 'barcode' : /no code|without code/i.test(t) ? 'none' : kind === 'event' || kind === 'visitor' ? 'qr' : 'barcode';
  const quoted = t.match(/["“'‘]([^"”'’]{2,60})["”'’]/)?.[1];
  const named = t.match(/(?:for|of|named|called)\s+([A-Z][\w&.\- ]{2,50}?)(?:\s+(?:with|in|and|using|,)|[.,]|$)/)?.[1];
  return {
    kind,
    lang,
    portrait,
    color,
    style,
    code,
    orgName: (quoted ?? named ?? '').trim(),
    extras: {
      blood: /blood|रक्त/i.test(t) || ['school', 'corporate', 'medical', 'security'].includes(kind),
      emergency: /emergency|आपत्कालीन/i.test(t) || ['school', 'corporate', 'medical'].includes(kind),
      address: /address|पत्ता/i.test(t) || ['school', 'college'].includes(kind),
      validity: /valid|expiry|expire|वैध/i.test(t) || ['member', 'visitor', 'press', 'college'].includes(kind),
      signature: !/no sign/i.test(t),
    },
  };
}

// ------------------------------------------------------------ wording

interface Wording {
  org: string;
  title: string;
  /** [label, fieldKey] pairs shown on the front, most important first. */
  front: [string, string][];
  back: [string, string][];
  nameField: string;
  codeField: string;
  returnTitle: string;
  returnText: string;
  sign: string;
}

function wording(b: Brief): Wording {
  const mr = b.lang === 'mr';
  const L = (en: string, m: string) => (mr ? m : en);
  const name = L('Name', 'नाव');
  const orgDefault: Record<Kind, [string, string]> = {
    school: ['YOUR SCHOOL NAME', 'शाळेचे नाव'],
    college: ['YOUR COLLEGE NAME', 'महाविद्यालयाचे नाव'],
    corporate: ['YOUR COMPANY', 'कंपनीचे नाव'],
    event: ['EVENT NAME 2026', 'कार्यक्रमाचे नाव'],
    medical: ['CITY HOSPITAL', 'रुग्णालयाचे नाव'],
    member: ['YOUR CLUB', 'मंडळाचे नाव'],
    press: ['NEWS NETWORK', 'वृत्तसंस्थेचे नाव'],
    security: ['SECURITY SERVICES', 'सुरक्षा सेवा'],
    visitor: ['YOUR ORGANISATION', 'संस्थेचे नाव'],
  };
  const titles: Record<Kind, [string, string]> = {
    school: ['Student Identity Card', 'विद्यार्थी ओळखपत्र'],
    college: ['Student Identity Card', 'विद्यार्थी ओळखपत्र'],
    corporate: ['Employee Identity Card', 'कर्मचारी ओळखपत्र'],
    event: ['Delegate Pass', 'प्रवेश पास'],
    medical: ['Staff Identity Card', 'कर्मचारी ओळखपत्र'],
    member: ['Membership Card', 'सदस्यत्व कार्ड'],
    press: ['PRESS', 'प्रेस ओळखपत्र'],
    security: ['Security Staff', 'सुरक्षा कर्मचारी'],
    visitor: ['VISITOR', 'अभ्यागत पास'],
  };
  const F: Record<Kind, [string, string][]> = {
    school: [[L('Class', 'इयत्ता'), L('Class', 'इयत्ता')], [L('Roll No', 'हजेरी क्रमांक'), L('RollNo', 'हजेरी क्रमांक')], [L('DOB', 'जन्मतारीख'), L('DOB', 'जन्मतारीख')]],
    college: [[L('Course', 'अभ्यासक्रम'), L('Course', 'अभ्यासक्रम')], [L('Student ID', 'विद्यार्थी क्रमांक'), L('StudentID', 'विद्यार्थी क्रमांक')], [L('Year', 'वर्ष'), L('Year', 'वर्ष')]],
    corporate: [[L('Designation', 'पद'), L('Designation', 'पद')], [L('Employee ID', 'कर्मचारी क्रमांक'), L('EmployeeID', 'कर्मचारी क्रमांक')], [L('Department', 'विभाग'), L('Department', 'विभाग')]],
    event: [[L('Organisation', 'संस्था'), L('Organization', 'संस्था')], [L('Role', 'भूमिका'), L('Role', 'भूमिका')], [L('Pass ID', 'पास क्रमांक'), L('PassID', 'पास क्रमांक')]],
    medical: [[L('Designation', 'पद'), L('Designation', 'पद')], [L('Department', 'विभाग'), L('Department', 'विभाग')], [L('Staff ID', 'कर्मचारी क्रमांक'), L('StaffID', 'कर्मचारी क्रमांक')]],
    member: [[L('Member ID', 'सदस्य क्रमांक'), L('MemberID', 'सदस्य क्रमांक')], [L('Plan', 'योजना'), L('Plan', 'योजना')], [L('Phone', 'मोबाईल'), L('Phone', 'मोबाईल')]],
    press: [[L('Organisation', 'संस्था'), L('Organization', 'संस्था')], [L('Press ID', 'प्रेस क्रमांक'), L('PressID', 'प्रेस क्रमांक')]],
    security: [[L('Designation', 'पद'), L('Designation', 'पद')], [L('Guard ID', 'ओळख क्रमांक'), L('GuardID', 'ओळख क्रमांक')], [L('Site', 'ठिकाण'), L('Site', 'ठिकाण')]],
    visitor: [[L('Company', 'संस्था'), L('Company', 'संस्था')], [L('To meet', 'भेटण्यासाठी'), L('ToMeet', 'भेटण्यासाठी')], [L('Date', 'दिनांक'), L('Date', 'दिनांक')]],
  };
  const front = F[b.kind];
  const back: [string, string][] = [];
  if (b.extras.blood) back.push([L('Blood Group', 'रक्तगट'), L('BloodGroup', 'रक्तगट')]);
  if (b.kind === 'school') back.push([L('Parent', 'पालकाचे नाव'), L('ParentName', 'पालकाचे नाव')]);
  if (b.extras.emergency) back.push([L('Emergency', 'आपत्कालीन संपर्क'), L('EmergencyContact', 'आपत्कालीन संपर्क')]);
  else back.push([L('Phone', 'मोबाईल'), L('Phone', 'मोबाईल')]);
  if (b.extras.validity) back.push([L('Valid till', 'वैधता'), L('ValidTill', 'वैधता')]);
  if (b.extras.address) back.push([L('Address', 'पत्ता'), L('Address', 'पत्ता')]);
  const codeField = front.find(([, f]) => /ID|No|क्रमांक/.test(f))?.[1] ?? 'Serial';
  return {
    org: b.orgName || L(orgDefault[b.kind][0], orgDefault[b.kind][1]),
    title: L(titles[b.kind][0], titles[b.kind][1]),
    front,
    back,
    nameField: name,
    codeField,
    returnTitle: L('If found, please return to:', 'सापडल्यास कृपया परत करा:'),
    returnText: L('Organisation address line 1\nCity, State – PIN\nPhone: +91 00000 00000', 'संस्थेचा पत्ता\nशहर, जिल्हा – पिन\nफोन: +९१ ००००० ०००००'),
    sign: L('Authorised Signatory', 'अधिकृत स्वाक्षरी'),
  };
}

// ------------------------------------------------------------ colour & type

function hexToHsl(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

interface Palette {
  primary: string;
  dark: string;
  light: string;
  accent: string;
  bg: string;
  text: string;
  muted: string;
  onPrimary: string;
}

function palette(base: string, style: Style, variant: number): Palette {
  const [h, s, l] = hexToHsl(base);
  const hue = h + [0, -12, 14, 0, 8, -8][variant % 6];
  const primary = hsl(hue, Math.max(s, 0.45), Math.min(Math.max(l, 0.25), 0.45));
  const accentHue = [h + 35, h + 180, h - 40, h + 150, h + 25, h + 200][variant % 6];
  const accent = s < 0.15 ? '#f59e0b' : hsl(accentHue, 0.85, 0.55);
  if (style === 'dark') {
    return { primary: hsl(hue, 0.7, 0.55), dark: hsl(hue, 0.5, 0.1), light: hsl(hue, 0.3, 0.18), accent, bg: '#0f172a', text: '#f8fafc', muted: '#cbd5e1', onPrimary: '#ffffff' };
  }
  return {
    primary,
    dark: hsl(hue, Math.max(s, 0.45), 0.2),
    light: hsl(hue, 0.6, 0.95),
    accent,
    bg: style === 'classic' ? hsl(hue, 0.35, 0.975) : '#ffffff',
    text: '#0f172a',
    muted: '#475569',
    onPrimary: '#ffffff',
  };
}

interface Fonts {
  head: string;
  body: string;
}

function fonts(b: Brief, variant: number): Fonts {
  if (b.lang === 'mr') {
    const sets: Record<Style, Fonts[]> = {
      modern: [{ head: 'Baloo 2', body: 'Mukta' }, { head: 'Poppins', body: 'Hind' }, { head: 'Anek Devanagari', body: 'Mukta' }],
      classic: [{ head: 'Tiro Devanagari Marathi', body: 'Noto Serif Devanagari' }, { head: 'Rozha One', body: 'Martel' }, { head: 'Kurale', body: 'Martel' }],
      minimal: [{ head: 'Mukta', body: 'Mukta' }, { head: 'Noto Sans Devanagari', body: 'Noto Sans Devanagari' }, { head: 'Hind', body: 'Hind' }],
      bold: [{ head: 'Yatra One', body: 'Baloo 2' }, { head: 'Teko', body: 'Mukta' }, { head: 'Rozha One', body: 'Poppins' }],
      dark: [{ head: 'Baloo 2', body: 'Mukta' }, { head: 'Teko', body: 'Hind' }, { head: 'Poppins', body: 'Mukta' }],
    };
    return sets[b.style][variant % 3];
  }
  const sets: Record<Style, Fonts[]> = {
    modern: [{ head: 'Montserrat', body: 'Inter' }, { head: 'Poppins', body: 'Poppins' }, { head: 'Outfit', body: 'DM Sans' }],
    classic: [{ head: 'Playfair Display', body: 'Lora' }, { head: 'Cinzel', body: 'EB Garamond' }, { head: 'DM Serif Display', body: 'Source Serif 4' }],
    minimal: [{ head: 'Inter', body: 'Inter' }, { head: 'Manrope', body: 'Manrope' }, { head: 'Work Sans', body: 'Work Sans' }],
    bold: [{ head: 'Bebas Neue', body: 'Roboto' }, { head: 'Anton', body: 'Barlow' }, { head: 'Archivo Black', body: 'Archivo' }],
    dark: [{ head: 'Space Grotesk', body: 'Inter' }, { head: 'Sora', body: 'Sora' }, { head: 'Orbitron', body: 'Exo 2' }],
  };
  return sets[b.style][variant % 3];
}

// ------------------------------------------------------------ layout recipes

interface Ctx {
  b: Brief;
  w: Wording;
  p: Palette;
  f: Fonts;
  W: number;
  H: number;
}

const T = (c: Ctx, text: string, x: number, y: number, w: number, h: number, o: Record<string, unknown> = {}) =>
  el('text', { text, x, y, w, h, fontFamily: c.f.body, fontSize: 8, color: c.p.text, ...o });

function infoLines(c: Ctx, x: number, y: number, w: number, step: number, align: 'left' | 'center', max = 3): CardElement[] {
  return c.w.front.slice(0, max).map(([label, field], i) =>
    T(c, `${label}: {{${field}}}`, x, y + i * step, w, step, { fontSize: c.b.lang === 'mr' ? 8 : 7.5, color: c.p.muted, align, name: label }),
  );
}

function code(c: Ctx, area: { x: number; y: number; w: number; h: number }): CardElement[] {
  const value = `{{${c.w.codeField}}}`;
  const color = c.b.style === 'dark' ? '#ffffff' : '#000000';
  if (c.b.code === 'none') return [];
  if (c.b.code === 'qr') {
    const s = Math.min(area.w, area.h);
    return [el('qr', { x: area.x + (area.w - s) / 2, y: area.y + (area.h - s) / 2, w: s, h: s, value: '{{AllDetails}}', color: '#000000', background: '#ffffff' })];
  }
  return [el('barcode', { ...area, value, showText: area.h >= 9, color })];
}

const nameText = (c: Ctx, x: number, y: number, w: number, h: number, align: 'left' | 'center', size = 12, color?: string) =>
  T(c, `{{${c.w.nameField}}}`, x, y, w, h, { name: 'Name', fontFamily: c.f.head, fontSize: size, bold: true, align, autoShrink: true, color: color ?? c.p.text });

type Recipe = { name: string; front: (c: Ctx) => CardSide };

const LANDSCAPE: Recipe[] = [
  {
    name: 'Header band',
    front: (c) => ({
      background: c.p.bg,
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Header', x: 0, y: 0, w: c.W, h: 13, fill: c.p.primary }),
        el('rect', { name: 'Accent', x: 0, y: 13, w: c.W, h: 1.2, fill: c.p.accent }),
        el('ellipse', { name: 'Logo', x: 4, y: 2, w: 9, h: 9, fill: '#ffffff' }),
        T(c, c.w.org, 16, 1.2, 66, 7, { name: 'Organisation', fontFamily: c.f.head, fontSize: 11, bold: true, color: c.p.onPrimary, autoShrink: true }),
        T(c, c.w.title, 16, 7.6, 66, 4.5, { name: 'Title', fontSize: 6.5, color: c.p.light }),
        el('photo', { x: 4.5, y: 17.5, w: 22, h: 28, radius: 1.5, borderColor: c.p.primary, borderWidth: 0.4 }),
        nameText(c, 30, 17, 52, 7, 'left'),
        ...infoLines(c, 30, 24.5, 52, 4.6, 'left'),
        ...code(c, c.b.code === 'qr' ? { x: 68, y: 37, w: 13, h: 12 } : { x: 30, y: 39, w: 40, h: 8 }),
        el('rect', { name: 'Footer', x: 0, y: 50.5, w: c.W, h: c.H - 50.5, fill: c.p.primary }),
      ],
    }),
  },
  {
    name: 'Side panel',
    front: (c) => ({
      background: c.p.bg,
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Side panel', x: 0, y: 0, w: 30, h: c.H, fill: c.p.primary }),
        el('rect', { name: 'Accent', x: 30, y: 0, w: 1.2, h: c.H, fill: c.p.accent }),
        el('photo', { x: 4, y: 9, w: 22, h: 28, radius: 2, borderColor: '#ffffff', borderWidth: 0.7 }),
        T(c, c.w.title, 2, 40, 26, 9, { name: 'Title', fontSize: 6.5, color: c.p.onPrimary, align: 'center', bold: true, vAlign: 'top' }),
        T(c, c.w.org, 35, 3, 47, 7, { name: 'Organisation', fontFamily: c.f.head, fontSize: 11, bold: true, color: c.p.primary, autoShrink: true }),
        el('line', { name: 'Divider', x: 35, y: 10.5, w: 47, h: 1, stroke: c.p.accent, strokeWidth: 0.5 }),
        nameText(c, 35, 13, 47, 7, 'left'),
        ...infoLines(c, 35, 20.5, 47, 4.6, 'left'),
        ...code(c, c.b.code === 'qr' ? { x: 68, y: 36, w: 14, h: 14 } : { x: 35, y: 40, w: 40, h: 9 }),
      ],
    }),
  },
  {
    name: 'Corner circles',
    front: (c) => ({
      background: c.b.style === 'dark' ? c.p.bg : c.p.light,
      backgroundImage: null,
      elements: [
        el('ellipse', { name: 'Circle', x: 52, y: -26, w: 60, h: 60, fill: c.p.primary }),
        el('ellipse', { name: 'Circle 2', x: -12, y: 40, w: 30, h: 30, fill: c.p.accent, opacity: 0.35 }),
        T(c, c.w.org, 5, 3, 46, 7, { name: 'Organisation', fontFamily: c.f.head, fontSize: 10.5, bold: true, color: c.p.primary, autoShrink: true }),
        T(c, c.w.title, 5, 9.5, 46, 4.5, { name: 'Title', fontSize: 6.5, color: c.p.muted }),
        el('photo', { x: 59, y: 10, w: 22, h: 28, radius: 11, borderColor: '#ffffff', borderWidth: 0.9 }),
        nameText(c, 5, 17, 50, 7, 'left'),
        ...infoLines(c, 5, 24.5, 50, 4.6, 'left'),
        ...code(c, c.b.code === 'qr' ? { x: 62, y: 39, w: 13, h: 13 } : { x: 5, y: 40, w: 38, h: 9 }),
      ],
    }),
  },
  {
    name: 'Minimal',
    front: (c) => ({
      background: c.b.style === 'dark' ? c.p.bg : '#ffffff',
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Top line', x: 0, y: 0, w: c.W, h: 2, fill: c.p.primary }),
        T(c, c.w.org, 5, 4, 75.6, 6, { name: 'Organisation', fontFamily: c.f.head, fontSize: 10, bold: true, color: c.p.primary, autoShrink: true, uppercase: c.b.lang === 'en' }),
        T(c, c.w.title, 5, 9.5, 75.6, 4, { name: 'Title', fontSize: 6, color: c.p.muted, letterSpacing: c.b.lang === 'en' ? 1 : 0 }),
        el('photo', { x: 5, y: 16, w: 21, h: 27, radius: 0.8 }),
        nameText(c, 30, 16, 51, 7, 'left'),
        el('rect', { name: 'Name underline', x: 30, y: 23.3, w: 12, h: 0.8, fill: c.p.accent }),
        ...infoLines(c, 30, 25.5, 51, 4.5, 'left'),
        ...code(c, c.b.code === 'qr' ? { x: 68, y: 38, w: 12, h: 12 } : { x: 30, y: 40, w: 38, h: 8 }),
        el('rect', { name: 'Bottom line', x: 0, y: c.H - 2, w: c.W, h: 2, fill: c.p.primary }),
      ],
    }),
  },
];

const PORTRAIT: Recipe[] = [
  {
    name: 'Header + round photo',
    front: (c) => ({
      background: c.p.bg,
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Header', x: 0, y: 0, w: c.W, h: 26, fill: c.p.primary }),
        T(c, c.w.org, 3, 2.5, 48, 7, { name: 'Organisation', fontFamily: c.f.head, fontSize: 11, bold: true, color: c.p.onPrimary, align: 'center', autoShrink: true }),
        T(c, c.w.title, 3, 9, 48, 4.5, { name: 'Title', fontSize: 6.5, color: c.p.light, align: 'center' }),
        el('photo', { x: 14.5, y: 15, w: 25, h: 25, radius: 12.5, borderColor: '#ffffff', borderWidth: 0.9 }),
        nameText(c, 3, 42, 48, 7.5, 'center'),
        ...infoLines(c, 3, 50, 48, 4.7, 'center'),
        ...code(c, c.b.code === 'qr' ? { x: 18.5, y: 64.5, w: 17, h: 15 } : { x: 9, y: 65.5, w: 36, h: 11 }),
        el('rect', { name: 'Footer', x: 0, y: 81, w: c.W, h: c.H - 81, fill: c.p.primary }),
        el('rect', { name: 'Footer accent', x: 0, y: 80, w: c.W, h: 1, fill: c.p.accent }),
      ],
    }),
  },
  {
    name: 'Colour top half',
    front: (c) => ({
      background: c.p.bg,
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Top', x: 0, y: 0, w: c.W, h: 38, fill: c.p.primary }),
        el('ellipse', { name: 'Decor', x: 30, y: -14, w: 34, h: 34, fill: c.p.accent, opacity: 0.35 }),
        T(c, c.w.org, 3, 3, 48, 6.5, { name: 'Organisation', fontFamily: c.f.head, fontSize: 10.5, bold: true, color: c.p.onPrimary, align: 'center', autoShrink: true }),
        T(c, c.w.title, 3, 9, 48, 4, { name: 'Title', fontSize: 6.5, color: c.p.light, align: 'center' }),
        el('photo', { x: 15, y: 15, w: 24, h: 30, radius: 2, borderColor: '#ffffff', borderWidth: 0.9 }),
        nameText(c, 3, 47, 48, 7.5, 'center'),
        ...infoLines(c, 3, 55, 48, 4.6, 'center'),
        ...code(c, c.b.code === 'qr' ? { x: 19, y: 69, w: 16, h: 14 } : { x: 9, y: 70, w: 36, h: 10 }),
      ],
    }),
  },
  {
    name: 'Side stripe',
    front: (c) => ({
      background: c.p.bg,
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Stripe', x: 0, y: 0, w: 9, h: c.H, fill: c.p.primary }),
        el('rect', { name: 'Stripe accent', x: 9, y: 0, w: 1, h: c.H, fill: c.p.accent }),
        T(c, c.w.title, 0, 80.8, 76, 9, { name: 'Title (vertical)', rotation: -90, fontSize: 7, bold: true, color: c.p.onPrimary, align: 'center', uppercase: c.b.lang === 'en', letterSpacing: c.b.lang === 'en' ? 1.5 : 0 }),
        T(c, c.w.org, 13, 4, 38, 8, { name: 'Organisation', fontFamily: c.f.head, fontSize: 10, bold: true, color: c.p.primary, align: 'center', autoShrink: true }),
        el('photo', { x: 18, y: 14, w: 28, h: 34, radius: 2 }),
        nameText(c, 12, 50, 40, 7.5, 'center'),
        ...infoLines(c, 12, 58, 40, 4.6, 'center'),
        ...code(c, c.b.code === 'qr' ? { x: 23, y: 72, w: 18, h: 12 } : { x: 14, y: 73, w: 36, h: 9 }),
      ],
    }),
  },
  {
    name: 'Minimal',
    front: (c) => ({
      background: c.b.style === 'dark' ? c.p.bg : '#ffffff',
      backgroundImage: null,
      elements: [
        el('rect', { name: 'Top line', x: 0, y: 0, w: c.W, h: 2.5, fill: c.p.primary }),
        T(c, c.w.org, 4, 5, 46, 6.5, { name: 'Organisation', fontFamily: c.f.head, fontSize: 10, bold: true, color: c.p.primary, align: 'center', autoShrink: true }),
        T(c, c.w.title, 4, 11, 46, 4, { name: 'Title', fontSize: 6, color: c.p.muted, align: 'center' }),
        el('photo', { x: 15, y: 17, w: 24, h: 30, radius: 1 }),
        nameText(c, 3, 49, 48, 7.5, 'center'),
        el('rect', { name: 'Name underline', x: 21, y: 56.5, w: 12, h: 0.8, fill: c.p.accent }),
        ...infoLines(c, 3, 58.5, 48, 4.5, 'center'),
        ...code(c, c.b.code === 'qr' ? { x: 19.5, y: 72, w: 15, h: 11 } : { x: 9, y: 73, w: 36, h: 9 }),
        el('rect', { name: 'Bottom line', x: 0, y: c.H - 2.5, w: c.W, h: 2.5, fill: c.p.primary }),
      ],
    }),
  },
];

function backSide(c: Ctx): CardSide {
  const { W, H } = c;
  const portrait = H > W;
  const lines = c.w.back.map(([label, field]) => `${label}: {{${field}}}`);
  const els: CardElement[] = [el('rect', { name: 'Top band', x: 0, y: 0, w: W, h: 3, fill: c.p.primary })];
  if (portrait) {
    els.push(T(c, c.w.returnTitle, 4, 6, 46, 5, { name: 'Return title', bold: true, fontSize: 7.5, color: c.p.primary, align: 'center' }));
    els.push(T(c, c.w.returnText, 4, 11, 46, 13, { name: 'Return address', fontSize: 6.8, color: c.p.muted, align: 'center', vAlign: 'top' }));
    lines.forEach((t, i) => els.push(T(c, t, 4, 26 + i * 5, 46, 5, { fontSize: 7.5, name: c.w.back[i][0] })));
    const qrY = 28 + lines.length * 5;
    if (c.b.code === 'both' || c.b.code === 'barcode') els.push(el('qr', { x: 18.5, y: qrY, w: 17, h: 17, value: '{{AllDetails}}' }));
    if (c.b.extras.signature) {
      els.push(el('line', { name: 'Signature line', x: 15, y: 75, w: 24, h: 1, stroke: c.p.text, strokeWidth: 0.25 }));
      els.push(T(c, c.w.sign, 10, 76, 34, 4, { name: 'Signatory', fontSize: 6, color: c.p.muted, align: 'center' }));
    }
  } else {
    els.push(T(c, c.w.returnTitle, 5, 5, 50, 5, { name: 'Return title', bold: true, fontSize: 7.5, color: c.p.primary }));
    els.push(T(c, c.w.returnText, 5, 10, 50, 12, { name: 'Return address', fontSize: 6.8, color: c.p.muted, vAlign: 'top' }));
    lines.forEach((t, i) => els.push(T(c, t, 5, 24 + i * 4.8, 52, 4.8, { fontSize: 7.2, name: c.w.back[i][0] })));
    if (c.b.code === 'both' || c.b.code === 'barcode') els.push(el('qr', { x: 64, y: 6, w: 17, h: 17, value: '{{AllDetails}}' }));
    if (c.b.extras.signature) {
      els.push(el('line', { name: 'Signature line', x: 58, y: 42, w: 24, h: 1, stroke: c.p.text, strokeWidth: 0.25 }));
      els.push(T(c, c.w.sign, 56, 43, 28, 4, { name: 'Signatory', fontSize: 6, color: c.p.muted, align: 'center' }));
    }
  }
  els.push(el('rect', { name: 'Bottom band', x: 0, y: H - 3, w: W, h: 3, fill: c.p.primary }));
  return { background: c.b.style === 'dark' ? c.p.bg : c.p.light, backgroundImage: null, elements: els };
}

// ------------------------------------------------------------ public API

export interface Generated {
  template: Template;
  label: string;
}

/** Builds `count` different designs for the brief. `seed` gives fresh variations. */
export function generate(b: Brief, count = 6, seed = 0): Generated[] {
  const recipes = b.portrait ? PORTRAIT : LANDSCAPE;
  const W = b.portrait ? 54 : 85.6;
  const H = b.portrait ? 85.6 : 54;
  const w = wording(b);
  const out: Generated[] = [];
  for (let i = 0; i < count; i++) {
    const v = seed * count + i;
    const recipe = recipes[v % recipes.length];
    const p = palette(b.color, b.style, Math.floor(v / recipes.length) + (seed % 3));
    const f = fonts(b, v + seed);
    const c: Ctx = { b, w, p, f, W, H };
    const fields = [w.nameField, ...w.front.map(([, k]) => k), ...w.back.map(([, k]) => k)];
    const now = Date.now();
    out.push({
      label: `${recipe.name} · ${f.head}`,
      template: {
        id: uid(),
        name: `${w.org} – ${recipe.name}`,
        widthMm: W,
        heightMm: H,
        hasBack: true,
        front: recipe.front(c),
        back: backSide(c),
        fields: [...new Set(fields)],
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return out;
}

export const EXAMPLES = [
  'School ID card in green with barcode, portrait',
  'Corporate employee card, navy blue, modern, QR code',
  'मराठी शाळा ओळखपत्र केशरी रंगात',
  'Hospital staff card, teal, minimal',
  'Conference delegate pass, purple, bold, QR',
  'College ID, maroon, classic, landscape',
  'Gym membership card, black, dark style',
  'Visitor pass, orange, QR',
];

const SAMPLE_EN: Record<string, string> = {
  Name: 'Aarav Sharma', Class: '7th – A', RollNo: '23', DOB: '12 Apr 2014', Course: 'B.Sc. Computer Science', StudentID: 'STU24017',
  Year: '2nd Year', Designation: 'Senior Engineer', EmployeeID: 'EMP1023', Department: 'Engineering', Organization: 'Acme Corp',
  Role: 'Speaker', PassID: 'PASS-0042', StaffID: 'MED0311', MemberID: 'MEM-1188', Plan: 'Gold – Annual', Phone: '+91 98220 00000',
  PressID: 'PR-207', GuardID: 'SG-4410', Site: 'Main Gate', Company: 'Acme Corp', ToMeet: 'HR Department', Date: '14 Nov 2026',
  BloodGroup: 'B+', ParentName: 'Rohit Sharma', EmergencyContact: '+91 98220 11111', ValidTill: 'Mar 2027', Address: 'Shivaji Nagar, Pune',
};
const SAMPLE_MR: Record<string, string> = {
  'नाव': 'आरव शर्मा', 'इयत्ता': '७ वी (अ)', 'हजेरी क्रमांक': '२३', 'जन्मतारीख': '१२/०४/२०१४', 'अभ्यासक्रम': 'बी.एस्सी.', 'विद्यार्थी क्रमांक': 'STU24017',
  'वर्ष': 'द्वितीय वर्ष', 'पद': 'वरिष्ठ अभियंता', 'कर्मचारी क्रमांक': 'EMP1023', 'विभाग': 'अभियांत्रिकी', 'संस्था': 'आदर्श संस्था', 'भूमिका': 'वक्ते',
  'पास क्रमांक': 'PASS-0042', 'सदस्य क्रमांक': 'MEM-1188', 'योजना': 'वार्षिक', 'मोबाईल': '९८२२० ०००००', 'प्रेस क्रमांक': 'PR-207',
  'ओळख क्रमांक': 'SG-4410', 'ठिकाण': 'मुख्य प्रवेशद्वार', 'भेटण्यासाठी': 'कार्यालय', 'दिनांक': '१४/११/२०२६', 'रक्तगट': 'B+',
  'पालकाचे नाव': 'रोहित शर्मा', 'आपत्कालीन संपर्क': '९८२२० ११११', 'वैधता': 'मार्च २०२७', 'पत्ता': 'शिवाजी नगर, पुणे',
};

let silhouette: string | null = null;
function samplePhoto() {
  if (silhouette) return silhouette;
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 400;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, '#e2e8f0');
  g.addColorStop(1, '#cbd5e1');
  x.fillStyle = g;
  x.fillRect(0, 0, 300, 400);
  x.fillStyle = '#94a3b8';
  x.beginPath();
  x.ellipse(150, 165, 62, 74, 0, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.ellipse(150, 410, 140, 140, 0, Math.PI, 0);
  x.fill();
  silhouette = c.toDataURL('image/png');
  return silhouette;
}

/** Example record so previews look like a finished card. */
export function samplePerson(t: Template) {
  return {
    templateId: t.id,
    serial: 42,
    fields: Object.fromEntries(t.fields.map((f) => [f, SAMPLE_EN[f] ?? SAMPLE_MR[f] ?? 'Sample'])),
    photo: samplePhoto(),
    createdAt: Date.now(),
    printCount: 0,
    printedAt: null,
  };
}
