import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createCodOrder, getAllOrdersByUser } from "../controllers/order.controller.js";

const router = Router()

//Product Routes
router.route("/cod/new").post(verifyJWT, createCodOrder);
router.route("/user").get(verifyJWT, getAllOrdersByUser);

export default router