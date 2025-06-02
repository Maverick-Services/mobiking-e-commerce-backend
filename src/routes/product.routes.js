import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createProduct, deleteProduct, editProduct, getAllProducts, getProductById, getProductBySlug, getProductsByCategory, getProductsByGroup, markProductInGroup, updateProductStock } from "../controllers/product.controller.js";
// import {upload} from "../middlewares/multer.middleware.js"

const router = Router()

//Product Routes
router.route("/createProduct").post(verifyJWT, createProduct);
// router.route("/markProduct").post(verifyJWT, markProductInGroup);
router.route("/:_id").put(verifyJWT, editProduct);
router.route("/:_id").delete(verifyJWT, deleteProduct);
router.route("/").get(getAllProducts);
router.route("/:categoryId").get(getProductsByCategory);
router.route("/:groupId").get(getProductsByGroup);
router.route("/:_id").get(verifyJWT, getProductById);
router.route("/:slug").get(getProductBySlug);

//Stock Routes
router.route("/addProductStock").post(verifyJWT, updateProductStock);

export default router