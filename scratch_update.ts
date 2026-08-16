import { pool, query } from './packages/shared/src/db/pool';

async function updateDb() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update payments
    await client.query("UPDATE payments SET program_id = 'prog_frontend' WHERE program_id = 'fullstack'");
    await client.query("UPDATE payments SET program_id = 'prog_backend' WHERE program_id = 'backend'");

    // Update enrollments program_id
    await client.query("UPDATE enrollments SET program_id = 'prog_frontend' WHERE program_id = 'fullstack'");
    await client.query("UPDATE enrollments SET program_id = 'prog_backend' WHERE program_id = 'backend'");

    // Update enrollments duration_id
    await client.query("UPDATE enrollments SET duration_id = 'plan_fe_3m' WHERE program_id = 'prog_frontend' AND duration_id = '3-months'");
    await client.query("UPDATE enrollments SET duration_id = 'plan_fe_1m' WHERE program_id = 'prog_frontend' AND duration_id = '1-month'");
    
    await client.query("UPDATE enrollments SET duration_id = 'plan_be_1m' WHERE program_id = 'prog_backend' AND duration_id = '1-month'");

    await client.query("COMMIT");
    console.log("Database rows updated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateDb();
