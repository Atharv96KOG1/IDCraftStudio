/**
 * Smart column detection for spreadsheet import: finds the header row, works
 * out what each column contains (from its name AND its values, in English or
 * Marathi) and maps it to the card's data fields.
 */

export type ColumnKind =
  | 'name' | 'firstName' | 'lastName' | 'middleName' | 'father' | 'mother' | 'parent' | 'class' | 'division' | 'roll'
  | 'studentId' | 'employeeId' | 'designation' | 'department' | 'dob' | 'blood' | 'phone' | 'emergency' | 'email'
  | 'address' | 'city' | 'gender' | 'aadhaar' | 'company' | 'role' | 'validTill' | 'issueDate' | 'course' | 'year'
  | 'photo' | 'serial' | 'id' | 'date' | 'number' | 'text' | 'empty';

/** Synonyms per concept (normalised: lowercase, no spaces/punctuation). */
const CONCEPTS: { kind: ColumnKind; label: string; words: string[] }[] = [
  { kind: 'serial', label: 'Serial no.', words: ['srno', 'sno', 'slno', 'serialno', 'serial', 'sr', 'no', 'अनुक्र', 'अनुक्रमांक', 'क्र', 'क्रमांक'] },
  { kind: 'firstName', label: 'First name', words: ['firstname', 'fname', 'givenname', 'पहिलेनाव', 'नाव1'] },
  { kind: 'middleName', label: 'Middle name', words: ['middlename', 'mname', 'मधलेनाव'] },
  { kind: 'lastName', label: 'Surname', words: ['lastname', 'lname', 'surname', 'familyname', 'आडनाव'] },
  { kind: 'father', label: "Father's name", words: ['fathername', 'fathersname', 'father', 'वडिलांचेनाव', 'वडील'] },
  { kind: 'mother', label: "Mother's name", words: ['mothername', 'mothersname', 'mother', 'आईचेनाव', 'आई'] },
  { kind: 'parent', label: 'Parent / guardian', words: ['parentname', 'parent', 'guardian', 'guardianname', 'पालक', 'पालकाचेनाव'] },
  {
    kind: 'name',
    label: 'Name',
    words: ['name', 'fullname', 'studentname', 'employeename', 'empname', 'candidatename', 'membername', 'staffname', 'personname', 'नाव', 'पूर्णनाव', 'विद्यार्थ्याचेनाव', 'कर्मचाऱ्याचेनाव', 'नांव'],
  },
  { kind: 'class', label: 'Class', words: ['class', 'std', 'standard', 'grade', 'classsection', 'इयत्ता', 'वर्ग'] },
  { kind: 'division', label: 'Division', words: ['div', 'division', 'section', 'तुकडी'] },
  { kind: 'roll', label: 'Roll no.', words: ['rollno', 'roll', 'rollnumber', 'हजेरीक्रमांक', 'हजेरीक्र', 'रोलनंबर'] },
  { kind: 'studentId', label: 'Student ID', words: ['studentid', 'admissionno', 'admno', 'grno', 'generalregisterno', 'enrollmentno', 'enrolmentno', 'prn', 'uid', 'प्रवेशक्रमांक', 'जनरलरजिस्टरक्र'] },
  { kind: 'employeeId', label: 'Employee ID', words: ['employeeid', 'empid', 'empcode', 'employeecode', 'employeeno', 'empno', 'staffid', 'staffcode', 'कर्मचारीक्रमांक'] },
  { kind: 'designation', label: 'Designation', words: ['designation', 'post', 'position', 'title', 'jobtitle', 'पद', 'हुद्दा'] },
  { kind: 'department', label: 'Department', words: ['department', 'dept', 'division', 'विभाग'] },
  { kind: 'course', label: 'Course', words: ['course', 'program', 'programme', 'branch', 'stream', 'अभ्यासक्रम', 'शाखा'] },
  { kind: 'year', label: 'Year', words: ['year', 'academicyear', 'batch', 'वर्ष'] },
  { kind: 'dob', label: 'Date of birth', words: ['dob', 'dateofbirth', 'birthdate', 'bdate', 'जन्मतारीख', 'जन्मदिनांक'] },
  { kind: 'blood', label: 'Blood group', words: ['bloodgroup', 'blood', 'bg', 'bldgrp', 'रक्तगट'] },
  { kind: 'emergency', label: 'Emergency contact', words: ['emergency', 'emergencycontact', 'emergencyno', 'emergencyphone', 'आपत्कालीनसंपर्क'] },
  {
    kind: 'phone',
    label: 'Phone',
    words: ['phone', 'mobile', 'mobileno', 'phoneno', 'contact', 'contactno', 'cell', 'mob', 'whatsapp', 'parentmobile', 'parentphone', 'मोबाईल', 'मोबाइल', 'फोन', 'संपर्क', 'भ्रमणध्वनी'],
  },
  { kind: 'email', label: 'Email', words: ['email', 'emailid', 'mail', 'ईमेल'] },
  { kind: 'address', label: 'Address', words: ['address', 'residentialaddress', 'addr', 'पत्ता', 'राहण्याचापत्ता'] },
  { kind: 'city', label: 'City', words: ['city', 'town', 'village', 'शहर', 'गाव'] },
  { kind: 'gender', label: 'Gender', words: ['gender', 'sex', 'लिंग'] },
  { kind: 'aadhaar', label: 'Aadhaar', words: ['aadhaar', 'aadhar', 'aadhaarno', 'aadharno', 'uidai', 'आधार', 'आधारक्रमांक'] },
  { kind: 'company', label: 'Organisation', words: ['company', 'organisation', 'organization', 'org', 'institute', 'school', 'college', 'संस्था', 'कंपनी'] },
  { kind: 'role', label: 'Role', words: ['role', 'category', 'type', 'passtype', 'भूमिका'] },
  { kind: 'validTill', label: 'Valid till', words: ['validtill', 'validupto', 'validity', 'expiry', 'expirydate', 'वैधता'] },
  { kind: 'issueDate', label: 'Issue date', words: ['issuedate', 'dateofissue', 'issued', 'joiningdate', 'doj', 'dateofjoining'] },
  { kind: 'photo', label: 'Photo file', words: ['photo', 'image', 'picture', 'pic', 'photofile', 'photoname', 'imagename', 'फोटो', 'छायाचित्र'] },
];

