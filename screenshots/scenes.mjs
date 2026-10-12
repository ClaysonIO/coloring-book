/**
 * What screenshots/capture.mjs photographs: the devices (screen sizes), the starting data every
 * scene shares, and the scenes themselves. Add a scene by appending to SCENES; add a size by
 * adding to DEVICES. See screenshots/README.md.
 */

/**
 * CSS viewport size and pixel ratio. The saved PNG is width*scale x height*scale, so these match
 * the sizes the stores ask for.
 */
export const DEVICES = {
  /** The website's phone pictures. 780 x 1688. */
  phone: { width: 390, height: 844, scale: 2 },
  /** App Store, iPhone 6.9" display: 1320 x 2868. */
  'iphone-6.9': { width: 440, height: 956, scale: 3 },
  /** App Store, iPad 13" display: 2064 x 2752 portrait, 2752 x 2064 landscape. */
  'ipad-13': { width: 1032, height: 1376, scale: 2 },
  'ipad-13-landscape': { width: 1376, height: 1032, scale: 2 },
  /** Google Play phone (9:18): 1080 x 2160. */
  'android-phone': { width: 400, height: 800, scale: 2.7 },
  /** Google Play 10" tablet, landscape: 2560 x 1600. */
  'android-tablet': { width: 1280, height: 800, scale: 2 },
};

const EMMA = 'emma';
const CHRISTMAS = 'church-03-christmas';
const BOOK_OF_MORMON = 'church-04-book-of-mormon';
/** Wide page for landscape screens, tall page for portrait ones, so the page fills the screen. */
const NATIVITY = 'nativity-line-art-aa8c85e';
const HOLY_FAMILY = 'joseph-mary-baby-jesus-whittaker-a234e87';
const pageFor = (device) => (device.width > device.height ? NATIVITY : HOLY_FAMILY);

/** The data on the "device" before each scene starts. Scenes can override any of it with `fixture`. */
export const fixture = {
  users: [
    { id: EMMA, name: 'Emma', color: '#F28B82', createdAt: 1 },
    { id: 'liam', name: 'Liam', color: '#8AB4F8', createdAt: 2 },
    { id: 'sophie', name: 'Sophie', color: '#C58AF9', createdAt: 3 },
    { id: 'noah', name: 'Noah', color: '#81C995', createdAt: 4 },
  ],
  /** Install the website's book packs (built from BookPacks/ into docs/packs). */
  packs: true,
  /**
   * Pages colored before the scene starts. `auto` taps the fill bucket in each area of the line art
   * (progress: share of areas colored, top to bottom; background: color for the area around the
   * picture; seed: picks the colors). Give `ops` instead to supply exact strokes and fills.
   */
  colorings: [
    { userId: EMMA, bookId: CHRISTMAS, pageId: NATIVITY, auto: { progress: 0.65, background: '#FFE082', seed: 7 } },
    { userId: EMMA, bookId: CHRISTMAS, pageId: HOLY_FAMILY, auto: { progress: 0.6, background: '#B3E5FC', seed: 4 } },
    { userId: EMMA, bookId: CHRISTMAS, pageId: 'angels-shepherds-7d7ff1c', auto: { background: '#81D4FA', seed: 3 } },
    { userId: EMMA, bookId: CHRISTMAS, pageId: 'family-christmas-98ac8f0', auto: { background: '#C5E1A5', seed: 11 } },
    { userId: EMMA, bookId: CHRISTMAS, pageId: 'mary-baby-jesus-67218dd', auto: { background: '#B3E5FC', seed: 5 } },
    { userId: EMMA, bookId: CHRISTMAS, pageId: 'christmas-tree-c20e5fb', auto: { progress: 0.5, seed: 9 } },
  ],
};

/** Drawing helpers for the sketchbook scene: shapes as lists of 0–1 page coordinates. */
const ellipse = (cx, cy, rx, ry, from = 0, to = Math.PI * 2, n = 36) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

