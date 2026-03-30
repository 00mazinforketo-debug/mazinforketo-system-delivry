import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './worker/src/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    databaseId: 'replace-with-your-d1-database-id',
    token: 'set-via-cli',
    accountId: 'set-via-cli',
  },
});