export const KIND_LABEL: Record<ColumnKind, string> = {
  ...Object.fromEntries(CONCEPTS.map((c) => [c.kind, c.label])),
  id: 'ID / code',
  date: 'Date',
  number: 'Number',
  text: 'Text',
  empty: 'Empty',
} as Record<ColumnKind, string>;

const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^a-z0-9ऀ-ॿ]/g, '');

/** Best concept for a header text (exact synonym, else contains a synonym). */
export function conceptFromName(header: string): { kind: ColumnKind; score: number } | null {
  const n = norm(header);
  if (!n) return null;
  for (const c of CONCEPTS) if (c.words.includes(n)) return { kind: c.kind, score: 1 };
  let best: { kind: ColumnKind; score: number } | null = null;
  for (const c of CONCEPTS) {
    for (const w of c.words) {
      if (w.length < 3) continue;
      if (n.includes(w) || (w.includes(n) && n.length >= 4)) {
        const score = 0.6 + 0.3 * (Math.min(w.length, n.length) / Math.max(w.length, n.length));
        if (!best || score > best.score) best = { kind: c.kind, score };
      }
    }
  }
  return best;
}

const DEV_DIGITS = '०१२३४५६७८९';
const toAscii = (s: string) => s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));

/** What the values look like, ignoring the header. */
function kindFromValues(values: string[]): { kind: ColumnKind; share: number } {
  const v = values.map((x) => toAscii(x.trim())).filter(Boolean);
  if (!v.length) return { kind: 'empty', share: 1 };
  const share = (re: RegExp) => v.filter((x) => re.test(x)).length / v.length;
  const tests: [ColumnKind, number][] = [
    ['photo', share(/\.(jpe?g|png|webp|bmp|gif|heic)$/i)],
    ['email', share(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i)],
    ['blood', share(/^(a|b|ab|o)\s*[+-]?(ve|ive|positive|negative)?$|^(a|b|ab|o)\s*(\+|-)$/i)],
    ['aadhaar', share(/^\d{4}\s?\d{4}\s?\d{4}$/)],
    ['phone', share(/^(\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}$|^\+?\d[\d\s-]{8,14}\d$/)],
    ['date', share(/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\s-][a-z]{3,9}[\s-]\d{2,4}$/i)],
    ['gender', share(/^(m|f|male|female|other|boy|girl|पुरुष|स्त्री|मुलगा|मुलगी)$/i)],
    ['id', share(/^(?=.*\d)[a-z0-9][a-z0-9/_-]{2,}$/i)],
    ['number', share(/^\d+$/)],
  ];
  // Serial numbers: 1, 2, 3, … in order.
  const nums = v.map(Number);
  if (v.length >= 3 && nums.every((n, i) => Number.isInteger(n) && (i === 0 || n === nums[i - 1] + 1))) return { kind: 'serial', share: 1 };
  for (const [kind, s] of tests) if (s >= 0.8) return { kind, share: s };
  return { kind: 'text', share: 1 };
}

export interface DetectedColumn {
  column: string;
  kind: ColumnKind;
  /** Card field this column goes into, `new:<name>` for a new field, or `skip`. */
  target: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  sample: string;
}

