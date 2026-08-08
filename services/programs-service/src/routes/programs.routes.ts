import { Router } from "express";
import { PROGRAMS } from "../data/programs";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: { programs: PROGRAMS },
  });
});

router.get("/:id", (req, res) => {
  const program = PROGRAMS.find((item) => item.id === req.params.id);

  if (!program) {
    res.status(404).json({
      success: false,
      message: "Program not found",
    });
    return;
  }

  res.json({
    success: true,
    data: { program },
  });
});

export default router;
