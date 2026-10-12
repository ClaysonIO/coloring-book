# Coloring Book

A simple coloring app for Android, iPhone and iPad, built with Expo (React Native) and
[React Native Skia](https://shopify.github.io/react-native-skia/). It ships with one book of animals; more books
are free downloads from the website, and everything works offline once downloaded.

**Website:** https://www.clayson.io/coloring-book/ ([privacy policy](https://www.clayson.io/coloring-book/privacy.html),
[support](https://www.clayson.io/coloring-book/support.html)). Its source is in `docs/`, and
`.github/workflows/pages.yml` publishes it. Store listing text and submission answers are in
[STORE_LISTING.md](STORE_LISTING.md). Screenshots for the website and the stores come from the real app:
`npm run screenshots` (see [screenshots/README.md](screenshots/README.md)).

## Features

- **Local user profiles.** "Who's coloring?" picker on launch. Each user has their own coloring.
- **Optional PIN per account** (Settings). With a PIN set, deleting the account, resetting all of its
  coloring, resetting a whole book, or removing a book asks for the PIN first. Clearing a single page
  never does. It's a kid lock: the PIN is stored on the device as plain text.
- **My Sketchbook.** Every user has their own sketchbook of blank pages for free drawing. It starts with
  one page. Tap **New page** to add more, and use edit mode to remove or rename pages. It can't be removed.
  The first time a page is opened, it's sized to fill all the space available for the page in the current
  orientation: landscape pages when opened in landscape, portrait when opened in portrait. After that its
  size is fixed, so the drawing never stretches.
- **Books → pages → coloring.**
- **Light and dark mode.** Follows the device by default; Settings → Appearance can pick Light or Dark for the
  whole device (saved in `<documents>/coloring/settings.json`). Colors live in `src/theme.ts`; components get
  them from `useTheme()` and `useThemedStyles()` in `src/state/ThemeContext.tsx`. The website has a matching
  toggle in its header (`docs/theme.js`), which follows the browser until someone picks the other theme.
- **More books.** The last tile on the books screen (and the books button in its header) opens **More Books**,
  which lists every book pack on the website with covers and page previews. **Download** adds a pack; packs
  already installed update by themselves when the website changes (see [Book packs](#book-packs-website-downloads)).
  The same screen imports a zip file of your own. The tile shows a badge when the website has packs the user
  hasn't seen yet.
- **No zoom.** The page always fits the screen, so every touch colors.
- **Landscape layout.** In landscape the back button, the crayons (in a column pointing at the page)
  and the tool buttons move to the left and right sides, so the page gets the full height.
- **Add books and pages in the app.** Tap the pencil on the books screen or inside a book to edit.
  - **New book:** a name plus an optional cover.
  - **Add pages:** pick many images at once from Photos or Files.
  - **Rename:** long-press a book or page added in the app.
  - **Remove:** tap the red ✕ on a book or page. Removing one also deletes everyone's coloring on it.
    Built-in books and pages are only hidden, and Settings can bring them back. A book from a pack is deleted,
    and stays gone when the pack updates; **More Books** can get it back.
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
**Run workflow**). It needs no secrets (the optional Android signing secrets are below). Pushes and pull requests only build when they change something the app
is built from (`src/`, `assets/`, `ColoringPages/`, the content build scripts, `app.json`, the package files,
`tsconfig.json` or the workflow itself). Website changes (`docs/`, `BookPacks/`) and doc edits skip it; the
**Website** workflow publishes those. If you add a new folder or config file the app is built from, add it to
the `paths` lists in the workflow.

- **Typecheck**
- **Android APK.** Download `coloring-book-android` from the run's artifacts and install it on any Android
  device. It is signed with the release key when the signing secrets below are set, otherwise with the
  public debug key (fine for trying the app, but anyone can sign an APK with it, and the Play Store rejects it).
- **iOS simulator build.** `coloring-book-ios-simulator` is an unsigned `.app` for the iOS Simulator.
  This job mainly checks that the iOS project compiles.

### Android release signing

Add these repository secrets (Settings → Secrets and variables → Actions) and the Android job signs with
your key instead of the debug key:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
| `ANDROID_KEY_ALIAS` | The key's alias |
| `ANDROID_KEY_PASSWORD` | The key password (optional; defaults to the keystore password) |

To create a keystore (keep the file and passwords somewhere safe; never commit them):

```bash
keytool -genkeypair -v -keystore release.keystore -alias coloring-book \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 release.keystore   # macOS: base64 -i release.keystore
```

If `ANDROID_KEYSTORE_BASE64` is unset, builds fall back to the debug key. Pull requests from forks never
get secrets, so they always use the debug key. Android only installs an update signed with the same key as
the installed app, so changing keys means uninstalling first, which deletes the colored pages saved on the
device. Pick a key once and keep it.

Installing on a real iPhone/iPad, or publishing to the stores, requires signing. Use EAS for that
(`npx eas-cli@latest build`), which needs an Expo account and an Apple Developer account.

## Adding artwork

There are two kinds of books:

- **Bundled** books live in `ColoringPages/` and ship inside the app. Keep this small: it's the animal book
  people see on first launch.
- **Book packs** live in `BookPacks/` and are published on the website for the app to download. See
  [Book packs](#book-packs-website-downloads).

Both use the same book folder layout. In `ColoringPages/`, each sub-folder is one book:

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
- **Reserved:** a folder can't be named `sketchbook`, which is reserved for My Sketchbook.
- **Order:** books are sorted by folder name, so prefix folders (`01-animals`, `02-space`) to control it.

Then run `npm run content`. This also runs automatically on `npm install` and `npm start`. It
converts every image to a PNG at most 2048 px on a side, with transparency flattened to white, in
`generated/`, and it writes `src/content/books.generated.ts`. Both are git-ignored. If something is
wrong, such as a missing file, bad JSON or a PDF page that doesn't exist, it stops and names the file.

**Ids:** saved coloring is keyed by the book's folder name and each page's file name (plus `-p<N>`
for PDF pages after the first). Renaming a folder or file after people have started coloring hides
their saved coloring for it. To rename a file safely, add `"id": "<old file name>"` to that page.

### Book packs (website downloads)

A pack is a zip of several books. Each folder in `BookPacks/` is one pack, holding a `_pack.json` and book
folders laid out exactly like `ColoringPages/`:

```
BookPacks/
  church/
    _pack.json                  { "title": "Church Coloring Pages", "description": "…" }
    church-01-family-history/
      _book.json
      …
```

`npm run packs` (`scripts/build-packs.mjs`) builds them into `docs/packs/` (git-ignored):

- `index.json`: the catalog. The app reads it from `https://www.clayson.io/coloring-book/packs/index.json`
  (`src/content/catalog.ts`), and so does the website's [books page](https://www.clayson.io/coloring-book/books.html).
- `<pack>-<version>.zip`: the pack. JPEGs up to 2048 px are copied as they are; everything else is converted
  to PNG, so installing on a device is mostly copying files. Each book's `_book.json` inside lists page `id`s.
- `<pack>/<book>/*.jpg`: cover and page thumbnails for the website and the app's **More Books** screen.

The version is a hash of the pack's content, so it only changes when the pack does.

**Publishing:** the **Website** workflow (`.github/workflows/pages.yml`) builds the packs and deploys them with
`docs/` on every push to `main` that touches `BookPacks/` or `docs/`. No app release is needed:

- A new pack appears in the app's **More Books** list (with a badge on the tile) the next time the app checks.
- A changed pack updates itself in the background on devices that have it.
- The app checks when it opens and when it comes back after 30 minutes or more.

Book ids must be unique across every pack and `ColoringPages/` (the build checks), and stable: a pack book
keeps its folder name as its id, so coloring is kept across updates. The church books keep the ids they had
when they were bundled, so coloring done before this change comes back when the pack is downloaded.

**Zips people make themselves** can be imported from **More Books → Choose a zip file**. Either use the layout
above (`_book.json` per book folder, optionally a `_pack.json` with an `id` so re-importing replaces it), or just
put pictures in it: every folder of pictures becomes a book named after the folder, and pictures at the top
level make a book named after the zip. PNG, JPEG, GIF, WebP and HEIC work (decoded by the device); PDFs and SVGs
don't, so convert them first or ship them in a pack.

### Church coloring pages

The books in `BookPacks/church/` are the coloring pages from the Church of Jesus Christ's
[Coloring Pages](https://www.churchofjesuschrist.org/media/collection/coloring-pages-images?lang=eng)
collection, one book per grouping on that page (Family History, General, Christmas, Book of Mormon,
Pearl of Great Price, General Conference). They're a download from the website, not part of the app.
Re-download or update them with `node scripts/fetch-church-coloring-pages.mjs`, which skips files already
present and rewrites each `_book.json`. The images are © by Intellectual Reserve, Inc. Check the site's terms of use before you
distribute them.

## Storage

Everything is stored on the device under `<documents>/coloring/`:

```
users.json
users/<userId>/<bookId>/<pageId>.json   ordered list of strokes and fills (the color layer)
users/<userId>/<bookId>/<pageId>.png    thumbnail shown in the page grid
users/<userId>/sketchbook.json          the user's sketchbook page list
library/library.json                    books and pages added in the app, installed packs, hidden built-ins
library/images/<id>.png|jpg             images added in the app or from packs
library/catalog.json                    the website's pack list, as last seen (for offline use)
```

Strokes are saved in base-image pixels, and fills are saved as tap points that get recomputed on load.
That keeps layers small and independent of screen size. Resetting a page, book or user deletes the
matching file or folder.

## Code map

| Path | What |
|---|---|
| `ColoringPages/` | Bundled books: artwork plus `_book.json` |
| `BookPacks/` | Downloadable book packs published on the website |
| `scripts/build-content.mjs` | Converts `ColoringPages/` into bundled PNGs and the generated book list |
| `scripts/build-packs.mjs` | Builds `BookPacks/` into zips, thumbnails and `docs/packs/index.json` |
| `scripts/content-lib.mjs` | Book reading and image conversion shared by both build scripts |
| `scripts/fetch-church-coloring-pages.mjs` | Downloads the Church coloring pages into `BookPacks/church/` |
| `src/app/` | Screens (Expo Router): profiles, books, book pages, coloring, settings, more books |
| `src/content/catalog.ts` | Website URLs and the pack catalog format |
| `src/state/packs.ts` | Downloading and reading pack zips |
| `src/drawing/ColoringCanvas.tsx` | Fit-to-screen canvas and touch handling |
| `src/drawing/PageArtwork.tsx` | Draw order: paper, color layer, line art |
| `src/drawing/brushes.tsx` | Brush definitions and rendering |
| `src/drawing/floodFill.ts` | Fill bucket |
| `src/components/CrayonPicker.tsx` | The crayon palette |
| `src/state/` | Users and on-device storage |
