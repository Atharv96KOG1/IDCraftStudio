import { makeElement as el } from './elements';
import type { CardSide, Template } from './types';
import { uid } from './utils';

const side = (background: string, elements: CardSide['elements']): CardSide => ({
  background,
  backgroundImage: null,
  elements,
});

function tpl(name: string, w: number, h: number, fields: string[], front: CardSide, back: CardSide): Template {
  const now = Date.now();
  return { id: uid(), name, widthMm: w, heightMm: h, hasBack: true, front, back, fields, createdAt: now, updatedAt: now };
}

export function blankTemplate(portrait = false): Template {
  const [w, h] = portrait ? [54, 85.6] : [85.6, 54];
  return tpl('Untitled card', w, h, ['Name'], side('#ffffff', []), side('#ffffff', []));
}

function corporate(): Template {
  const navy = '#1e3a8a';
  return tpl(
    'Corporate – Blue',
    85.6,
    54,
    ['Name', 'Designation', 'EmployeeID', 'BloodGroup', 'EmergencyContact'],
    side('#ffffff', [
      el('rect', { name: 'Header', x: 0, y: 0, w: 85.6, h: 13, fill: navy }),
      el('rect', { name: 'Accent', x: 0, y: 13, w: 85.6, h: 1.2, fill: '#f59e0b' }),
      el('ellipse', { name: 'Logo mark', x: 4, y: 2, w: 9, h: 9, fill: '#ffffff' }),
      el('text', { name: 'Logo letter', text: 'Y', x: 4, y: 2, w: 9, h: 9, fontSize: 14, bold: true, color: navy, align: 'center' }),
      el('text', { name: 'Company', text: 'YOUR COMPANY', x: 16, y: 1.5, w: 66, h: 7, fontSize: 12, bold: true, color: '#ffffff', letterSpacing: 1 }),
      el('text', { name: 'Tagline', text: 'Employee Identity Card', x: 16, y: 7.5, w: 66, h: 4.5, fontSize: 7, color: '#c7d2fe' }),
      el('photo', { x: 4.5, y: 17.5, w: 22, h: 28, radius: 1.5, borderColor: navy, borderWidth: 0.4 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 30, y: 18, w: 52, h: 7, fontSize: 12, bold: true, color: '#0f172a', autoShrink: true }),
      el('text', { name: 'Designation', text: '{{Designation}}', x: 30, y: 25, w: 52, h: 5, fontSize: 8.5, color: '#475569' }),
      el('text', { name: 'Employee ID', text: 'ID: {{EmployeeID}}', x: 30, y: 30.5, w: 52, h: 5, fontSize: 8, bold: true, color: navy }),
      el('barcode', { x: 30, y: 37, w: 42, h: 9, value: '{{EmployeeID}}', showText: false }),
      el('rect', { name: 'Footer', x: 0, y: 50, w: 85.6, h: 4, fill: navy }),
    ]),
    side('#f8fafc', [
      el('text', { name: 'Return title', text: 'If found, please return to:', x: 5, y: 4, w: 52, h: 5, fontSize: 8, bold: true }),
      el('text', {
        name: 'Address',
        text: 'Your Company Pvt. Ltd.\n123 Business Street, Your City\nPhone: +00 00000 00000',
        x: 5, y: 9, w: 52, h: 13, fontSize: 7, vAlign: 'top', color: '#334155',
      }),
      el('qr', { x: 63, y: 5, w: 18, h: 18, value: '{{AllDetails}}' }),
      el('text', { name: 'Blood group', text: 'Blood Group: {{BloodGroup}}', x: 5, y: 26, w: 50, h: 4.5, fontSize: 7.5 }),
      el('text', { name: 'Emergency', text: 'Emergency: {{EmergencyContact}}', x: 5, y: 30.5, w: 50, h: 4.5, fontSize: 7.5 }),
      el('text', { name: 'Issued', text: 'Issued: {{IssueDate}}', x: 5, y: 35, w: 50, h: 4.5, fontSize: 7.5 }),
      el('line', { name: 'Signature line', x: 56, y: 41, w: 25, h: 1, strokeWidth: 0.25 }),
      el('text', { name: 'Signatory', text: 'Authorized Signatory', x: 56, y: 42, w: 25, h: 4, fontSize: 6, align: 'center', color: '#475569' }),
      el('rect', { name: 'Footer', x: 0, y: 50, w: 85.6, h: 4, fill: navy }),
    ]),
  );
}