function houseDrawing(aspect) {
  // aspect = page width / height: r() turns a width-relative size into a height-relative one, so
  // circles stay round on any page shape.
  const r = (v) => v * aspect;
  const strokes = [];
  const rainbow = ['#F44336', '#FF9800', '#FFEB3B', '#43A047', '#1E88E5', '#673AB7'];
  rainbow.forEach((color, i) =>
    strokes.push({ tool: i === 0 ? 'Paint' : undefined, color, points: ellipse(0.5, 0.56, 0.44 - i * 0.035, r(0.44 - i * 0.035) * 0.75, Math.PI, Math.PI * 2) }),
  );
  strokes.push({ color: '#FDD835', points: ellipse(0.15, 0.13, 0.07, r(0.07), 0, Math.PI * 2, 40) });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    strokes.push({ points: [[0.15 + Math.cos(a) * 0.09, 0.13 + Math.sin(a) * r(0.09)], [0.15 + Math.cos(a) * 0.13, 0.13 + Math.sin(a) * r(0.13)]] });
  }
  strokes.push({ color: '#43A047', points: [[0.02, 0.9], [0.2, 0.88], [0.4, 0.91], [0.6, 0.88], [0.8, 0.9], [0.98, 0.88]] });
  strokes.push({ color: '#8D5524', tool: 'Crayon', points: [[0.3, 0.88], [0.3, 0.62], [0.58, 0.62], [0.58, 0.88]] });
  strokes.push({ color: '#D32F2F', points: [[0.27, 0.63], [0.44, 0.46], [0.61, 0.63]] });
  strokes.push({ color: '#1E88E5', points: [[0.34, 0.68], [0.4, 0.68], [0.4, 0.75], [0.34, 0.75], [0.34, 0.68]] });
  strokes.push({ color: '#FB8C00', points: [[0.47, 0.88], [0.47, 0.73], [0.53, 0.73], [0.53, 0.88]] });
  // A flower.
  strokes.push({ color: '#2E7D32', points: [[0.78, 0.9], [0.78, 0.74]] });
  strokes.push({ color: '#EC407A', points: ellipse(0.78, 0.72, 0.035, r(0.035)) });
  return strokes;
}

/**
 * Each scene starts on the "Who's coloring?" screen with `fixture` on the device. `run` gets the
 * helpers from capture.mjs: tap(label), chooseUser(name), go(href), back(), crayon(hex), tool(label),
 * draw(strokes), pageBox(), settle(ms) and the Playwright `page`, plus the device and theme.
 */
export const SCENES = [
  {
    name: 'profiles',
    description: "Who's coloring? Each child picks their name.",
    run: async () => {},
  },
  {
    name: 'coloring',
    description: 'A page part-way through, with the crayon box and tools.',
    run: async (app, device) => {
      await app.chooseUser('Emma');
      await app.go(`/color/${CHRISTMAS}/${pageFor(device)}`);
      await app.crayon('#1E88E5');
    },
  },
  {
    name: 'books',
    description: 'The bookshelf: the sketchbook, the built-in book and downloaded books.',
    run: async (app) => {
      await app.chooseUser('Emma');
    },
  },
  {
    name: 'pages',
    description: "A book's pages, with the ones Emma has colored.",
    run: async (app) => {
      await app.chooseUser('Emma');
      await app.go(`/book/${CHRISTMAS}`);
    },
  },
  {
    name: 'sketchbook',
    description: 'A drawing on a blank sketchbook page.',
    run: async (app) => {
      await app.chooseUser('Emma');
      await app.go('/color/sketchbook/page-1');
      const box = await app.pageBox();
      await app.draw(houseDrawing(box.width / box.height));
      // On big screens headless Chromium sometimes stops repainting the canvas after many strokes;
      // reopening the page draws the saved strokes afresh.
      await app.back();
      await app.go('/color/sketchbook/page-1');
      await app.crayon('#EC407A');
    },
  },
  {
    name: 'tools',
    description: 'The brushes and the size slider.',
    run: async (app, device) => {
      await app.chooseUser('Emma');
      await app.go(`/color/${CHRISTMAS}/${pageFor(device)}`);
      await app.tap('Coloring tools');
    },
  },
  {
    name: 'more-books',
    description: 'Downloading more books from the website.',
    run: async (app) => {
      await app.chooseUser('Emma');
      await app.go('/get-books');
    },
  },
];

/**
 * The website's pictures (`--website`): written to docs/images/<file>, resized to `width` px. Each
 * comes in light and dark (…-dark.jpg); the site shows the one matching its theme.
 */
export const WEBSITE = [
  { device: 'phone', scene: 'coloring', file: 'screen-coloring' },
  { device: 'phone', scene: 'books', file: 'screen-books' },
  { device: 'phone', scene: 'profiles', file: 'screen-profiles' },
  { device: 'phone', scene: 'sketchbook', file: 'screen-sketchbook' },
  { device: 'ipad-13-landscape', scene: 'coloring', file: 'screen-coloring-tablet', width: 1600 },
].flatMap((shot) => [
  { ...shot, theme: 'light', file: `${shot.file}.jpg` },
  { ...shot, theme: 'dark', file: `${shot.file}-dark.jpg` },
]);
