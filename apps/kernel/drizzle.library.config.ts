import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/storage/library-schema.ts',
  out: './src/storage/library-migrations',
});
