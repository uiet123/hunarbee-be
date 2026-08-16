import { pool, query } from './packages/shared/src/db/pool';

async function test() {
  const plans = await query('SELECT id, name FROM plans;');
  console.log('plans:', plans.rows);
  process.exit(0);
}
test();