function school(): Template {
  const green = '#047857';
  return tpl(
    'School – Green (portrait)',
    54,
    85.6,
    ['Name', 'Class', 'RollNo', 'DOB', 'ParentName', 'Phone', 'Address'],
    side('#ffffff', [
      el('rect', { name: 'Header', x: 0, y: 0, w: 54, h: 26, fill: green }),
      el('text', { name: 'School', text: 'SCHOOL NAME', x: 3, y: 2.5, w: 48, h: 7, fontSize: 11, bold: true, color: '#ffffff', align: 'center', letterSpacing: 0.8 }),
      el('text', { name: 'Subtitle', text: 'Student Identity Card · {{Today}}', x: 3, y: 9, w: 48, h: 4.5, fontSize: 6.5, color: '#d1fae5', align: 'center' }),
      el('photo', { x: 14.5, y: 15, w: 25, h: 25, radius: 12.5, borderColor: '#ffffff', borderWidth: 0.9 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 3, y: 42, w: 48, h: 7, fontSize: 11, bold: true, align: 'center', autoShrink: true }),
      el('text', { name: 'Class', text: 'Class: {{Class}}', x: 3, y: 49.5, w: 48, h: 4.5, fontSize: 8, align: 'center', color: '#334155' }),
      el('text', { name: 'Roll', text: 'Roll No: {{RollNo}}', x: 3, y: 54, w: 48, h: 4.5, fontSize: 8, align: 'center', color: '#334155' }),
      el('text', { name: 'DOB', text: 'DOB: {{DOB}}', x: 3, y: 58.5, w: 48, h: 4.5, fontSize: 8, align: 'center', color: '#334155' }),
      el('barcode', { x: 9, y: 65, w: 36, h: 11, value: '{{RollNo}}', showText: true }),
      el('rect', { name: 'Footer', x: 0, y: 81, w: 54, h: 4.6, fill: green }),
    ]),
    side('#f0fdf4', [
      el('text', { name: 'Info title', text: 'STUDENT INFORMATION', x: 3, y: 4, w: 48, h: 5, fontSize: 8, bold: true, align: 'center', color: green }),
      el('text', { name: 'Parent', text: 'Parent: {{ParentName}}', x: 4, y: 11, w: 46, h: 4.5, fontSize: 7.5 }),
      el('text', { name: 'Phone', text: 'Phone: {{Phone}}', x: 4, y: 15.5, w: 46, h: 4.5, fontSize: 7.5 }),
      el('text', { name: 'Address', text: 'Address: {{Address}}', x: 4, y: 20, w: 46, h: 12, fontSize: 7.5, vAlign: 'top' }),
      el('qr', { x: 17, y: 35, w: 20, h: 20, value: '{{AllDetails}}' }),
      el('text', {
        name: 'Rules',
        text: 'This card is the property of the school. Carry it at all times on campus. If found, please return to the school office.',
        x: 4, y: 58, w: 46, h: 16, fontSize: 6.5, vAlign: 'top', align: 'center', color: '#475569',
      }),
      el('rect', { name: 'Footer', x: 0, y: 81, w: 54, h: 4.6, fill: green }),
    ]),
  );
}

