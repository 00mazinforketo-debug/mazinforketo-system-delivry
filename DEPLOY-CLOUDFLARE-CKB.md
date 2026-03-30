# GitHub -> Cloudflare -> First Deploy

ئەم فۆڵدەرە copy ـێکی پاکی `webapp` ـە و بۆ upload کردن بۆ `GitHub` ئامادە کراوە.

## تیایە

- `src`
- `worker`
- `shared`
- `public`
- `migrations`
- config و package file ـە پێویستەکان

## تیایدا نییە

- top-level project ـی `admin`
- top-level project ـی `keto`
- `node_modules`
- `dist`
- `.env.local`
- `.dev.vars`
- log و pid file ـەکان

## هەنگاوی upload

1. ئەم فۆڵدەرە upload بکە بۆ `GitHub`
2. repo ـەکە connect بکە لە `Cloudflare Workers`
3. build command:

```bash
npm run build
```

4. deploy command:

```bash
npx wrangler deploy
```

## پێویستییەکان

- `D1 database`
- `R2 bucket`
- secret ی `PIN_PEPPER`

## env ـە frontend ـەکان

ئەگەر Firebase/Firestore بەکاردەهێنیت، ئەمانە لە Cloudflare زیاد بکە:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## فرمانە گرنگەکان

```bash
npm install
npm run db:migrate:remote
npx wrangler secret put PIN_PEPPER
npm run cf:deploy
```

## تێبینی

ناوی Worker لە `wrangler.jsonc` ئێستا:

```text
mazin-for-keto
```

پاش first deploy دەتوانیت `workers.dev` link بەکارهێنیت یان custom domain دابنێیت.
