import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createCodOrder } from "../controllers/order.controller.js";

const router = Router()

//Product Routes
router.route("/cod/new").post(verifyJWT, createCodOrder);

export default router