import { Router } from "express";
import { query } from "@hunarbee/shared";

const router = Router();

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

    res.json({
      success: true,
      data: { program: progResult.rows[0] },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
