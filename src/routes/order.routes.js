import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    createCodOrder,
    createOnlineOrder, verifyPayment,
    getAllOrders, getAllOrdersByUser
} from "../controllers/order.controller.js";

const router = Router()

//Product Routes
router.route("/cod/new").post(verifyJWT, createCodOrder);
router.route("/online/new").post(verifyJWT, createOnlineOrder);
router.route("/online/verify").post(verifyJWT, verifyPayment);
router.route("/user").get(verifyJWT, getAllOrdersByUser);
router.route("/").get(verifyJWT, getAllOrders);

export default router