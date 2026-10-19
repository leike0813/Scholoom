import { createRequire } from 'node:module';
import { join } from 'node:path';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);
const internal = process.argv[2];
const database = new Database(join(internal, 'project.sqlite'));
const transaction = database.transaction.bind(database);
database.transaction = (callback) =>
  transaction((...args) => {
    callback(...args);
    process.send({ stage: 'before-commit' });
    for (;;) {}
  });
await initializeProjectContainer(database, internal);
