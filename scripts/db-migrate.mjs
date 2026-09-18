/**
 * Database migration script
 */
import { runMigrations } from '../packages/database/schema.mjs';

console.log('Starting database migration...\n');

runMigrations()
  .then(() => {
    console.log('\n✓ Database migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✖ Database migration failed:', error);
    process.exit(1);
  });
