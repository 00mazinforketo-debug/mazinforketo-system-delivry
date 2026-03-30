# سیستەمی Cloudflare بۆ بەڕێوەبردنی چێشتخانە

ئەم پڕۆژەیە ئێستا لە `local-first browser-only` گوازراوەتەوە بۆ `Cloudflare full-stack`.  
frontend بە `React + TypeScript + Vite + Tailwind CSS` ماوەتەوە، بەڵام source of truth ی داتا ئێستا لە `Cloudflare Worker + D1 + R2` ـە.

## پوختەی ئەرشیتێکچەری

- UI: `Sorani Kurdish RTL`
- Frontend: `React 18`, `TypeScript`, `Vite`, `React Router`, `Zustand`, `React Hook Form + Zod`
- Backend: `Cloudflare Workers` بە `Hono`
- Database: `Cloudflare D1`
- Image storage: `Cloudflare R2`
- Validation: `Zod`
- PWA: `manifest.webmanifest` + `service worker`
- Sync strategy:
  - smart polling لە پەیجە operational ـەکان
  - refresh لەسەر focus
  - refetch دوای mutation
  - local BroadcastChannel هێشتا بۆ tab/window sync ـی هەمان device بەکاردێت

## چی گۆڕاوە

- sessionی local لابرا و چوونەژوورەوە ئێستا backend-backed ـە.
- PIN هەر دەمێنێت وەک UX، بەڵام verify لە Worker ـدا دەکرێت.
- session token لە cookie ـی `HttpOnly` هەڵدەگیرێت.
- `IndexedDB` ئێستا source of truth نییە بۆ business data.
- menu, categories, media, orders, notifications, reports, analytics, settings هەموویان لە cloud هاوبەشن.
- وێنەکانی خواردن لە `R2` هەڵدەگیرێن، metadata ـیان لە `D1`.

## ڕۆڵەکان و PIN

- کارمەند: `بەهرە` — `2000`
- کارمەند: `ڕاژان` — `9889`
- کاپتن: `یوسف` — `4321`
- ئادمین: `ئادمین` — `9900`

## Folder Tree

```text
.
├─ migrations/
├─ public/
├─ shared/
│  ├─ models.ts
│  └─ schemas.ts
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ config/
│  ├─ features/
│  ├─ hooks/
│  ├─ lib/
│  ├─ stores/
│  └─ types/
├─ worker/
│  └─ src/
│     ├─ db/
│     ├─ lib/
│     ├─ env.ts
│     └─ index.ts
├─ .dev.vars.example
├─ drizzle.config.ts
├─ tsconfig.worker.json
├─ vite.config.ts
└─ wrangler.jsonc
```

## D1 tables

- `users`
- `sessions`
- `settings`
- `categories`
- `menu_items`
- `media_assets`
- `orders`
- `order_items`
- `notifications`
- `activity_logs`

## گرنگترین routeـەکان

- `/login`
- `/employee`
- `/employee/cart`
- `/employee/checkout`
- `/employee/orders`
- `/employee/history`
- `/employee/notifications`
- `/captain`
- `/captain/orders`
- `/captain/notifications`
- `/admin`
- `/admin/orders`
- `/admin/menu`
- `/admin/categories`
- `/admin/notifications`
- `/admin/reports`
- `/admin/employee-activity`
- `/admin/media`
- `/admin/activity`
- `/admin/settings`
- `/admin/settings/business`
- `/admin/settings/catalog`
- `/admin/settings/storage`
- `/admin/settings/maintenance`

## API surface

