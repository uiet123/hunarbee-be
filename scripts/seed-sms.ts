import { pool } from "../packages/shared/src/db/pool";

async function seedSms() {
  const client = await pool.connect();
  try {
    console.log("Fetching enrollments...");
    const enrollments = await client.query("SELECT id, phone, status, created_at FROM enrollments");

    if (enrollments.rows.length === 0) {
      console.log("No enrollments found. Skipping SMS seeding.");
      return;
    }

    let inserted = 0;
    
    await client.query("BEGIN");
    
    for (const enr of enrollments.rows) {
      // 1. Enrollment SMS
      const isEnrFailed = Math.random() < 0.1;
      const enrError = isEnrFailed ? (Math.random() < 0.5 ? 'Invalid Number' : 'Network Error') : null;
      const enrStatus = isEnrFailed ? 'failed' : 'sent';
      const enrDate = new Date(enr.created_at);
      enrDate.setMinutes(enrDate.getMinutes() + 5);

      await client.query(
        `INSERT INTO sms_logs (enrollment_id, phone, sms_type, status, error_message, created_at)
         VALUES ($1, $2, 'enrollment', $3, $4, $5)`,
        [enr.id, enr.phone, enrStatus, enrError, enrDate.toISOString()]
      );
      inserted++;

      // 2. Certificate SMS (only if completed, or just randomly for seeding purposes)
      // Let's generate certificate SMS for ~30% of enrollments to simulate course completions
      if (Math.random() < 0.3 || enr.status === 'completed') {
        const isCertFailed = Math.random() < 0.1;
        const certError = isCertFailed ? 'Gateway Timeout' : null;
        const certStatus = isCertFailed ? 'failed' : 'sent';
        const certDate = new Date(enr.created_at);
        certDate.setMonth(certDate.getMonth() + 1); // 1 month later

        await client.query(
          `INSERT INTO sms_logs (enrollment_id, phone, sms_type, status, error_message, created_at)
           VALUES ($1, $2, 'certificate', $3, $4, $5)`,
          [enr.id, enr.phone, certStatus, certError, certDate.toISOString()]
        );
        inserted++;
      }
    }

    await client.query("COMMIT");
    console.log(`Successfully seeded ${inserted} SMS logs!`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed SMS logs:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSms();
