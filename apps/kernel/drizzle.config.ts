import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: '../../packages/projects/src/schema.ts',
  out: './src/storage/migrations',
});