/** Which concept a card field stands for (e.g. "EmployeeID" → employeeId). */
function fieldConcept(field: string): ColumnKind | null {
  return conceptFromName(field.replace(/([a-z])([A-Z])/g, '$1 $2'))?.kind ?? null;
}

/** Concepts that can stand in for one another when matching to card fields. */
const COMPATIBLE: Partial<Record<ColumnKind, ColumnKind[]>> = {
  emergency: ['phone'],
  phone: ['emergency'],
  studentId: ['roll', 'id'],
  employeeId: ['id'],
  parent: ['father', 'mother'],
  father: ['parent'],
  mother: ['parent'],
  issueDate: ['date'],
  dob: ['date'],
};

/** Field name for a new column: canonical English name when recognised, else the column text. */
function fieldName(column: string, kind: ColumnKind): string {
  const c = CONCEPTS.find((x) => x.kind === kind);
  if (c && !/[\u0900-\u097F]/.test(column)) {
    return c.label.replace(/[^A-Za-z ]/g, '').replace(/(^|\s)(\w)/g, (_m, _s, ch: string) => ch.toUpperCase()).replace(/\s/g, '');
  }
  return column.replace(/\s+/g, ' ').trim();
}

export function detectColumns(columns: string[], rows: Record<string, string>[], fields: string[]): DetectedColumn[] {
  const fieldKinds = fields.map((f) => ({ field: f, kind: fieldConcept(f) }));
  const result: DetectedColumn[] = columns.map((col) => {
    const values = rows.slice(0, 200).map((r) => r[col] ?? '');
    const byName = conceptFromName(col);
    const byValue = kindFromValues(values);
    let kind: ColumnKind = byName?.kind ?? byValue.kind;
    // Values override a weak name guess (e.g. a column called "Contact" full of emails).
    if (byName && byName.score < 1 && ['email', 'photo', 'blood', 'aadhaar'].includes(byValue.kind)) kind = byValue.kind;
    if (!byName && byValue.kind === 'date') kind = 'date';
    return {
      column: col,
      kind: byValue.kind === 'empty' ? 'empty' : kind,
      target: '',
      confidence: byName?.score === 1 ? 'high' : byName ? 'medium' : 'low',
      reason: byName ? `name “${col}”` : `values look like ${KIND_LABEL[byValue.kind].toLowerCase()}`,
      sample: values.find((x) => x.trim()) ?? '',
    };
  });

  // Score every column × field pair, then assign best pairs first (one-to-one).
  const pairs: { ci: number; field: string; score: number }[] = [];
  result.forEach((c, ci) => {
    for (const { field, kind } of fieldKinds) {
      let score = 0;
      if (norm(field) === norm(c.column)) score = 1;
      else if (kind && kind === c.kind) score = 0.9;
      else if (kind && COMPATIBLE[c.kind]?.includes(kind)) score = 0.6;
      if (score) pairs.push({ ci, field, score });
    }
  });
  pairs.sort((a, b) => b.score - a.score);
  const usedField = new Set<string>();
  for (const p of pairs) {
    const c = result[p.ci];
    if (c.target || usedField.has(p.field)) continue;
    c.target = p.field;
    usedField.add(p.field);
    if (p.score < 0.9 && c.confidence === 'high') c.confidence = 'medium';
  }

  for (const c of result) {
    if (c.target) continue;
    if (c.kind === 'empty') {
      c.target = 'skip';
      c.reason = 'column is empty';
    } else if (c.kind === 'serial') {
      c.target = 'skip';
      c.reason = 'serial numbers are added automatically';
    } else if (c.kind === 'photo') {
      c.target = 'new:PhotoFile';
      c.reason = 'photo file names — used by “Match photos”';
    } else {
      c.target = `new:${c.confidence === 'low' ? c.column.replace(/\s+/g, ' ').trim() : fieldName(c.column, c.kind)}`;
    }
  }
  return result;
}

/**
 * Picks the header row: the first row (in the top 15) that has the most
 * text-like, non-empty cells. Handles sheets that start with a title or logo row.
 */
export function findHeaderRow(grid: string[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(15, grid.length); r++) {
    const cells = grid[r].map((c) => String(c ?? '').trim()).filter(Boolean);
    const textLike = cells.filter((c) => !/^[\d\s./:-]+$/.test(c) && c.length <= 40).length;
    const unique = new Set(cells).size === cells.length;
    const hasDataBelow = grid.slice(r + 1, r + 4).some((row) => row.filter((c) => String(c ?? '').trim()).length >= Math.max(1, cells.length * 0.5));
    const score = textLike * (unique ? 1 : 0.5) * (hasDataBelow ? 1 : 0.3);
    if (score > bestScore + 0.5) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}
