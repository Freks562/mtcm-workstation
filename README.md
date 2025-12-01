# MTCM Portal (v10.1)

## Run
1) `cp .env.example .env` and fill values.  
2) `npm install`  
3) `npm start` → http://localhost:3000

## Sign in
- Add your emails to `ALLOWED_EMAILS` and (optionally) `OWNER_EMAILS`.
- Visit `/signin` → Google → redirects to `/admin`.

## Pages
- `/` home
- `/federal` kit (+ ROM CSV)
- `/lead`, `/contact` (spam-protected)
- `/weather` (current + 5-day forecast, alerts, bookmarks, geolocate)
- `/ops` (token from Admin → Rotate Ops Token)

## APIs
- `/api/weather?city=...&units=metric|imperial` (or `lat&lon`)  
- `/api/forecast?city=...`  
- `/api/admin/config` GET/POST (admin)  
- `/api/admin/publish-css` (owner)  
- `/api/admin/publish-full` (owner)  
- `/api/admin/ops/rotate` (owner, one-time reveal)  
- `/api/ops/status?token=...`  
- `/healthz`, `/readyz`

## Deploy
- **Render:** use `render.yaml` (Web Service).  
- **Docker:** `docker compose -f docker-compose.prod.yml up -d --build`  
- **Fly:** add `FLY_API_TOKEN` repo secret; push to `main`.

> In Google Console add redirect URIs: `http://localhost:3000/auth/google/callback` and your prod domain variant.