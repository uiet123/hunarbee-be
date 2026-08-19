import { Router } from "express";
import { query } from "@hunarbee/shared";

const router = Router();

// ─── Generic DB JSON Store ───

async function readDbStore(storeKey: string): Promise<any[]> {
  const result = await query(
    "SELECT data FROM curriculum_store WHERE store_key = $1",
    [storeKey]
  );
  if (result.rows.length === 0) return [];
  const data = (result.rows[0] as any).data;
  // If data is stored as a stringified array in JSONB, parse it if necessary
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return Array.isArray(data) ? data : [];
}

async function writeDbStore(storeKey: string, data: any[]): Promise<void> {
  await query(
    `INSERT INTO curriculum_store (store_key, data, updated_at) 
     VALUES ($1, $2, NOW()) 
     ON CONFLICT (store_key) DO UPDATE SET data = $2, updated_at = NOW()`,
    [storeKey, JSON.stringify(data)]
  );
}

// ─── Curriculum Templates ───

router.get("/curriculum-templates", async (_req, res, next) => {
  try {
    const templates = await readDbStore("templates.json");
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

router.post("/curriculum-templates", async (req, res, next) => {
  try {
    const { templates } = req.body;
    if (!Array.isArray(templates)) {
      res.status(400).json({ success: false, message: "Templates must be an array." });
      return;
    }
    await writeDbStore("templates.json", templates);
    res.json({ success: true, message: "Templates saved successfully." });
  } catch (error) {
    next(error);
  }
});

// ─── Task Library ───

router.get("/task-library", async (_req, res, next) => {
  try {
    const items = await readDbStore("task-library.json");
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.post("/task-library", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, message: "Items must be an array." });
      return;
    }
    await writeDbStore("task-library.json", items);
    res.json({ success: true, message: "Task library saved." });
  } catch (error) {
    next(error);
  }
});

router.put("/task-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("task-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Task not found." });
      return;
    }
    items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeDbStore("task-library.json", items);
    res.json({ success: true, data: items[idx] });
  } catch (error) {
    next(error);
  }
});

router.delete("/task-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("task-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Task not found." });
      return;
    }
    items[idx] = { ...items[idx], archived: true, updatedAt: new Date().toISOString() };
    await writeDbStore("task-library.json", items);
    res.json({ success: true, message: "Task archived." });
  } catch (error) {
    next(error);
  }
});

// ─── Resource Library ───

router.get("/resource-library", async (_req, res, next) => {
  try {
    const items = await readDbStore("resource-library.json");
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.post("/resource-library", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, message: "Items must be an array." });
      return;
    }
    await writeDbStore("resource-library.json", items);
    res.json({ success: true, message: "Resource library saved." });
  } catch (error) {
    next(error);
  }
});

router.put("/resource-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("resource-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }
    items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeDbStore("resource-library.json", items);
    res.json({ success: true, data: items[idx] });
  } catch (error) {
    next(error);
  }
});

router.delete("/resource-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("resource-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Resource not found." });
      return;
    }
    items[idx] = { ...items[idx], archived: true, updatedAt: new Date().toISOString() };
    await writeDbStore("resource-library.json", items);
    res.json({ success: true, message: "Resource archived." });
  } catch (error) {
    next(error);
  }
});

// ─── Video Library ───

router.get("/video-library", async (_req, res, next) => {
  try {
    const items = await readDbStore("video-library.json");
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.post("/video-library", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, message: "Items must be an array." });
      return;
    }
    await writeDbStore("video-library.json", items);
    res.json({ success: true, message: "Video library saved." });
  } catch (error) {
    next(error);
  }
});

router.put("/video-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("video-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }
    items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeDbStore("video-library.json", items);
    res.json({ success: true, data: items[idx] });
  } catch (error) {
    next(error);
  }
});

router.delete("/video-library/:id", async (req, res, next) => {
  try {
    const items = await readDbStore("video-library.json");
    const idx = items.findIndex((i: any) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }
    items[idx] = { ...items[idx], status: "ARCHIVED", updatedAt: new Date().toISOString() };
    await writeDbStore("video-library.json", items);
    res.json({ success: true, message: "Video archived." });
  } catch (error) {
    next(error);
  }
});

// ─── Programs (DB-backed) ───
// NOTE: These wildcard routes MUST come AFTER the library routes above
// to prevent /task-library, /resource-library, /video-library from matching /:id

router.get("/", async (_req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name as title, description, duration, mode, highlights, status FROM programs WHERE status = 'published'"
    );
    
    const plansResult = await query(
      "SELECT id, program_id, name, price_paise as price, duration_months, total_days, status FROM plans WHERE status = 'published'"
    );
    
    const plansByProgram = plansResult.rows.reduce((acc: any, plan: any) => {
      if (!acc[plan.program_id]) acc[plan.program_id] = [];
      acc[plan.program_id].push(plan);
      return acc;
    }, {});
    
    const programsWithPlans = result.rows.map((p: any) => ({
      ...p,
      plans: plansByProgram[p.id] || []
    }));

    res.json({
      success: true,
      data: { programs: programsWithPlans },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const progResult = await query(
      "SELECT id, name as title, description, duration, mode, highlights, status FROM programs WHERE id = $1 AND status = 'published'",
      [req.params.id]
    );

    if (progResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Program not found",
      });
      return;
    }
    
    const plansResult = await query(
      "SELECT id, name, price_paise as price, duration_months, total_days, status FROM plans WHERE program_id = $1 AND status = 'published'",
      [req.params.id]
    );
    
    const program = {
      ...progResult.rows[0],
      plans: plansResult.rows,
    };

    res.json({
      success: true,
      data: { program },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
