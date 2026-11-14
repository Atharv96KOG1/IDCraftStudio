export type ElementType = 'text' | 'image' | 'photo' | 'rect' | 'ellipse' | 'line' | 'qr' | 'barcode';
export type SideKey = 'front' | 'back';
export type Fit = 'cover' | 'contain' | 'stretch';
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'ITF14';

/** All positions and sizes are in millimetres, relative to the card's top-left corner. */
interface BaseElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  /** Supports placeholders like {{Name}}, {{Serial}}, {{IssueDate}}, {{Today}} */
  text: string;
  fontFamily: string;
  /** Font size in points */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  vAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  /** Shrink the font so a single line always fits the box (good for long names). */
  autoShrink: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  fit: Fit;
  radius: number;
}

export interface PhotoElement extends BaseElement {
  type: 'photo';
  fit: Fit;
  radius: number;
  borderColor: string;
  borderWidth: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
}

export interface QrElement extends BaseElement {
  type: 'qr';
  value: string;
  color: string;
  background: string;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  value: string;
  format: BarcodeFormat;
  color: string;
  showText: boolean;
}

export type CardElement =
  | TextElement
  | ImageElement
  | PhotoElement
  | RectElement
  | EllipseElement
  | LineElement
  | QrElement
  | BarcodeElement;

export interface CardSide {
  background: string;
  backgroundImage: string | null;
  elements: CardElement[];
}

export interface Template {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  hasBack: boolean;
  front: CardSide;
  back: CardSide;
  /** Data fields records of this template carry (column names). */
  fields: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Person {
  id?: number;
  templateId: string;
  serial: number;
  fields: Record<string, string>;
  photo: string | null;
  /** Unedited photo, kept so the photo can be re-edited. */
  photoOriginal?: string | null;
  createdAt: number;
  printCount: number;
  printedAt: number | null;
}

export const SYSTEM_FIELDS = ['Serial', 'IssueDate', 'Today', 'AllDetails', 'vCard'] as const;
