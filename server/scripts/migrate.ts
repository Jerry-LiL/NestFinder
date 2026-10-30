import { runMigrations } from '../src/migrate';

runMigrations()
  .then(() => {
    console.log('Migrations completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