- `/api/health`
- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/settings`
- `/api/settings/business`
- `/api/settings/visibility`
- `/api/categories`
- `/api/menu-items`
- `/api/menu-items/:id/availability`
- `/api/media`
- `/media/:id`
- `/api/orders`
- `/api/orders/:id`
- `/api/orders/:id/status`
- `/api/notifications`
- `/api/activity`
- `/api/reports/summary`
- `/api/analytics/employee-activity`
- `/api/maintenance/prepare-blank`
- `/api/maintenance/orders/delete-preview`
- `/api/maintenance/orders/delete-execute`
- `/api/exports/orders.csv`
- `/api/exports/backup.json`
- `/api/import/backup`

## Cloudflare resources

پێویستت هەیە بە:

1. یەک `Worker`
2. یەک `D1 database`
3. یەک `R2 bucket`

## Environment vars

لە `wrangler.jsonc`:

- `APP_ENV`
- `APP_ORIGIN`
- `COOKIE_NAME`
- `SESSION_TTL_DAYS`

لە `.dev.vars` یان `wrangler secret`:

- `PIN_PEPPER`

## local setup

### 1. dependency

```bash
npm install
```

### 2. local secret

`.dev.vars.example` بکە بە `.dev.vars` و secretێکی درێژ دابنێ:

```text
PIN_PEPPER=replace-with-a-long-random-secret
```

### 3. local D1 migration

```bash
npx wrangler d1 migrations apply restaurant_ops --local
```

### 4. dev servers

API:

```bash
npm run dev:api
```

frontend:

```bash
npm run dev:web
```

یان هەردووکیان پێکەوە:

```bash
npm run dev:full
```

پاشان:

```text
http://127.0.0.1:5173/login
```

## build

```bash
npm run lint
npm run build
```

## remote migration و deploy

سەرەتا login بۆ Cloudflare:

```bash
npm run cf:login
```

پاشان remote migration:

```bash
npm run db:migrate:remote
```

secret زیاد بکە:

```bash
npx wrangler secret put PIN_PEPPER
```

deploy:

```bash
npm run cf:deploy
```

## auth model

- login بە PIN ـە
- PIN hash لە D1 هەڵدەگیرێت
- session token لە cookie ـی `HttpOnly` دەنووسرێت
- route guard هەیە بۆ:
  - employee/admin
  - captain/admin
  - admin-only

## order deletion بە بەروار

لە admin maintenance:

- deleteی `yesterday`
- deleteی `single day`
- deleteی `custom range`

پێش جێبەجێکردن preview دەبینرێت:

- `orderCount`
- `notificationCount`
- `activityLogCount`
- `totalSalesImpact`

linked cleanup behavior:

- `orders` دەسڕدرێنەوە
- `order_items` cascade دەبن
- `order notifications` cascade دەبن
- `order-scoped activity logs` cascade دەبن
- reports و employee activity دووبارە لە D1 هەژمار دەکرێن

## media behavior

- upload لە frontend دا compress دەبێت
- file دەچێتە `R2`
- metadata دەچێتە `D1`
- menu item لە `imageAssetId` بە asset ـەوە بەستراوە
- deleteی media بە safe detach دەکرێت

## offline behavior

ئەم version ـە cloud-backed ـە، بۆیە:

- app shell و static assetـەکان cache دەکرێن
- read-only shell کاتێک network لاوازە باشترە
- login/create/update/delete بۆ business data online پێویستن
- offline queue لەم قۆناغەدا نییە

## سنوورەکان

- `PIN auth` بۆ restaurant operations ـی سادە دروستە، نەک enterprise security
- true multi-device data sharing هەیە، بەڵام near-real-time بە polling ـە، نەک websocket/SSE
- free tier بۆ dev و pilotی بچووک باشە، بەڵام بۆ بەکارهێنانی ڕۆژانەی shared زوو `Workers Paid` باشترە
- service worker هێشتا source of truth نییە؛ cloud source of truth ـە

## verificationی جێبەجێکراو

ئەم migration ـە لەسەر ئەم workspace ـە تاقیکراوەتەوە بە:

```bash
npm run lint
npm run build
npx wrangler d1 migrations apply restaurant_ops --local
```

هەروەها local Worker health و smoke API test جێبەجێ کرا:

- `/api/health` وەڵامی `200` دا
- admin login / settings / category create / media upload / menu create
- employee order create
- captain status update بۆ `completed`
- reports / employee activity analytics
- delete-previewی orders بە بەروار
- exportی CSV و backupی JSON

artifact:

- `.codex-run/cloud-api-smoke.json`



