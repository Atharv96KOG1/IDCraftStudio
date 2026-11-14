# IDCraft Studio

Windows and Mac desktop app for designing, filling and printing ID cards. Built with Electron, React and Konva. All data is stored locally on the PC (IndexedDB); nothing is uploaded anywhere.

## Features

- **Card designer** – front and back, text, record photo, images/logos, rectangles, ellipses, lines, QR codes and barcodes (Code 128, Code 39, EAN-13, ITF-14). Drag, resize, rotate, snap guides, layers, lock/hide, alignment, undo/redo, copy/paste, keyboard nudging.
- **Card sizes** – CR80 landscape/portrait, CR79, badge sizes, or custom.
- **Data fields** – put `{{FieldName}}` in any text, QR or barcode. Automatic fields: `{{Serial}}`, `{{IssueDate}}`, `{{Today}}`. "Shrink to fit" keeps long names on one line.
- **Records** – add/edit people, photo upload or webcam capture, search, filter (not printed / missing photo), auto serial numbers, print history.
- **Excel / CSV import** – column-to-field mapping with preview; unknown columns become new fields. Sample sheet download and Excel export.
- **Bulk photo matching** – pick photos or a whole folder; files are matched to records by name (e.g. `EMP1023.jpg`).
- **Printing** – A4 or Letter sheets with as many cards as fit (portrait or landscape picked automatically), margins, gaps, cut marks, duplex (back sheets mirrored), or one-card-per-page for card printers. Save as PDF or print directly. 200/300/600 dpi.
- **Templates** – 3 starter designs plus blank, duplicate, import/export (`.idct`), PNG export.
- **Backup / restore** of all templates and records (`.idcb`).
- **Shapes, masks, icons and emoji** – stars, hexagons, waves, shields, ribbons…; photos can sit in a circle, hexagon, heart, shield or arch frame; 30 built-in icons (phone, email, address, blood group…) in any colour; emoji for field labels.
- **Photo lock** – locked photos always fill their frame; unlock to move, zoom and rotate the photo inside it.
- **Modern templates** – 6 new modern designs, including a Marathi one.
- **Data fields** – rename (card, QR codes and records update too), reorder, one-click “📞 Phone : {{Phone}}” labels.
- **Next year** – Template › Copy for next year changes 2025-26 → 2026-27, copies records and moves everyone up a class. ✎ Bulk edit changes any field for many records (set, find/replace, +1, English → Marathi).
- **Kruti Dev** – Unicode Marathi text is converted automatically for legacy Kruti Dev fonts.
- **Photo sizes** – crop to 35 × 45 mm, 50 × 50 mm, 4 × 6 in, 6 × 4 in or any custom size and save it as a 300 dpi photo.
- **Excel photos** – a column with camera file names (DSC0001.JPG, 001.jpg) puts the photos on the cards straight after import.
- **Sheet layout** – A4, A3, A5, Letter, Legal, 4 × 6 or custom paper; upright and turned cards are mixed to fit the most (11 CR80 cards on A4); back-sheet flip and mirror printing; exact card size.
- **Exports** – PDF, JPG sheets, HTML page, and every card as its own PNG/JPG at 300, 600, 1200 or 2400 dpi. Files are saved in Documents › IDCraft Studio and the folder opens when done.

## AI features (all offline)

- **Photo AI** – face detection (BlazeFace) and person/hair/skin segmentation (MediaPipe selfie multiclass) run locally via WebAssembly. One click crops to ID framing, straightens the head, fixes colour/exposure and can replace the background. Full manual controls too. Bulk "✨ AI photos" for many records.
- **AI Design** – describe a card in English or Marathi ("school ID, green, QR, portrait") and get 6 ready-made designs.
- **Smart import** – Excel/CSV columns are auto-detected from their names (English + Marathi synonyms) and values (phone, date, email, blood group, photo file names); finds the header row automatically.
- **QR "All details"** – each person's QR contains all their filled-in fields; "Contact card" makes a vCard.

## Licensing

The app has a 15-day trial, then needs a licence key. The trial start date is also stored in places an uninstall does not remove, so reinstalling does not restart the trial (a full Windows reinstall or a new PC does). Keys are signed with your Ed25519 **private key**, which stays on your computer at `~/.idcraft-license/private.pem` and is never in this repo. **Back that folder up** – without it you cannot issue keys that work with existing installs.

```bash
npm run keygen -- issue --name "Sunrise School" --machine K7QM-X2PA-9RTD-H4WB --days 365
npm run keygen -- issue --name "Sunrise School" --any-pc
```

The customer sees their Machine ID on the activation screen (or Settings ⚙ → Licence).

## Development

Requires Node.js 20+.

```bash
npm install
npm run app:dev      # desktop app with hot reload
npm run dev          # browser only, http://localhost:5173
npm run typecheck
```

## Building the Windows installer

On a Windows PC:

```bash
npm install
npm run dist:win     # creates release/IDCraft-Studio-Setup-1.0.0.exe
```

From a Mac, push the repo to GitHub and run the **Build Windows installer** workflow (Actions tab, or push a tag like `v1.0.0`). The `.exe` is attached to the run as an artifact.

To use a custom app icon, add `build/icon.ico` (256×256) before building.

## Project layout

```
electron/main.cjs        Electron window, camera permission
src/lib/types.ts         Template / element / record types
src/lib/render.ts        Card renderer (shared by editor, print and export)
src/lib/store.ts         Editor state, undo/redo
src/lib/db.ts            Local database, serials, backup
src/lib/print.ts         Sheet layout, PDF and print
src/lib/sheets.ts        Excel/CSV import and export
src/lib/templates.ts     Starter templates
src/components/          UI
```
