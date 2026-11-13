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
      el('qr', { x: 63, y: 5, w: 18, h: 18, value: '{{EmployeeID}}' }),
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
      el('qr', { x: 17, y: 35, w: 20, h: 20, value: '{{RollNo}}' }),
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
      el('qr', { x: 18.5, y: 63, w: 17, h: 17, value: '{{PassID}}' }),
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

export const STARTERS: { label: string; make: () => Template }[] = [
  { label: 'Blank – landscape', make: () => blankTemplate(false) },
  { label: 'Blank – portrait', make: () => blankTemplate(true) },
  { label: 'Corporate – Blue', make: corporate },
  { label: 'School – Green (portrait)', make: school },
  { label: 'Event pass – Dark (portrait)', make: eventPass },
];

export const SEED_TEMPLATES = () => [corporate(), school(), eventPass()];
