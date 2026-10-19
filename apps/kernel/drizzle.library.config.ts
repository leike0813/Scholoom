import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: '../../packages/library/src/schema.ts',
  out: '../../packages/library/src/migrations',
});