function eventPass(): Template {
  return tpl(
    'Event pass – Dark (portrait)',
    54,
    85.6,
    ['Name', 'Organization', 'Role', 'PassID'],
    side('#111827', [
      el('rect', { name: 'Header', x: 0, y: 0, w: 54, h: 30, fill: '#7c3aed' }),
      el('ellipse', { name: 'Decor', x: 34, y: -10, w: 30, h: 30, fill: '#a78bfa', opacity: 0.5 }),
      el('text', { name: 'Event', text: 'EVENT 2026', x: 3, y: 7, w: 48, h: 10, fontSize: 16, bold: true, color: '#ffffff', align: 'center', letterSpacing: 1 }),
      el('text', { name: 'Tagline', text: 'Conference · Expo · Networking', x: 3, y: 17, w: 48, h: 5, fontSize: 6.5, color: '#ede9fe', align: 'center' }),
      el('text', { name: 'Name', text: '{{Name}}', x: 3, y: 35, w: 48, h: 9, fontSize: 14, bold: true, color: '#ffffff', align: 'center', autoShrink: true }),
      el('text', { name: 'Organization', text: '{{Organization}}', x: 3, y: 44, w: 48, h: 5, fontSize: 8, color: '#cbd5e1', align: 'center' }),
      el('rect', { name: 'Role badge', x: 11, y: 52, w: 32, h: 7, fill: '#f59e0b', radius: 3.5 }),
      el('text', { name: 'Role', text: '{{Role}}', x: 11, y: 52, w: 32, h: 7, fontSize: 8.5, bold: true, color: '#111827', align: 'center', uppercase: true }),
      el('qr', { x: 18.5, y: 63, w: 17, h: 17, value: '{{AllDetails}}' }),
    ]),
    side('#111827', [
      el('text', { name: 'Title', text: 'ACCESS PASS', x: 3, y: 6, w: 48, h: 7, fontSize: 11, bold: true, color: '#ffffff', align: 'center' }),
      el('text', {
        name: 'Terms',
        text: 'Wear this pass visibly at all times.\nNon-transferable.\nPass ID: {{PassID}}',
        x: 5, y: 16, w: 44, h: 20, fontSize: 7, color: '#cbd5e1', align: 'center', vAlign: 'top',
      }),
      el('barcode', { x: 7, y: 66, w: 40, h: 12, value: '{{PassID}}', color: '#ffffff', showText: true }),
    ]),
  );
}


function marathiSchool(): Template {
  const saffron = '#c2410c';
  const F = 'Tiro Devanagari Marathi';
  const M = 'Mukta';
  return tpl(
    'मराठी शाळा ओळखपत्र',
    54,
    85.6,
    ['नाव', 'इयत्ता', 'हजेरी क्रमांक', 'जन्मतारीख', 'पालकाचे नाव', 'मोबाईल', 'पत्ता'],
    side('#fffbeb', [
      el('rect', { name: 'Header', x: 0, y: 0, w: 54, h: 25, fill: saffron }),
      el('text', { name: 'School', text: 'शाळेचे नाव', x: 3, y: 2, w: 48, h: 8, fontFamily: F, fontSize: 13, bold: true, color: '#ffffff', align: 'center' }),
      el('text', { name: 'Subtitle', text: 'विद्यार्थी ओळखपत्र', x: 3, y: 9.5, w: 48, h: 5, fontFamily: M, fontSize: 8, color: '#ffedd5', align: 'center' }),
      el('photo', { x: 14.5, y: 15, w: 25, h: 25, radius: 12.5, borderColor: '#ffffff', borderWidth: 0.9 }),
      el('text', { name: 'Name', text: '{{नाव}}', x: 3, y: 41.5, w: 48, h: 8, fontFamily: F, fontSize: 12, bold: true, align: 'center', autoShrink: true }),
      el('text', { name: 'Class', text: 'इयत्ता: {{इयत्ता}}', x: 3, y: 50, w: 48, h: 5, fontFamily: M, fontSize: 8.5, align: 'center', color: '#334155' }),
      el('text', { name: 'Roll', text: 'हजेरी क्रमांक: {{हजेरी क्रमांक}}', x: 3, y: 55, w: 48, h: 5, fontFamily: M, fontSize: 8.5, align: 'center', color: '#334155' }),
      el('text', { name: 'DOB', text: 'जन्मतारीख: {{जन्मतारीख}}', x: 3, y: 60, w: 48, h: 5, fontFamily: M, fontSize: 8.5, align: 'center', color: '#334155' }),
      el('barcode', { x: 10, y: 67, w: 34, h: 10, value: '{{Serial}}', showText: true }),
      el('rect', { name: 'Footer', x: 0, y: 81, w: 54, h: 4.6, fill: saffron }),
    ]),
    side('#fffbeb', [
      el('text', { name: 'Info title', text: 'विद्यार्थ्याची माहिती', x: 3, y: 4, w: 48, h: 6, fontFamily: F, fontSize: 10, bold: true, align: 'center', color: saffron }),
      el('text', { name: 'Parent', text: 'पालकाचे नाव: {{पालकाचे नाव}}', x: 4, y: 12, w: 46, h: 5, fontFamily: M, fontSize: 8 }),
      el('text', { name: 'Phone', text: 'मोबाईल: {{मोबाईल}}', x: 4, y: 17, w: 46, h: 5, fontFamily: M, fontSize: 8 }),
      el('text', { name: 'Address', text: 'पत्ता: {{पत्ता}}', x: 4, y: 22, w: 46, h: 12, fontFamily: M, fontSize: 8, vAlign: 'top' }),
      el('qr', { x: 17, y: 36, w: 20, h: 20, value: '{{AllDetails}}' }),
      el('text', {
        name: 'Rules',
        text: 'हे ओळखपत्र शाळेची मालमत्ता आहे. शाळेत असताना नेहमी सोबत ठेवावे. सापडल्यास कृपया शाळेच्या कार्यालयात जमा करावे.',
        x: 4, y: 59, w: 46, h: 18, fontFamily: M, fontSize: 7, vAlign: 'top', align: 'center', color: '#475569',
      }),
      el('rect', { name: 'Footer', x: 0, y: 81, w: 54, h: 4.6, fill: saffron }),
    ]),
  );
}

