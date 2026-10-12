This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Prompt log

This project is built entirely by AI, and the website publishes every prompt the user has given it at `docs/prompts.html` (linked from the "Slopware" banner on the home page). The page renders `docs/prompts.json`. Keep it current:

- **With every user prompt** in a conversation, add the prompt to `docs/prompts.json` and commit it with the rest of the work for that prompt. A prompt that changes no other files still gets logged and committed on its own.
- Group prompts by conversation. Each conversation has an `id` (the Claude Code session ID, e.g. the `session_...` in the `Claude-Session:` commit trailer, or from the `get_session` tool), a short `title`, its `started` time and its `prompts`. If the current conversation is already in the file, append to its `prompts`; otherwise add a new conversation at the end.
- Each prompt is `{ "ts": "<ISO 8601 time>", "text": "<the prompt>" }`. Copy the user's words verbatim (typos and all). Don't log system reminders, scheduled check-ins, CI or PR notifications, or messages from other agents: only what the user typed.
- Before committing, replace any secret in a prompt (passwords, keys, tokens, private URLs) with `[redacted]`. This file is public.
- Keep the file valid JSON, formatted with two-space indentation, oldest conversation first.

```json
{
  "conversations": [
    {
      "id": "session_...",
      "title": "Add a slopware warning",
      "started": "2026-10-12T16:27:19Z",
      "prompts": [{ "ts": "2026-10-12T16:27:19Z", "text": "Add a 'Slopware' warning to the web page..." }]
    }
  ]
}
```
