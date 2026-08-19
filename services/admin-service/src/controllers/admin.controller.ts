import type { Request, Response, NextFunction } from "express";
import { query } from "@hunarbee/shared";

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const range = req.query.range as string || 'all';
    let timeFilter = "";
    let whereTime = "";
    if (range === '7') { timeFilter = "AND created_at >= NOW() - INTERVAL '7 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '7 days'"; }
    else if (range === '30') { timeFilter = "AND created_at >= NOW() - INTERVAL '30 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '30 days'"; }
    else if (range === '90') { timeFilter = "AND created_at >= NOW() - INTERVAL '90 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '90 days'"; }

    const appsResult = await query<{ count: string }>(`SELECT COUNT(*) FROM payments WHERE status != 'failed' ${timeFilter}`);
    const internsResult = await query<{ count: string }>(`SELECT COUNT(*) FROM enrollments WHERE status = 'active' ${timeFilter}`);
    const completedResult = await query<{ count: string }>(`SELECT COUNT(*) FROM enrollments WHERE status = 'completed' ${timeFilter}`);
    const revResult = await query<{ sum: string }>(`SELECT SUM(amount_paise) FROM payments WHERE status = 'paid' ${timeFilter}`);

    const stats = {
      totalApplications: parseInt(appsResult.rows[0]?.count || "0", 10),
      activeInterns: parseInt(internsResult.rows[0]?.count || "0", 10),
      completedInternships: parseInt(completedResult.rows[0]?.count || "0", 10),
      totalRevenue: parseInt(revResult.rows[0]?.sum || "0", 10) / 100,
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}