// ---------- modern designs ----------

const icon = (clipart: string, x: number, y: number, tint: string, size = 3.6) =>
  el('image', { name: `Icon ${clipart}`, clipart, tint, src: '', x, y, w: size, h: size, fit: 'contain' });

/** "icon  value" rows for the portrait designs. */
function infoRows(rows: [string, string][], x: number, y0: number, w: number, color: string, tint: string, font: string, gap = 5.2) {
  return rows.flatMap(([clip, text], i) => [
    icon(clip, x, y0 + i * gap + 0.4, tint, 3.2),
    el('text', { name: text, text, x: x + 4.6, y: y0 + i * gap, w: w - 4.6, h: 4, fontSize: 7, color, fontFamily: font, autoShrink: true }),
  ]);
}

function modernWave(): Template {
  const a = '#6d28d9';
  const b = '#c026d3';
  const F = 'Poppins';
  return tpl(
    'Modern – Wave Purple (portrait)',
    54,
    85.6,
    ['Name', 'Class', 'RollNo', 'DOB', 'BloodGroup', 'Phone', 'Address'],
    side('#ffffff', [
      el('shape', { name: 'Wave back', shape: 'wave', x: -4, y: -6, w: 62, h: 34, fill: b, opacity: 0.55 }),
      el('shape', { name: 'Wave', shape: 'wave', x: -6, y: -9, w: 64, h: 33, fill: a }),
      el('text', { name: 'School', text: 'YOUR SCHOOL NAME', x: 3, y: 2.5, w: 48, h: 5, fontSize: 9, bold: true, color: '#ffffff', align: 'center', fontFamily: 'Montserrat', letterSpacing: 0.6 }),
      el('text', { name: 'Session', text: 'STUDENT ID · 2025-26', x: 3, y: 7.3, w: 48, h: 3.5, fontSize: 5.5, color: '#f5d0fe', align: 'center', fontFamily: F }),
      el('ellipse', { name: 'Photo ring', x: 14.5, y: 13.5, w: 25, h: 25, fill: '#ffffff' }),
      el('photo', { x: 15.75, y: 14.75, w: 22.5, h: 22.5, mask: 'circle', borderColor: b, borderWidth: 0.6, radius: 0 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 3, y: 40, w: 48, h: 6, fontSize: 10.5, bold: true, color: '#1f1147', align: 'center', fontFamily: F, autoShrink: true }),
      el('rect', { name: 'Class pill', x: 15, y: 46.5, w: 24, h: 4.6, fill: '#ede9fe', radius: 2.3 }),
      el('text', { name: 'Class', text: 'Class {{Class}} · Roll {{RollNo}}', x: 15, y: 46.5, w: 24, h: 4.6, fontSize: 6.2, bold: true, color: a, align: 'center', fontFamily: F, autoShrink: true }),
      ...infoRows([['calendar', '{{DOB}}'], ['blood', '{{BloodGroup}}'], ['phone', '{{Phone}}'], ['location', '{{Address}}']], 5, 54, 44, '#374151', a, F),
      el('rect', { name: 'Footer', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
    side('#faf5ff', [
      el('shape', { name: 'Wave', shape: 'wave', x: -6, y: 70, w: 66, h: 22, fill: a }),
      el('text', { name: 'Title', text: 'Scan for student details', x: 4, y: 5, w: 46, h: 5, fontSize: 7.5, bold: true, color: a, align: 'center', fontFamily: F }),
      el('qr', { x: 12, y: 12, w: 30, h: 30, value: '{{AllDetails}}', color: '#1f1147' }),
      el('text', { name: 'Return', text: 'If found, please return to:\nYour School, Your City\n📞 +91 00000 00000', x: 4, y: 46, w: 46, h: 14, fontSize: 6.5, color: '#4b5563', align: 'center', vAlign: 'top', fontFamily: F }),
      el('text', { name: 'Sign', text: 'Principal', x: 27, y: 66, w: 22, h: 4, fontSize: 6, color: '#6b7280', align: 'center' }),
      el('line', { x: 27, y: 65, w: 22, h: 1, strokeWidth: 0.2, stroke: '#9ca3af' }),
    ]),
  );
}

function modernHex(): Template {
  const a = '#0f766e';
  const F = 'Montserrat';
  return tpl(
    'Modern – Hexagon Teal (portrait)',
    54,
    85.6,
    ['Name', 'Designation', 'EmployeeID', 'BloodGroup', 'Phone', 'Email'],
    side('#f0fdfa', [
      el('shape', { name: 'Corner', shape: 'triangle', x: 74, y: 24, w: 50, h: 44, fill: a, rotation: 180 }),
      el('shape', { name: 'Corner light', shape: 'triangle', x: -16, y: 60, w: 40, h: 34, fill: '#5eead4', opacity: 0.6 }),
      el('text', { name: 'Company', text: 'COMPANY', x: 4, y: 4, w: 30, h: 5, fontSize: 9, bold: true, color: a, fontFamily: F, letterSpacing: 1 }),
      el('photo', { x: 11, y: 13, w: 32, h: 30, mask: 'hexagon', borderColor: a, borderWidth: 0.8, radius: 0 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 3, y: 45, w: 48, h: 6, fontSize: 10.5, bold: true, color: '#042f2e', align: 'center', fontFamily: F, autoShrink: true }),
      el('text', { name: 'Designation', text: '{{Designation}}', x: 3, y: 51, w: 48, h: 4, fontSize: 7, color: a, align: 'center', fontFamily: F, uppercase: true, letterSpacing: 0.8 }),
      ...infoRows([['id', '{{EmployeeID}}'], ['blood', '{{BloodGroup}}'], ['phone', '{{Phone}}'], ['mail', '{{Email}}']], 7, 57.5, 42, '#134e4a', a, F, 4.9),
    ]),
    side('#ffffff', [
      el('rect', { name: 'Band', x: 0, y: 0, w: 54, h: 8, fill: a }),
      el('text', { name: 'Title', text: 'EMPLOYEE CARD', x: 0, y: 0, w: 54, h: 8, fontSize: 8, bold: true, color: '#ffffff', align: 'center', fontFamily: F, letterSpacing: 1.5 }),
      el('qr', { x: 13, y: 14, w: 28, h: 28, value: '{{vCard}}', color: '#042f2e' }),
      el('barcode', { x: 9, y: 48, w: 36, h: 9, value: '{{EmployeeID}}', color: '#042f2e' }),
      el('text', { name: 'Note', text: 'This card is the property of the company.\nIf found, please return it.', x: 4, y: 62, w: 46, h: 10, fontSize: 6, color: '#475569', align: 'center', fontFamily: F }),
      el('rect', { name: 'Band', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
  );
}

function modernBlackGold(): Template {
  const gold = '#d4a537';
  const F = 'Montserrat';
  return tpl(
    'Modern – Black & Gold (landscape)',
    85.6,
    54,
    ['Name', 'Designation', 'EmployeeID', 'Phone', 'Email'],
    side('#0b0b0f', [
      el('shape', { name: 'Gold slash', shape: 'chevron', x: 52, y: -2, w: 40, h: 58, fill: '#17171d' }),
      el('rect', { name: 'Gold line', x: 6, y: 9.5, w: 18, h: 0.6, fill: gold }),
      el('text', { name: 'Company', text: 'YOUR BRAND', x: 6, y: 3.5, w: 45, h: 6, fontSize: 10, bold: true, color: gold, fontFamily: F, letterSpacing: 2 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 6, y: 15, w: 46, h: 7, fontSize: 12.5, bold: true, color: '#ffffff', fontFamily: 'Playfair Display', autoShrink: true }),
      el('text', { name: 'Designation', text: '{{Designation}}', x: 6, y: 22, w: 46, h: 4.5, fontSize: 7, color: gold, fontFamily: F, uppercase: true, letterSpacing: 1 }),
      icon('phone', 6, 31, gold, 3),
      el('text', { text: '{{Phone}}', x: 10.5, y: 30.5, w: 40, h: 4, fontSize: 7, color: '#e5e7eb', fontFamily: F }),
      icon('mail', 6, 36, gold, 3),
      el('text', { text: '{{Email}}', x: 10.5, y: 35.5, w: 40, h: 4, fontSize: 7, color: '#e5e7eb', fontFamily: F, autoShrink: true }),
      icon('id', 6, 41, gold, 3),
      el('text', { text: '{{EmployeeID}}', x: 10.5, y: 40.5, w: 40, h: 4, fontSize: 7, color: '#e5e7eb', fontFamily: F }),
      el('photo', { x: 57, y: 9, w: 24, h: 30, mask: 'rounded', radius: 3, borderColor: gold, borderWidth: 0.6 }),
      el('rect', { name: 'Gold base', x: 0, y: 52.5, w: 85.6, h: 1.5, fill: gold }),
    ]),
    side('#0b0b0f', [
      el('text', { name: 'Brand', text: 'YOUR BRAND', x: 0, y: 8, w: 85.6, h: 8, fontSize: 14, bold: true, color: gold, align: 'center', fontFamily: F, letterSpacing: 3 }),
      el('qr', { x: 33, y: 19, w: 20, h: 20, value: '{{vCard}}', color: '#000000', background: '#ffffff' }),
      el('text', { name: 'Web', text: 'www.yourbrand.com', x: 0, y: 43, w: 85.6, h: 5, fontSize: 7, color: '#9ca3af', align: 'center', fontFamily: F, letterSpacing: 1 }),
      el('rect', { name: 'Gold base', x: 0, y: 52.5, w: 85.6, h: 1.5, fill: gold }),
    ]),
  );
}

function modernSunset(): Template {
  const a = '#ea580c';
  const b = '#f59e0b';
  const F = 'Nunito';
  return tpl(
    'Modern – Sunset Student (portrait)',
    54,
    85.6,
    ['Name', 'Class', 'Division', 'RollNo', 'DOB', 'BloodGroup', 'ParentName', 'Phone', 'Address'],
    side('#fffbeb', [
      el('rect', { name: 'Top', x: 0, y: 0, w: 54, h: 30, fill: a }),
      el('shape', { name: 'Glow', shape: 'circle', x: 30, y: -14, w: 36, h: 36, fill: b, opacity: 0.7 }),
      el('shape', { name: 'Glow 2', shape: 'circle', x: -10, y: 16, w: 22, h: 22, fill: '#fb923c', opacity: 0.7 }),
      el('text', { name: 'School', text: 'SUNRISE PUBLIC SCHOOL', x: 3, y: 3, w: 48, h: 5, fontSize: 8.5, bold: true, color: '#ffffff', align: 'center', fontFamily: 'Poppins' }),
      el('text', { name: 'Tag', text: 'Identity Card 2025-26', x: 3, y: 8, w: 48, h: 3.5, fontSize: 5.8, color: '#ffedd5', align: 'center', fontFamily: F }),
      el('photo', { x: 15, y: 13.5, w: 24, h: 29, mask: 'arch', borderColor: '#ffffff', borderWidth: 1, radius: 0 }),
      el('text', { name: 'Name', text: '{{Name}}', x: 3, y: 44, w: 48, h: 6, fontSize: 10.5, bold: true, color: '#7c2d12', align: 'center', fontFamily: 'Poppins', autoShrink: true }),
      el('text', { name: 'Class', text: 'Class {{Class}}-{{Division}}  |  Roll {{RollNo}}', x: 3, y: 50, w: 48, h: 4, fontSize: 6.8, bold: true, color: a, align: 'center', fontFamily: F, autoShrink: true }),
      el('rect', { name: 'Info card', x: 3.5, y: 55, w: 47, h: 25, fill: '#ffffff', radius: 2, stroke: '#fed7aa', strokeWidth: 0.25 }),
      ...infoRows([['calendar', '{{DOB}}'], ['blood', '{{BloodGroup}}'], ['users', '{{ParentName}}'], ['phone', '{{Phone}}']], 6, 56.5, 42, '#431407', a, F, 5.4),
      el('shape', { name: 'Bottom ribbon', shape: 'ribbon', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
    side('#ffffff', [
      el('rect', { name: 'Top', x: 0, y: 0, w: 54, h: 6, fill: a }),
      el('qr', { x: 12, y: 10, w: 30, h: 30, value: '{{AllDetails}}', color: '#431407' }),
      icon('location', 5, 44, a, 3.4),
      el('text', { name: 'Address', text: '{{Address}}', x: 9.5, y: 43.5, w: 40, h: 10, fontSize: 6.5, color: '#431407', vAlign: 'top', fontFamily: F }),
      el('text', { name: 'Rules', text: '• Carry this card every day\n• Report loss to the school office', x: 5, y: 56, w: 44, h: 10, fontSize: 6, color: '#6b7280', vAlign: 'top', fontFamily: F }),
      el('line', { x: 28, y: 73, w: 21, h: 1, strokeWidth: 0.2 }),
      el('text', { text: 'Principal', x: 28, y: 74, w: 21, h: 4, fontSize: 6, align: 'center', color: '#6b7280' }),
      el('rect', { name: 'Bottom', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
  );
}

function modernSlate(): Template {
  const a = '#1e293b';
  const acc = '#38bdf8';
  const F = 'Inter';
  return tpl(
    'Modern – Slate Side-band (landscape)',
    85.6,
    54,
    ['Name', 'Designation', 'Department', 'EmployeeID', 'Phone', 'BloodGroup'],
    side('#ffffff', [
      el('rect', { name: 'Band', x: 0, y: 0, w: 30, h: 54, fill: a }),
      el('shape', { name: 'Accent', shape: 'circle', x: -12, y: 36, w: 30, h: 30, fill: acc, opacity: 0.35 }),
      el('photo', { x: 4, y: 9, w: 22, h: 22, mask: 'circle', borderColor: acc, borderWidth: 0.7, radius: 0 }),
      el('text', { name: 'ID', text: '{{EmployeeID}}', x: 2, y: 34, w: 26, h: 5, fontSize: 8, bold: true, color: acc, align: 'center', fontFamily: F }),
      el('text', { name: 'Company', text: 'COMPANY NAME', x: 34, y: 4, w: 48, h: 5, fontSize: 8.5, bold: true, color: a, fontFamily: F, letterSpacing: 1.2 }),
      el('rect', { x: 34, y: 9.5, w: 10, h: 0.7, fill: acc }),
      el('text', { name: 'Name', text: '{{Name}}', x: 34, y: 14, w: 48, h: 7, fontSize: 12, bold: true, color: '#0f172a', fontFamily: F, autoShrink: true }),
      el('text', { name: 'Designation', text: '{{Designation}} · {{Department}}', x: 34, y: 21, w: 48, h: 4.5, fontSize: 7, color: '#64748b', fontFamily: F, autoShrink: true }),
      icon('phone', 34, 30, acc, 3.2),
      el('text', { text: '{{Phone}}', x: 38.5, y: 29.6, w: 40, h: 4, fontSize: 7, color: '#1e293b', fontFamily: F }),
      icon('blood', 34, 35, acc, 3.2),
      el('text', { text: '{{BloodGroup}}', x: 38.5, y: 34.6, w: 40, h: 4, fontSize: 7, color: '#1e293b', fontFamily: F }),
      el('barcode', { x: 34, y: 42, w: 40, h: 8, value: '{{EmployeeID}}', color: a, showText: false }),
    ]),
    side('#f8fafc', [
      el('rect', { name: 'Band', x: 0, y: 0, w: 85.6, h: 7, fill: a }),
      el('qr', { x: 61, y: 13, w: 20, h: 20, value: '{{AllDetails}}', color: a }),
      el('text', { name: 'Return', text: 'If found, please return to:\nCompany Name, Street, City\n📞 +91 00000 00000', x: 5, y: 12, w: 52, h: 16, fontSize: 7, color: '#334155', vAlign: 'top', fontFamily: F }),
      el('text', { text: 'Issued {{IssueDate}}', x: 5, y: 40, w: 40, h: 4, fontSize: 6.5, color: '#64748b', fontFamily: F }),
      el('rect', { name: 'Band', x: 0, y: 50, w: 85.6, h: 4, fill: acc }),
    ]),
  );
}

function modernMarathi(): Template {
  const a = '#c2410c';
  const F = 'Mukta';
  return tpl(
    'आधुनिक मराठी ओळखपत्र (portrait)',
    54,
    85.6,
    ['नाव', 'इयत्ता', 'हजेरी क्रमांक', 'जन्मतारीख', 'रक्तगट', 'मोबाईल', 'पत्ता'],
    side('#fff7ed', [
      el('shape', { name: 'Wave', shape: 'wave', x: -6, y: -9, w: 66, h: 32, fill: a }),
      el('shape', { name: 'Wave 2', shape: 'wave', x: -4, y: -6, w: 62, h: 32, fill: '#f97316', opacity: 0.5 }),
      el('text', { name: 'School', text: 'आपल्या शाळेचे नाव', x: 3, y: 2.5, w: 48, h: 6, fontSize: 10, bold: true, color: '#ffffff', align: 'center', fontFamily: 'Baloo 2' }),
      el('text', { name: 'Session', text: 'विद्यार्थी ओळखपत्र २०२५-२६', x: 3, y: 8, w: 48, h: 4, fontSize: 6.5, color: '#ffedd5', align: 'center', fontFamily: F }),
      el('photo', { x: 15, y: 14, w: 24, h: 26, mask: 'shield', borderColor: '#ffffff', borderWidth: 0.9, radius: 0 }),
      el('text', { name: 'नाव', text: '{{नाव}}', x: 3, y: 41.5, w: 48, h: 6.5, fontSize: 11, bold: true, color: '#7c2d12', align: 'center', fontFamily: F, autoShrink: true }),
      el('text', { name: 'इयत्ता', text: 'इयत्ता {{इयत्ता}} · हजेरी क्र. {{हजेरी क्रमांक}}', x: 3, y: 48, w: 48, h: 4.5, fontSize: 7, bold: true, color: a, align: 'center', fontFamily: F, autoShrink: true }),
      ...infoRows([['calendar', '{{जन्मतारीख}}'], ['blood', '{{रक्तगट}}'], ['phone', '{{मोबाईल}}'], ['location', '{{पत्ता}}']], 5, 54.5, 44, '#431407', a, F, 5.4),
      el('rect', { name: 'Footer', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
    side('#ffffff', [
      el('rect', { name: 'Top', x: 0, y: 0, w: 54, h: 6, fill: a }),
      el('text', { name: 'Title', text: 'माहितीसाठी स्कॅन करा', x: 3, y: 8, w: 48, h: 5, fontSize: 8, bold: true, color: a, align: 'center', fontFamily: F }),
      el('qr', { x: 12, y: 14, w: 30, h: 30, value: '{{AllDetails}}', color: '#431407' }),
      el('text', { name: 'Return', text: 'हे ओळखपत्र सापडल्यास कृपया शाळेत परत करावे.\n📞 ०००००००००००', x: 4, y: 48, w: 46, h: 12, fontSize: 6.8, color: '#4b5563', align: 'center', vAlign: 'top', fontFamily: F }),
      el('line', { x: 27, y: 70, w: 22, h: 1, strokeWidth: 0.2 }),
      el('text', { text: 'मुख्याध्यापक', x: 27, y: 71, w: 22, h: 4, fontSize: 6.5, align: 'center', color: '#6b7280', fontFamily: F }),
      el('rect', { name: 'Bottom', x: 0, y: 81.6, w: 54, h: 4, fill: a }),
    ]),
  );
}

export const STARTERS: { label: string; make: () => Template }[] = [
  { label: 'Blank – landscape', make: () => blankTemplate(false) },
  { label: 'Blank – portrait', make: () => blankTemplate(true) },
  { label: 'Corporate – Blue', make: corporate },
  { label: 'School – Green (portrait)', make: school },
  { label: 'Event pass – Dark (portrait)', make: eventPass },
  { label: 'मराठी शाळा ओळखपत्र (Marathi school)', make: marathiSchool },
  { label: '✨ Modern – Wave Purple (portrait)', make: modernWave },
  { label: '✨ Modern – Hexagon Teal (portrait)', make: modernHex },
  { label: '✨ Modern – Black & Gold (landscape)', make: modernBlackGold },
  { label: '✨ Modern – Sunset Student (portrait)', make: modernSunset },
  { label: '✨ Modern – Slate Side-band (landscape)', make: modernSlate },
  { label: '✨ आधुनिक मराठी ओळखपत्र (portrait)', make: modernMarathi },
];

export const SEED_TEMPLATES = () => [corporate(), school(), eventPass(), marathiSchool()];

export const MODERN_TEMPLATES = () => [modernWave(), modernSunset(), modernHex(), modernBlackGold(), modernSlate(), modernMarathi()];
