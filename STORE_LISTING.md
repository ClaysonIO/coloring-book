# Store listing and submission checklist

Everything the App Store and Google Play ask for, in one place. The website lives in `docs/` and is published
to GitHub Pages by `.github/workflows/pages.yml`.

## URLs

| Field | URL |
|---|---|
| Marketing / website | https://claysonio.github.io/coloring-book/ |
| Privacy policy | https://claysonio.github.io/coloring-book/privacy.html |
| Support | https://claysonio.github.io/coloring-book/support.html |

One-time setup: in the repo on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. The
**Website** workflow then deploys `docs/` on every push to `main` that changes it (or run it from the Actions tab).

## Before submitting

- [ ] **Permission to use the Church's coloring pages.** The pages are © Intellectual Reserve, Inc. Both stores
      can reject or remove an app that uses someone else's content without permission (App Store guideline 5.2,
      Google Play's intellectual property policy). Check the
      [terms of use](https://www.churchofjesuschrist.org/legal/terms-of-use?lang=eng) and ask the Church's
      Intellectual Property Office for permission to distribute the pages in an app. Keep the reply, since Apple may
      ask for it. If permission isn't granted, ship without the `church-*` books in `ColoringPages/`.
- [ ] Release signing. The CI APK is signed with the debug key and can't go to Google Play. Build store binaries
      with EAS: `npx eas-cli@latest build --platform all --profile production`, then
      `npx eas-cli@latest submit`.
- [ ] Bump `expo.version` in `app.json` for each store release.
- [ ] Screenshots (see below).

## App details

- **Name:** Coloring Book (the App Store also allows up to 30 characters, e.g. "Coloring Book: Church Pages")
- **Subtitle (App Store, 30 chars):** `Every kid gets their own pages`
- **Short description (Google Play, 80 chars):**
  `Church coloring pages and a sketchbook. Every child gets their own pages.`
- **Category:** Education (secondary: Entertainment). On Google Play: Education or Art & Design.
- **Price:** Free. No ads, no in-app purchases.
- **Keywords (App Store, 100 chars):**
  `coloring,kids,drawing,sketchbook,church,primary,bible,scripture,crayons,paint,family,nativity,lds`

### Full description

> A coloring book and sketchbook for every kid in the house.
>
> Color more than 190 pages from The Church of Jesus Christ of Latter-day Saints, or draw your own pictures on
> blank pages. Each child picks their name when the app opens and gets their own copy of every page, so nobody
> colors over anyone else's work.
>
> • Separate pages for each child, with an optional PIN to prevent accidental resets
> • Reset one page, a whole book, or everything at once
> • A sketchbook of blank pages for free drawing
> • Fill bucket, crayon, marker, paintbrush, pencil, highlighter, spray and eraser
> • About 75 crayon colors, plus undo and redo
> • Colors never cover the lines
> • Turn your own photos into coloring pages and make your own books
> • Works offline, in portrait or landscape, on phones and tablets
>
> Free, with no ads, no in-app purchases, no accounts and no tracking. Everything stays on your device.
>
> Coloring pages © Intellectual Reserve, Inc. This app is a personal project and isn't made or endorsed by
> The Church of Jesus Christ of Latter-day Saints.

## Privacy answers

The app makes no network requests and has no analytics, ads or crash reporting.

**App Store → App Privacy:** choose **Data Not Collected**.

**Google Play → Data safety:**
- Does your app collect or share any of the required user data types? **No**
- Is all user data encrypted in transit? Not applicable (no data is transmitted). Answer **Yes** if a value is required.
- Do you provide a way for users to request that their data is deleted? Not applicable: there are no accounts. Data
  is deleted in the app or by uninstalling.

**Photos:** the app only sees images the user picks in the system photo or file picker. On iOS the permission
text is "Choose pictures to turn into coloring pages." Camera and microphone permissions are blocked in `app.json`.

**Export compliance (iOS):** `ios.config.usesNonExemptEncryption` is `false` in `app.json`, so App Store Connect
won't ask about encryption on each upload.

**Privacy manifest (iOS):** Expo SDK modules include their own required-reason API declarations. No extra
`ios.privacyManifests` entries are needed unless a new native library is added.

## Age rating and audience

**App Store age rating questionnaire:** answer **None** to every content question, and **No** to unrestricted web
access, user-generated content sharing, and gambling. Result: **4+**.

- Kids Category: optional. If you choose it (ages 5 and under or 6–8), Apple requires no third-party analytics or
  ads and a parental gate before links out of the app. The app already meets both, since it has no links out.

**Google Play → Content rating (IARC):** category **Reference, News, or Educational** (or **All other app types**).
Answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction, sharing of
location and personal info, and digital purchases. Expected result: **Everyone / PEGI 3**.

**Google Play → Target audience and content:** select the age groups you want (e.g. 5 and under, 6–8, 9–12, and
older). Including children under 13 puts the app under the **Families policy**: it needs a privacy policy (above),
no ads or only certified ad SDKs (none used), and no collection of personal information (none collected).

**Google Play → other declarations:** Ads: **No**. App access: **All functionality is available without special
access**. Government app: **No**. Financial features: **None**. Health: **None**.

## Screenshots

Required sizes:
- **iPhone:** 6.9" display, 1320 × 2868 portrait (or 2868 × 1320 landscape). 3–10 screenshots.
- **iPad:** 13" display, 2064 × 2752 portrait (or 2752 × 2064 landscape). Required because `supportsTablet` is on.
- **Google Play:** at least 2 phone screenshots (16:9 or 9:16, 320–3840 px), plus 7" and 10" tablet screenshots
  to be featured on tablets. Also a **512 × 512 icon** (`assets/icon.png` resized) and a **1024 × 500 feature
  graphic**.

Suggested shots:
1. "Who's coloring?" with a few kids' names
2. A page being colored, with the crayon box visible
3. The books screen
4. A sketchbook drawing
5. Settings with the PIN option

Capture them from a simulator or device running a release build. The images in `docs/images/` work for the website
but aren't the right sizes for the stores.
