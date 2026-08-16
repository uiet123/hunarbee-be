import { pool, query } from './packages/shared/src/db/pool';

async function test() {
  const enrs = await query('SELECT id, program_id, duration_id FROM enrollments;');
  console.log('enrollments:', enrs.rows);
  process.exit(0);
}
test();
