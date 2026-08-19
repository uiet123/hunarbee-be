import { pool } from "../packages/shared/src/db/pool";

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Fetching existing programs and plans...");
    const programsRes = await client.query("SELECT id, name FROM programs WHERE status = 'published'");
    const plansRes = await client.query("SELECT id, program_id, price_paise FROM plans WHERE status = 'published'");
    
    if (programsRes.rows.length === 0) {
      console.log("No published programs found. Please create some programs first.");
      return;
    }

    const programs = programsRes.rows;
    const plansByProgram = plansRes.rows.reduce((acc, plan) => {
      if (!acc[plan.program_id]) acc[plan.program_id] = [];
      acc[plan.program_id].push(plan);
      return acc;
    }, {});

    console.log(`Found ${programs.length} programs.`);

    await client.query("BEGIN");

    // Generate data for the last 6 months
    const monthsBack = 6;
    const recordsPerMonth = 15; // 15 students per month approx
    
    let totalInserted = 0;

    for (let i = monthsBack; i >= 0; i--) {
      // Current month being seeded
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      // Randomize number of enrollments for a realistic graph curve
      // E.g., growing over time
      const targetRecords = Math.floor(recordsPerMonth * (1 + (monthsBack - i) * 0.3)) + Math.floor(Math.random() * 5);
      
      for (let j = 0; j < targetRecords; j++) {
        // Randomize day in the month
        const seedDate = new Date(date);
        seedDate.setDate(Math.floor(Math.random() * 28) + 1);
        
        // Pick random program
        const program = programs[Math.floor(Math.random() * programs.length)];
        const programPlans = plansByProgram[program.id] || [];
        
        // Fallbacks if no plan found
        const planId = programPlans.length > 0 ? programPlans[Math.floor(Math.random() * programPlans.length)].id : 'fallback-plan';
        const pricePaise = programPlans.length > 0 ? programPlans[0].price_paise : 149900;

        const orderId = `order_seed_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const email = `student_${Date.now()}_${j}@example.com`;
        
        // Insert Payment
        const paymentRes = await client.query(
          `INSERT INTO payments (razorpay_order_id, razorpay_payment_id, amount_paise, currency, status, program_id, duration_id, applicant_name, applicant_email, applicant_phone, country_iso, created_at, updated_at)
           VALUES ($1, $2, $3, 'INR', 'paid', $4, $5, 'Seed Student', $6, '9999999999', 'IN', $7, $7)
           RETURNING id`,
          [orderId, `pay_seed_${Date.now()}_${j}`, pricePaise, program.id, planId, email, seedDate.toISOString()]
        );
        
        const paymentId = paymentRes.rows[0].id;

        // Insert Enrollment
        await client.query(
          `INSERT INTO enrollments (payment_id, full_name, email, phone, country_iso, occupation, preferred_batch, program_id, duration_id, currency, amount_paise, status, created_at, updated_at)
           VALUES ($1, 'Seed Student', $2, '9999999999', 'IN', 'student', CURRENT_DATE, $3, $4, 'INR', $5, 'active', $6, $6)`,
          [paymentId, email, program.id, planId, pricePaise, seedDate.toISOString()]
        );
        
        totalInserted++;
      }
    }

    await client.query("COMMIT");
    console.log(`Successfully seeded ${totalInserted} dummy enrollments and payments!`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed data:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
