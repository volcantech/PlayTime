import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import petitBacRouter from "./petitBac";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/petitbac", petitBacRouter);

export default router;
