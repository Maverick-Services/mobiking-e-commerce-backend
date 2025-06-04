import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addProductInCart } from "../controllers/cart.controller.js";

const router = Router()

//Product Routes
router.route("/add").post(verifyJWT, addProductInCart);

export default router