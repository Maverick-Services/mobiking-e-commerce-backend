import express from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    createCoupon,
    deleteCoupon,
    getCouponByCode,
    getCoupons,
    updateCoupon
} from "../controllers/coupon.controller.js";

const router = express.Router();

router.post("/", verifyJWT, createCoupon);
router.put("/", verifyJWT, updateCoupon);
router.get("/", verifyJWT, getCoupons);
router.get("/code/:code", verifyJWT, getCouponByCode);
router.delete("/:id", verifyJWT, deleteCoupon);

export default router;