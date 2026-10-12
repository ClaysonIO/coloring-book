# Screenshots

Real screenshots of the app for the website and the app stores, taken from the app itself running in
headless Chromium. Nothing is mocked up: the screens are the app's own components, and pre-colored pages
use the app's own fill bucket and drawing code.

```bash
npx playwright install chromium          # once, if Playwright has no browser yet

node screenshots/capture.mjs             # every scene on every device -> screenshots/output/<device>/
node screenshots/capture.mjs --devices iphone-6.9,ipad-13 --scenes coloring,books
node screenshots/capture.mjs --themes light,dark   # -> screenshots/output/<device>-<theme>/
node screenshots/capture.mjs --website   # the website's pictures -> docs/images/screen-*.jpg
```

Add `--skip-build` to reuse the last web build when only `scenes.mjs` changed. Set `CHROMIUM_PATH` to use
a Chromium that's already installed instead of Playwright's.

## Sizes

`DEVICES` in [scenes.mjs](scenes.mjs) sets each screen size as a CSS viewport and pixel ratio, picked so
the PNGs come out at sizes the stores accept:

| Device              | PNG size    | For                              |
| ------------------- | ----------- | -------------------------------- |
| `phone`             | 780 × 1688  | the website                      |
| `iphone-6.9`        | 1320 × 2868 | App Store, iPhone 6.9" display   |
| `ipad-13`           | 2064 × 2752 | App Store, iPad 13" display      |
| `ipad-13-landscape` | 2752 × 2064 | App Store, iPad 13" (landscape)  |
| `android-phone`     | 1080 × 2160 | Google Play phone                |
| `android-tablet`    | 2560 × 1600 | Google Play 10" tablet           |

The web build has no status bar or safe-area insets, so screens start right at the top edge.

## Scenes

Each scene in `SCENES` starts on "Who's coloring?" with the `fixture` data on the device: four children,
the website's book packs installed (built from `BookPacks/` into `docs/packs/` if needed), and some pages
Emma has colored. `auto` colorings tap the fill bucket in each area of the line art, top to bottom, until
`progress` of them are done; give `ops` instead for exact strokes. A scene's `run` then drives the app with
helpers such as `chooseUser('Emma')`, `go('/book/church-03-christmas')`, `tap('Coloring tools')`,
`crayon('#1E88E5')` and `draw(strokes)`, which drags the mouse across the page like a finger.

`WEBSITE` lists the shots `docs/index.html` uses, in light and dark.

## How it works

- `capture.mjs` builds the app for the web with `SCREENSHOTS=1`, serves the build, and for each shot writes
  a `seed.json` of files, opens the app in Playwright, runs the scene and saves a screenshot. Requests the
  app makes to the website's packs are answered from `docs/packs/`.
- `metro.config.js` only changes anything when `SCREENSHOTS=1` and the platform is web: `expo-file-system`
  becomes [web/expo-file-system.js](web/expo-file-system.js), an in-memory file system filled from
  `seed.json`, and the entry point becomes [web/entry.js](web/entry.js), which loads Skia's WebAssembly
  and pre-colors pages ([web/colorPages.js](web/colorPages.js)) before starting the app.
- The phone and tablet apps never include any of this.
