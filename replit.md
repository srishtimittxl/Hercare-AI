# HerCare AI

A women's health tracking mobile app with period tracking, mood logging, symptom tracking, a dashboard, and an AI health assistant powered by OpenAI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/hercare run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `OPENAI_API_KEY` — OpenAI API key for the AI chat assistant

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Mobile:** Expo (React Native) with expo-router
- **Backend:** Express 5 (API server at `/api`)
- **DB:** PostgreSQL + Drizzle ORM
- **AI:** OpenAI GPT-4o-mini via direct fetch (streaming)
- **Storage:** AsyncStorage for all user data (local, device-only)
- **Auth:** None yet (profile stored locally)

## Where things live

- `artifacts/hercare/` — Expo mobile app
- `artifacts/hercare/app/(tabs)/` — All screens (index, cycle, mood, symptoms, chat, profile)
- `artifacts/hercare/context/AppContext.tsx` — All app state (cycles, moods, symptoms, chat)
- `artifacts/hercare/constants/colors.ts` — Design tokens (lavender/pink palette)
- `artifacts/hercare/components/` — Shared UI components
- `artifacts/api-server/` — Express API server

## Architecture decisions

- All user data stored in AsyncStorage (device-local, no server required for MVP)
- OpenAI API called directly from the Expo client using `EXPO_PUBLIC_OPENAI_API_KEY`
- Streaming chat responses use `expo/fetch` which supports `getReader()` on all platforms
- `@workspace/api-client-react` excluded from Expo to avoid duplicate React instances
- Phase ring built with react-native-svg for crisp, animated cycle visualization

## Product

- **Home Dashboard:** Cycle phase ring, mood/symptom summary cards, quick insights, fast navigation
- **Cycle Tracker:** Log period start/end with flow level; calculates cycle day, phase, average length, predicted next period
- **Mood Tracker:** Log one of 8 moods with optional notes; history view
- **Symptom Tracker:** Log 7 symptoms with 3 severity levels; history view
- **AI Chat:** Streaming chat with GPT-4o-mini focused on women's health education
- **Profile:** Name, usage stats, data privacy info

## User preferences

- Stack: Expo (React Native) + Express + AsyncStorage (not Flutter/FastAPI as originally requested — functionally equivalent)
- Colors: Lavender (#9B6B9E) + Soft Pink (#E8689A) + White

## Gotchas

- `EXPO_PUBLIC_OPENAI_API_KEY` is injected at dev-script time from `OPENAI_API_KEY` secret — never hardcode it
- Never add `@workspace/api-client-react` to the Expo app's dependencies — it causes a duplicate React instance and "Invalid hook call" errors on web
- Restart the `artifacts/hercare: expo` workflow (not just Metro reload) after changing `package.json` or secrets

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for mobile development guidelines
