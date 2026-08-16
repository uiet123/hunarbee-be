import { pool } from "../packages/shared/src/db/pool";

const MOCK_PROGRAMS = [
  {
    id: "prog_frontend",
    name: "Frontend Development",
    description: "Master React, Next.js, and modern CSS.",
    duration: "8–12 weeks",
    mode: "Remote · Live",
    highlights: JSON.stringify(["Certificate", "Live Projects", "Mentorship"]),
    status: "published",
    plans: [
      {
        id: "plan_fe_1m",
        name: "1 Month",
        price_paise: 99900,
        currency: "INR",
        duration_months: 1,
        total_days: 30,
        status: "published",
        curriculum: [
          {
            id: "day_1",
            day_number: 1,
            title: "Environment Setup & HTML5",
            description: "Install VS Code, Node, and build your first semantic HTML page.",
            estimated_time_minutes: 120,
            status: "active",
            tasks: [
              {
                id: "task_1",
                title: "Install Tools",
                description: "Get your dev environment ready.",
                instructions: "Download and install VS Code and Node.js LTS.",
                estimated_time_minutes: 30,
                submission_required: false,
                mentor_review_required: false,
                status: "active",
                resources: JSON.stringify([
                  { id: "res_1", title: "VS Code Setup Guide", type: "link", url: "https://code.visualstudio.com" }
                ])
              }
            ]
          }
        ]
      },
      {
        id: "plan_fe_3m",
        name: "3 Months",
        price_paise: 249900,
        currency: "INR",
        duration_months: 3,
        total_days: 90,
        status: "published",
        curriculum: []
      }
    ]
  },
  {
    id: "prog_backend",
    name: "Backend Development",
    description: "Learn Node.js, Express, and Databases.",
    duration: "8–12 weeks",
    mode: "Remote · Live",
    highlights: JSON.stringify(["Certificate", "Live Projects", "Mentorship"]),
    status: "published",
    plans: [
      {
        id: "plan_be_1m",
        name: "1 Month",
        price_paise: 99900,
        currency: "INR",
        duration_months: 1,
        total_days: 30,
        status: "published",
        curriculum: []
      }
    ]
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query("DELETE FROM tasks");
    await client.query("DELETE FROM curriculum_days");
    await client.query("DELETE FROM plans");
    await client.query("DELETE FROM programs");

    for (const prog of MOCK_PROGRAMS) {
      await client.query(
        `INSERT INTO programs (id, name, duration, mode, highlights, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [prog.id, prog.name, prog.duration, prog.mode, prog.highlights, prog.description, prog.status]
      );

      for (const plan of prog.plans) {
        await client.query(
          `INSERT INTO plans (id, program_id, name, price_paise, currency, duration_months, total_days, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [plan.id, prog.id, plan.name, plan.price_paise, plan.currency, plan.duration_months, plan.total_days, plan.status]
        );

        for (const day of plan.curriculum) {
          await client.query(
            `INSERT INTO curriculum_days (id, plan_id, day_number, title, description, estimated_time_minutes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [day.id, plan.id, day.day_number, day.title, day.description, day.estimated_time_minutes, day.status]
          );

          for (const task of day.tasks) {
            await client.query(
              `INSERT INTO tasks (id, curriculum_day_id, title, description, instructions, estimated_time_minutes, submission_required, mentor_review_required, status, resources)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [task.id, day.id, task.title, task.description, task.instructions, task.estimated_time_minutes, task.submission_required, task.mentor_review_required, task.status, task.resources]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    console.log("Seeding completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
