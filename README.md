# LandSafe Intelligence Map

A Telangana training workspace for parcel selection, evidence review and printable customer briefs. The three parcels and findings are synthetic. Evidence edits are stored in the current browser so the hosted demo can be tested without collecting customer information.

## Local development

```sh
npm ci
npm run dev
```

Run `npm run build` to type-check the application and build the production files. The frontend includes a synthetic catalogue fallback and a simplified map diagram. The online map uses MapLibre and OpenFreeMap. Optional satellite tiles require a licensed tile URL and attribution. See `.env.example`.

## Hosting and data

Import this repository as a Vite project in Vercel. The Python function at `/api/parcels` reads the synthetic catalogue. Apply the Supabase migration to an empty project with PostGIS, then add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as server environment variables. The function falls back to fixtures when the database is absent or unavailable. Its response identifies the source.

Use sample information only. The public demo table is read-only to browser clients. Before a real customer pilot, add staff authentication, case-scoped authorization and private evidence storage, then verify the parcel and lake sources with a GIS reviewer.
