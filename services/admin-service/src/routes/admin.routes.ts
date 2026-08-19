import { Router } from "express";
import { requireAuth, requireAdmin } from "@hunarbee/shared";
import * as adminController from "../controllers/admin.controller";

const router = Router();

// Apply auth and admin middleware to all routes in this service
router.use(requireAuth, requireAdmin);

router.get("/stats", adminController.getStats);
router.get("/analytics", adminController.getAnalytics);
router.get("/applications", adminController.getApplications);
router.get("/payments", adminController.getPayments);
router.get("/students", adminController.getStudents);
router.get("/students/:id", adminController.getStudentDetails);
router.get("/programs", adminController.getPrograms);
router.post("/programs", adminController.createProgram);
router.post("/programs/:id/plans", adminController.createPlan);
router.put("/programs/:id/status", adminController.updateProgramStatus);
router.delete("/programs/:id", adminController.deleteProgram);
router.delete("/plans/:id", adminController.deletePlan);
router.put("/plans/:id", adminController.updatePlan);
router.put("/plans/:id/status", adminController.updatePlanStatus);

export default router;
