import { pool } from "../packages/shared/src/db/pool";

async function test() {
  const client = await pool.connect();
  try {
    const range = 'all';
    let timeFilter = "";
    let whereTime = "";
    if (range === '7') { timeFilter = "AND created_at >= NOW() - INTERVAL '7 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '7 days'"; }
    
    const isDaily = range === '7' || range === '30';
    const dateTruncFormat = isDaily ? 'day' : 'month';
    const charFormat = isDaily ? 'DD Mon' : 'Mon YYYY';

    console.log("3");
    const programPopResult = await client.query(
      `SELECT 
         pr.name as "programName",
         COUNT(e.id) as enrollments
       FROM enrollments e
       JOIN programs pr ON e.program_id = pr.id
       ${whereTime.replace('created_at', 'e.created_at')}
       GROUP BY pr.name
       ORDER BY enrollments DESC`
    );
    
    console.log("4");
    const paymentStatusResult = await client.query(
      `SELECT status, COUNT(*) as count FROM payments ${whereTime} GROUP BY status`
    );

    console.log("5");
    const occupationsResult = await client.query(
      `SELECT occupation, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY occupation`
    );

    console.log("6");
    const planPopResult = await client.query(
      `SELECT pl.name as "planName", COUNT(e.id) as count
       FROM enrollments e
       JOIN plans pl ON e.duration_id = pl.id
       ${whereTime.replace('created_at', 'e.created_at')}
       GROUP BY pl.name
       ORDER BY count DESC`
    );

    console.log("7");
    const geoResult = await client.query(
      `SELECT country_iso as country, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY country_iso ORDER BY count DESC LIMIT 5`
    );

    console.log("8");
    const batchResult = await client.query(
      `SELECT to_char(preferred_batch, 'DD Mon YYYY') as batch, COUNT(*) as count
       FROM enrollments
       WHERE preferred_batch >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY preferred_batch
       ORDER BY preferred_batch ASC LIMIT 10`
    );

    console.log("9");
    const completionResult = await client.query(
      `SELECT status, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY status`
    );

    console.log("Success!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