export async function getApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM payments`);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);

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
       LIMIT $1 OFFSET $2`,
       [limit, offset]
    );
    
    const formatted = result.rows.map((row: any) => ({
      ...row,
      amount: row.amount / 100, // Convert paise to currency unit
      status: row.paymentStatus === 'paid' ? 'enrolled' : (row.paymentStatus === 'failed' ? 'cancelled' : 'pending')
    }));

    res.status(200).json({ 
      success: true, 
      data: formatted,
      pagination: { totalCount, page, totalPages }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM payments WHERE status = 'paid'`);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);

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
       LIMIT $1 OFFSET $2`,
       [limit, offset]
    );

    const formatted = result.rows.map((row: any) => ({
      ...row,
      amount: row.amount / 100,
    }));

    res.status(200).json({ 
      success: true, 
      data: formatted,
      pagination: { totalCount, page, totalPages }
    });
  } catch (error) {
    next(error);
  }
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM enrollments`);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);

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
       LIMIT $1 OFFSET $2`,
       [limit, offset]
    );
    
    res.status(200).json({ 
      success: true, 
      data: result.rows,
      pagination: { totalCount, page, totalPages }
    });
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
    
    if (status === 'published') {
      const plansResult = await query(`SELECT COUNT(*) FROM plans WHERE program_id = $1`, [progId]);
      if (parseInt(plansResult.rows[0].count) === 0) {
        res.status(400).json({ success: false, message: "Cannot publish a program without any plans" });
        return;
      }
    }
    
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

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const planId = req.params.id;
    
    // Deleting the plan will cascade delete curriculum_days and tasks 
    // due to ON DELETE CASCADE constraints.
    const result = await query(`DELETE FROM plans WHERE id = $1 RETURNING id`, [planId]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Plan not found" });
      return;
    }
    
    res.status(200).json({ success: true, message: "Plan deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export async function updatePlanStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const planId = req.params.id;
    const { status } = req.body;
    
    await query(`UPDATE plans SET status = $1, updated_at = NOW() WHERE id = $2`, [status, planId]);
    
    res.status(200).json({ success: true, message: "Plan status updated" });
  } catch (error) {
    next(error);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const planId = req.params.id;
    const { price, duration_months, total_days } = req.body;
    
    if (price === undefined || !duration_months || !total_days) {
      res.status(400).json({ success: false, message: "Price, duration_months, and total_days are required" });
      return;
    }
    
    const price_paise = Math.round(Number(price) * 100);
    const generatedName = `${duration_months} Month${Number(duration_months) > 1 ? 's' : ''} Plan`;
    
    const result = await query(
      `UPDATE plans SET name = $1, price_paise = $2, duration_months = $3, total_days = $4, updated_at = NOW() WHERE id = $5 RETURNING *`,
      [generatedName, price_paise, Number(duration_months), Number(total_days), planId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Plan not found" });
      return;
    }
    
    res.status(200).json({ success: true, data: result.rows[0], message: "Plan updated successfully" });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const range = req.query.range as string || 'all';
    let timeFilter = "";
    let whereTime = "";
    if (range === '7') { timeFilter = "AND created_at >= NOW() - INTERVAL '7 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '7 days'"; }
    else if (range === '30') { timeFilter = "AND created_at >= NOW() - INTERVAL '30 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '30 days'"; }
    else if (range === '90') { timeFilter = "AND created_at >= NOW() - INTERVAL '90 days'"; whereTime = "WHERE created_at >= NOW() - INTERVAL '90 days'"; }
    
    const isDaily = range === '7' || range === '30';
    const dateTruncFormat = isDaily ? 'day' : 'month';
    const charFormat = isDaily ? 'DD Mon' : 'Mon YYYY';

    // 1. Revenue over time
    const revenueResult = await query(
      `SELECT 
         to_char(date_trunc('${dateTruncFormat}', created_at), '${charFormat}') as name,
         SUM(amount_paise) / 100 as revenue
       FROM payments
       WHERE status = 'paid' ${timeFilter}
       GROUP BY date_trunc('${dateTruncFormat}', created_at)
       ORDER BY date_trunc('${dateTruncFormat}', created_at) ASC`
    );

    // 2. Applications over time
    const appsResult = await query(
      `SELECT 
         to_char(date_trunc('${dateTruncFormat}', created_at), '${charFormat}') as name,
         COUNT(*) as applications
       FROM payments
       ${whereTime}
       GROUP BY date_trunc('${dateTruncFormat}', created_at)
       ORDER BY date_trunc('${dateTruncFormat}', created_at) ASC`
    );

    // 3. Program Popularity (Enrollments by Program)
    const programPopResult = await query(
      `SELECT 
         pr.name as "programName",
         COUNT(e.id) as enrollments
       FROM enrollments e
       JOIN programs pr ON e.program_id = pr.id
       ${whereTime.replace('created_at', 'e.created_at')}
       GROUP BY pr.name
       ORDER BY enrollments DESC`
    );

    // 4. Payment Success Rates
    const paymentStatusResult = await query(
      `SELECT status, COUNT(*) as count FROM payments ${whereTime} GROUP BY status`
    );

    // 5. Occupations
    const occupationsResult = await query(
      `SELECT occupation, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY occupation`
    );

    // 6. Duration Plans Popularity
    const planPopResult = await query(
      `SELECT pl.name as "planName", COUNT(e.id) as count
       FROM enrollments e
       JOIN plans pl ON e.duration_id = pl.id
       ${whereTime.replace('created_at', 'e.created_at')}
       GROUP BY pl.name
       ORDER BY count DESC`
    );

    // 7. Geographic Distribution (Top 5 countries)
    const geoResult = await query(
      `SELECT country_iso as country, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY country_iso ORDER BY count DESC LIMIT 5`
    );

    // 8. Upcoming Batch Load
    const batchResult = await query(
      `SELECT to_char(preferred_batch, 'DD Mon YYYY') as batch, COUNT(*) as count
       FROM enrollments
       WHERE preferred_batch >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY preferred_batch
       ORDER BY preferred_batch ASC LIMIT 10`
    );

    // 9. Completion Rates
    const completionResult = await query(
      `SELECT status, COUNT(*) as count FROM enrollments ${whereTime} GROUP BY status`
    );

    // 10. SMS Stats
    const smsStatsResult = await query(
      `SELECT sms_type, status, COUNT(*) as count FROM sms_logs ${whereTime} GROUP BY sms_type, status`
    );

    // 11. Failed SMS Details
    const failedSmsResult = await query(
      `SELECT s.id, s.phone, s.sms_type, s.error_message, s.created_at, e.full_name, e.email 
       FROM sms_logs s
       JOIN enrollments e ON s.enrollment_id = e.id
       WHERE s.status = 'failed' ${timeFilter.replace('created_at', 's.created_at')}
       ORDER BY s.created_at DESC`
    );

    res.status(200).json({
      success: true,
      data: {
        revenueData: revenueResult.rows.map((r: any) => ({ name: r.name, revenue: Number(r.revenue) || 0 })),
        applicationsData: appsResult.rows.map((r: any) => ({ name: r.name, applications: Number(r.applications) || 0 })),
        programPopularity: programPopResult.rows.map((r: any) => ({ name: r.programName || r.programname || "Unknown", value: Number(r.enrollments) || 0 })),
        paymentStatus: paymentStatusResult.rows.map((r: any) => ({ name: r.status, value: Number(r.count) || 0 })),
        occupations: occupationsResult.rows.map((r: any) => ({ name: r.occupation || 'Unknown', value: Number(r.count) || 0 })),
        planPopularity: planPopResult.rows.map((r: any) => ({ name: r.planName || r.planname || "Unknown", value: Number(r.count) || 0 })),
        geographicData: geoResult.rows.map((r: any) => ({ name: r.country || 'Unknown', value: Number(r.count) || 0 })),
        batchLoads: batchResult.rows.map((r: any) => ({ name: r.batch, value: Number(r.count) || 0 })),
        completionRates: completionResult.rows.map((r: any) => ({ name: r.status, value: Number(r.count) || 0 })),
        smsStats: smsStatsResult.rows.map((r: any) => ({ smsType: r.sms_type, status: r.status, count: Number(r.count) || 0 })),
        failedSms: failedSmsResult.rows.map((r: any) => ({
          id: r.id,
          phone: r.phone,
          smsType: r.sms_type,
          errorMessage: r.error_message,
          createdAt: r.created_at,
          fullName: r.full_name,
          email: r.email
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}
