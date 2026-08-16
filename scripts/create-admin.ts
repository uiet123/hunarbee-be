import { pool, query, hashPassword } from "../packages/shared/src";

async function createAdmin() {
  const email = "admin@hunarbee.com";
  const password = "password";
  
  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    
    if (existing.rowCount && existing.rowCount > 0) {
      console.log("Admin user already exists. Updating role to admin...");
      await query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    } else {
      console.log("Creating admin user...");
      const passwordHash = await hashPassword(password);
      await query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)`,
        ["Admin", email, passwordHash, "admin"]
      );
    }
    console.log("Admin user ready!");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (err) {
    console.error("Failed to create admin:", err);
  } finally {
    await pool.end();
  }
}

createAdmin();
