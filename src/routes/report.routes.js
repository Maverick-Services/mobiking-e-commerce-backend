import express from "express";
import {
    getTotalCustomers,
    getTotalOrders,
    getTotalSales,
    getSalesInRange,
} from "../controllers/reports.controller.js"; // adjust the path as needed
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = express.Router();

// Total customers count
router.route("/customers/count").get(verifyJWT, getTotalCustomers);
router.route("/orders/count").get(verifyJWT, getTotalOrders);
router.route("/sales/total").get(verifyJWT, getTotalSales);
router.route("/sales/custom").get(verifyJWT, getSalesInRange);

export default router;
