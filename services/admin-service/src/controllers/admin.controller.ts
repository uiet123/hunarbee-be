import type { Request, Response, NextFunction } from "express";
import { query } from "@hunarbee/shared";

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const appsResult = await query<{ count: string }>("SELECT COUNT(*) FROM payments WHERE status != 'failed'");
    const internsResult = await query<{ count: string }>("SELECT COUNT(*) FROM enrollments WHERE status = 'active'");
    const completedResult = await query<{ count: string }>("SELECT COUNT(*) FROM enrollments WHERE status = 'completed'");
    const revResult = await query<{ sum: string }>("SELECT SUM(amount_paise) FROM payments WHERE status = 'paid'");

    const stats = {
      totalApplications: parseInt(appsResult.rows[0]?.count || "0", 10),
      activeInterns: parseInt(internsResult.rows[0]?.count || "0", 10),
      completedInternships: parseInt(completedResult.rows[0]?.count || "0", 10),
      totalRevenue: parseInt(revResult.rows[0]?.sum || "0", 10) / 100, // Convert paise to rupees
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

export async function getApplications(_req: Request, res: Response, next: NextFunction) {
  try {
    // Map payments table into application items
    const result = await query(
      `SELECT 
        p.id, 
        p.applicant_name as "studentName", 
        p.applicant_email as email, 
        pr.name as "programName", 
        p.amount_paise as amount, 
        p.status as "paymentStatus", 
        p.currency,
        p.created_at as "createdAt"
       FROM payments p
       LEFT JOIN programs pr ON p.program_id = pr.id
       ORDER BY p.created_at DESC 
       LIMIT 50`
    );
    
    const formatted = result.rows.map((row: any) => ({
      ...row,
      amount: row.amount / 100, // Convert paise to currency unit
      status: row.paymentStatus === 'paid' ? 'enrolled' : (row.paymentStatus === 'failed' ? 'cancelled' : 'pending')
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
}

export async function getPayments(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT 
        p.id, 
        p.applicant_name as name, 
        p.applicant_email as email, 
        pr.name as "programName",
        p.amount_paise as amount, 
        p.created_at as date, 
        'card' as method, 
        p.status
       FROM payments p
       LEFT JOIN programs pr ON p.program_id = pr.id
       WHERE p.status = 'paid'
       ORDER BY p.created_at DESC 
       LIMIT 50`
    );

    const formatted = result.rows.map((row: any) => ({
      ...row,
      amount: row.amount / 100,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
}

export async function getStudents(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT 
        e.id, 
        e.full_name as name, 
        e.email, 
        pr.name as "programName", 
        pl.name as "planName",
        e.status, 
        e.created_at as "enrolledDate" 
       FROM enrollments e 
       LEFT JOIN programs pr ON e.program_id = pr.id
       LEFT JOIN plans pl ON e.duration_id = pl.id
       ORDER BY e.created_at DESC 
       LIMIT 50`
    );
    
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
}

export async function getStudentDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.params.id;
    
    // Fetch enrollment
    const enrollResult = await query(
      `SELECT e.*, 
              e.full_name as name,
              e.created_at as "enrolledDate",
              pl.name as "planName",
              pr.name as "programName"
       FROM enrollments e 
       LEFT JOIN plans pl ON e.duration_id = pl.id
       LEFT JOIN programs pr ON e.program_id = pr.id
       WHERE e.id = $1`,
      [studentId]
    );

    if (enrollResult.rows.length === 0) {
      res.status(404).json({ success: false, message: "Student not found" });
      return;
    }
    
    const student = enrollResult.rows[0] as any;

    // Fetch payments
    const paymentsResult = await query(
      `SELECT id, amount_paise as amount, currency, status as paymentStatus, created_at as date, 'card' as method
       FROM payments
       WHERE applicant_email = $1 OR id = $2`,
      [student.email, student.payment_id]
    );

    const formattedPayments = paymentsResult.rows.map((p: any) => ({
      ...p,
      amount: p.amount / 100
    }));

    res.status(200).json({
      success: true,
      data: {
        ...student,
        progressPercent: 0, // Mock progress for now
        payments: formattedPayments
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPrograms(_req: Request, res: Response, next: NextFunction) {
  try {
    const progResult = await query(`SELECT * FROM programs ORDER BY created_at ASC`);
    const plansResult = await query(`SELECT * FROM plans ORDER BY created_at ASC`);
    
    const programs = progResult.rows.map((prog: any) => {
      const plans = plansResult.rows
        .filter((p: any) => p.program_id === prog.id)
        .map((p: any) => ({ ...p, price: p.price_paise / 100 }));
        
      return {
        ...prog,
        plans
      };
    });

    res.status(200).json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
}

export async function updateProgramStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const progId = req.params.id;
    const { status } = req.body;
    
    await query(`UPDATE programs SET status = $1, updated_at = NOW() WHERE id = $2`, [status, progId]);
    
    res.status(200).json({ success: true, message: "Program status updated" });
  } catch (error) {
    next(error);
  }
}

export async function deleteProgram(req: Request, res: Response, next: NextFunction) {
  try {
    const progId = req.params.id;
    
    // Deleting the program will cascade delete plans, curriculum_days, and tasks 
    // due to ON DELETE CASCADE constraints.
    const result = await query(`DELETE FROM programs WHERE id = $1 RETURNING id`, [progId]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Program not found" });
      return;
    }
    
    res.status(200).json({ success: true, message: "Program deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export async function createProgram(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, duration, mode, highlights } = req.body;
    
    if (!name || !description) {
      res.status(400).json({ success: false, message: "Name and description are required" });
      return;
    }
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `${slug}-${Date.now().toString(36)}`;
    
    const highlightsJson = JSON.stringify(highlights || []);
    
    const result = await query(
      `INSERT INTO programs (id, name, description, duration, mode, highlights, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING *`,
      [id, name, description, duration || '', mode || '', highlightsJson]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: "Program created successfully" });
  } catch (error) {
    next(error);
  }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const programId = req.params.id;
    const { name, price, duration_months, total_days } = req.body;
    
    if (!name || price === undefined || !duration_months || !total_days) {
      res.status(400).json({ success: false, message: "Name, price, duration_months, and total_days are required" });
      return;
    }
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `${programId}-${slug}-${Date.now().toString(36)}`;
    const price_paise = Math.round(Number(price) * 100);
    
    const result = await query(
      `INSERT INTO plans (id, program_id, name, price_paise, currency, duration_months, total_days, status)
       VALUES ($1, $2, $3, $4, 'INR', $5, $6, 'published')
       RETURNING *`,
      [id, programId, name, price_paise, Number(duration_months), Number(total_days)]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: "Plan created successfully" });
  } catch (error) {
    next(error);
  }
}
