import { execSync } from 'child_process';
import pg from 'pg';

async function restore() {
  const adminPool = new pg.Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/postgres'
  });
  
  console.log('Terminating connections to ronav_test_db...');
  await adminPool.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'ronav_test_db'
      AND pid <> pg_backend_pid();
  `);

  console.log('Dropping and recreating ronav_test_db...');
  await adminPool.query('DROP DATABASE IF EXISTS ronav_test_db');
  await adminPool.query('CREATE DATABASE ronav_test_db');
  await adminPool.end();

  console.log('Restoring from ronav_backup.sql...');
  const psqlPath = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
  execSync(`"${psqlPath}" -U postgres -d ronav_test_db -f ronav_backup.sql`, {
    env: { ...process.env, PGPASSWORD: 'postgres' },
    stdio: 'inherit'
  });
  console.log('✓ Successfully restored ronav_test_db from ronav_backup.sql!');
}

restore().catch(err => {
  console.error('Restore error:', err);
  process.exit(1);
});
