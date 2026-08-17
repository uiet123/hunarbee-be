import { Router } from "express";
import { query } from "@hunarbee/shared";
import fs from "fs";
import path from "path";

const router = Router();

// ─── Generic JSON File Store ───

const DATA_DIR = path.join(__dirname, "../data");

function readJsonStore(filename: string): any[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeJsonStore(filename: string, data: any[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

// ─── Curriculum Templates ───

router.get("/curriculum-templates", (_req, res) => {
  const templates = readJsonStore("templates.json");
  res.json({ success: true, data: templates });
});

router.post("/curriculum-templates", (req, res) => {
  const { templates } = req.body;
  if (!Array.isArray(templates)) {
    res.status(400).json({ success: false, message: "Templates must be an array." });
    return;
  }
  writeJsonStore("templates.json", templates);
  res.json({ success: true, message: "Templates saved successfully." });
});

// ─── Task Library ───

router.get("/task-library", (_req, res) => {
  const items = readJsonStore("task-library.json");
  res.json({ success: true, data: items });
});

router.post("/task-library", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, message: "Items must be an array." });
    return;
  }
  writeJsonStore("task-library.json", items);
  res.json({ success: true, message: "Task library saved." });
});

router.put("/task-library/:id", (req, res) => {
  const items = readJsonStore("task-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Task not found." });
    return;
  }
  items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJsonStore("task-library.json", items);
  res.json({ success: true, data: items[idx] });
});

router.delete("/task-library/:id", (req, res) => {
  const items = readJsonStore("task-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Task not found." });
    return;
  }
  items[idx] = { ...items[idx], archived: true, updatedAt: new Date().toISOString() };
  writeJsonStore("task-library.json", items);
  res.json({ success: true, message: "Task archived." });
});

// ─── Resource Library ───

router.get("/resource-library", (_req, res) => {
  const items = readJsonStore("resource-library.json");
  res.json({ success: true, data: items });
});

router.post("/resource-library", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, message: "Items must be an array." });
    return;
  }
  writeJsonStore("resource-library.json", items);
  res.json({ success: true, message: "Resource library saved." });
});

router.put("/resource-library/:id", (req, res) => {
  const items = readJsonStore("resource-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Resource not found." });
    return;
  }
  items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJsonStore("resource-library.json", items);
  res.json({ success: true, data: items[idx] });
});

router.delete("/resource-library/:id", (req, res) => {
  const items = readJsonStore("resource-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Resource not found." });
    return;
  }
  items[idx] = { ...items[idx], archived: true, updatedAt: new Date().toISOString() };
  writeJsonStore("resource-library.json", items);
  res.json({ success: true, message: "Resource archived." });
});

// ─── Video Library ───

router.get("/video-library", (_req, res) => {
  const items = readJsonStore("video-library.json");
  res.json({ success: true, data: items });
});

router.post("/video-library", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ success: false, message: "Items must be an array." });
    return;
  }
  writeJsonStore("video-library.json", items);
  res.json({ success: true, message: "Video library saved." });
});

router.put("/video-library/:id", (req, res) => {
  const items = readJsonStore("video-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Video not found." });
    return;
  }
  items[idx] = { ...items[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJsonStore("video-library.json", items);
  res.json({ success: true, data: items[idx] });
});

router.delete("/video-library/:id", (req, res) => {
  const items = readJsonStore("video-library.json");
  const idx = items.findIndex((i: any) => i.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Video not found." });
    return;
  }
  items[idx] = { ...items[idx], status: "ARCHIVED", updatedAt: new Date().toISOString() };
  writeJsonStore("video-library.json", items);
  res.json({ success: true, message: "Video archived." });
});

// ─── Programs (DB-backed) ───
// NOTE: These wildcard routes MUST come AFTER the library routes above
// to prevent /task-library, /resource-library, /video-library from matching /:id

router.get("/", async (_req, res, next) => {
  try {
    const result = await query(
      "SELECT id, name as title, description, duration, mode, highlights, status FROM programs WHERE status = 'published'"
    );
    res.json({
      success: true,
      data: { programs: result.rows },
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
