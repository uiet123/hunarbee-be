import { pool, query } from './packages/shared/src/db/pool';

async function test() {
  const pays = await query('SELECT id, program_id FROM payments;');
  const progs = await query('SELECT id, name FROM programs;');
  console.log('payments:', pays.rows);
  console.log('programs:', progs.rows);
  process.exit(0);
}
test();
