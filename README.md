# Coloring Book

A simple, fully offline coloring app for Android, iPhone and iPad, built with Expo (React Native) and
[React Native Skia](https://shopify.github.io/react-native-skia/).

## Features

- **Local user profiles.** "Who's coloring?" picker on launch. Each user has their own coloring.
- **Books → pages → coloring**, in a dark UI.
- **No zoom.** The page always fits the screen, so every touch colors.
- **Landscape layout.** In landscape the back button, the crayons (in a column pointing at the page)
  and the tool buttons move to the left and right sides, so the page gets the full height.
- **Add books and pages in the app.** Tap the pencil on the books screen or inside a book to edit.
  - **New book:** a name plus an optional cover.
  - **Add pages:** pick many images at once from Photos or Files.
  - **Rename:** long-press a book or page added in the app.
  - **Remove:** tap the red ✕ on a book or page. Removing one also deletes everyone's coloring on it.
    Built-in books and pages are only hidden, and Settings can bring them back.
  - Images added in the app are stored on the device as PNGs (max 2048 px). PDFs can't be added
    in the app; put them in `ColoringPages/` instead.
- **Each page is a layer over the base image.** The line art is multiplied on top of the color layer,
  so color never covers the lines, and the eraser only removes color.
- **Brushes:** fill bucket, crayon (grainy), marker, paintbrush (tapered, via
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand)), pencil, highlighter, spray, eraser.
  There's one size slider for all of them.
- **Swipeable crayon box** with about 75 colors.
- **Undo / redo.**
- **Resets:** a page (the toolbar button, or long-press a page), a book (the button in the book header,
  or Settings), or everything a user has colored (Settings, or long-press the user on the picker).

## Running

```bash
npm install
npm start             # converts ColoringPages, then starts Expo; press a for Android or i for iOS,
                      # or scan the QR code with Expo Go
```

`npx tsc --noEmit` type-checks the project.

## Builds (GitHub Actions)

`.github/workflows/build.yml` runs on pushes to `main`, on pull requests and on demand (Actions tab, then
**Run workflow**). It needs no secrets.

- **Typecheck**
- **Android APK.** Download `coloring-book-android` from the run's artifacts and install it on any Android
  device. It is signed with the debug key, which is fine for sideloading but not for the Play Store.
- **iOS simulator build.** `coloring-book-ios-simulator` is an unsigned `.app` for the iOS Simulator.
  This job mainly checks that the iOS project compiles.

Installing on a real iPhone/iPad, or publishing to the stores, requires signing. Use EAS for that
(`npx eas-cli@latest build`), which needs an Expo account and an Apple Developer account.

## Adding artwork

All books live in `ColoringPages/`. Each sub-folder is one book:

```
ColoringPages/
  animals/
    _book.json
    cover.png
    cat.png
    fish.jpg
    ...
```

`_book.json` describes the book. Paths are relative to the book's folder:

```json
{
  "name": "Animals",
  "cover": "cover.png",
  "pages": [
    { "name": "Cat", "path": "cat.png" },
    { "name": "Fish", "path": "fish.jpg" },
    { "name": "Lion", "path": "safari.pdf", "page": 3 }
  ]
}
```

- **`name`**: the book title shown in the app.
- **`cover`** (optional): the cover image. Without it, the book uses its first page.
- **`pages`**: listed in the order they appear. Each needs a `name` (shown under the page) and a `path`.
  For PDFs, `page` picks which page to use (default 1), so one PDF can supply many coloring pages.
- **Supported files:** PDF, PNG, JPG/JPEG, GIF, WebP, SVG, TIFF, BMP, AVIF.
  Pages work best as black line art on a white or transparent background, with closed outlines so
  the fill bucket doesn't leak.
- **Order:** books are sorted by folder name, so prefix folders (`01-animals`, `02-space`) to control it.

Then run `npm run content`. This also runs automatically on `npm install` and `npm start`. It
converts every image to a PNG at most 2048 px on a side, with transparency flattened to white, in
`generated/`, and it writes `src/content/books.generated.ts`. Both are git-ignored. If something is
wrong, such as a missing file, bad JSON or a PDF page that doesn't exist, it stops and names the file.

**Ids:** saved coloring is keyed by the book's folder name and each page's file name (plus `-p<N>`
for PDF pages after the first). Renaming a folder or file after people have started coloring hides
their saved coloring for it. To rename a file safely, add `"id": "<old file name>"` to that page.

### Church coloring pages

The `church-*` books are the coloring pages from the Church of Jesus Christ's
[Coloring Pages](https://www.churchofjesuschrist.org/media/collection/coloring-pages-images?lang=eng)
collection, one book per grouping on that page (Family History, General, Christmas, Book of Mormon,
Pearl of Great Price, General Conference). Re-download or update them with
`node scripts/fetch-church-coloring-pages.mjs`, which skips files already present and rewrites each
`_book.json`. The images are © by Intellectual Reserve, Inc. Check the site's terms of use before you
distribute them.

The other books in `ColoringPages/` are placeholders. They include a JPG, a WebP, a PDF and an SVG
so every converter path is exercised.

## Storage

Everything is stored on the device under `<documents>/coloring/`:

```
users.json
users/<userId>/<bookId>/<pageId>.json   ordered list of strokes and fills (the color layer)
users/<userId>/<bookId>/<pageId>.png    thumbnail shown in the page grid
library/library.json                    books and pages added in the app, and hidden built-ins
library/images/<id>.png                 images added in the app
```

Strokes are saved in base-image pixels, and fills are saved as tap points that get recomputed on load.
That keeps layers small and independent of screen size. Resetting a page, book or user deletes the
matching file or folder.

## Code map

| Path | What |
|---|---|
| `ColoringPages/` | Book and page artwork plus `_book.json` (source of truth) |
| `scripts/build-content.mjs` | Converts `ColoringPages/` into bundled PNGs and the generated book list |
| `scripts/fetch-church-coloring-pages.mjs` | Downloads the Church coloring pages into `ColoringPages/church-*` |
| `src/app/` | Screens (Expo Router): profiles, books, book pages, coloring, settings |
| `src/drawing/ColoringCanvas.tsx` | Fit-to-screen canvas and touch handling |
| `src/drawing/PageArtwork.tsx` | Draw order: paper, color layer, line art |
| `src/drawing/brushes.tsx` | Brush definitions and rendering |
| `src/drawing/floodFill.ts` | Fill bucket |
| `src/components/CrayonPicker.tsx` | The crayon palette |
| `src/state/` | Users and on-device storage |
