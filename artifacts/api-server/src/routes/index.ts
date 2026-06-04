import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import recommendationsRouter from "./recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(recommendationsRouter);

export default router;
