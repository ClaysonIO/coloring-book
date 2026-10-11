# Coloring Book

A simple, fully offline coloring app for Android, iPhone and iPad, built with Expo (React Native) and
[React Native Skia](https://shopify.github.io/react-native-skia/).

## Features

- **Local user profiles.** "Who's coloring?" picker on launch. Each user has their own coloring.
- **Books → pages → coloring**, in a dark UI.
- **No zoom.** The page always fits the screen, so every touch colors.
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
npx expo start        # then press a for Android or i for iOS, or scan the QR code with Expo Go
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

1. Put PNGs in `assets/books/<book-id>/`. They should be black line art on a white (or transparent)
   background. Closed outlines make the fill bucket work best.
2. List them in `src/content/books.ts`. A book can have an optional `cover` image. Without one, it
   uses its first page.

Book and page `id`s are storage keys, so don't change them once people have started coloring.
The images in `assets/books/` now are placeholders.

## Storage

Everything is stored on the device under `<documents>/coloring/`:

```
users.json
users/<userId>/<bookId>/<pageId>.json   ordered list of strokes and fills (the color layer)
users/<userId>/<bookId>/<pageId>.png    thumbnail shown in the page grid
```

Strokes are saved in base-image pixels, and fills are saved as tap points that get recomputed on load.
That keeps layers small and independent of screen size. Resetting a page, book or user deletes the
matching file or folder.

## Code map

| Path | What |
|---|---|
| `src/app/` | Screens (Expo Router): profiles, books, book pages, coloring, settings |
| `src/drawing/ColoringCanvas.tsx` | Fit-to-screen canvas and touch handling |
| `src/drawing/PageArtwork.tsx` | Draw order: paper, color layer, line art |
| `src/drawing/brushes.tsx` | Brush definitions and rendering |
| `src/drawing/floodFill.ts` | Fill bucket |
| `src/components/CrayonPicker.tsx` | The crayon palette |
| `src/state/` | Users and on-device storage |
