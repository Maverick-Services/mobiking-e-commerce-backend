import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { generatePaymentLink } from "../controllers/paymentLink.controller.js";

const router = Router()

//Product Routes
router.route("/generateLink").post(verifyJWT, generatePaymentLink);

export default router