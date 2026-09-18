# ui-jev

AI-generated UI in the style of [json-render.dev](https://json-render.dev/): **Jev plans, json-render renders.**

- `src/catalog.tsx` — guardrailed catalog: 12 components (`Page`, `Nav`, `Hero`, `Button`, `Grid`, `Card`, `Metric`, `Table`, `CodeBlock`, `Alert`, `Badge`, `Footer`)
- `server/jev.js` — live Jev planner: one speculative fan-out call (template + density + section Nouls + safety Nouls + depth Score)
- `server/policy.js` — code-owned policy: `render` / `review` / `refuse` with fail-closed thresholds
- `src/templates.ts` — code assembles the json-render spec; the model never writes JSON
- `src/App.tsx` — landing page (hero, live playground, steps, catalog browser, code, features)

Live-only: no mock fallback. Without `TYPESAFE_API_KEY`, `/api/plan` returns 503.

## Run

```bash
cp .env.example .env   # TYPESAFE_API_KEY from console.typesafe.ai/settings/keys
npm install
node scripts/test-policy.js   # policy unit tests (no key needed)
npm run build                 # typecheck + vite build
npm run server &              # planner on :8080 (serves dist/ too)
npm run dev                   # landing on :5173
```

## Flow

```
prompt → POST /api/plan → Jev (template, density, sections, safety)
       → decide() → { render | review | refuse }
       → assembleSpec() → <Renderer spec registry /> + confidence UI
```
