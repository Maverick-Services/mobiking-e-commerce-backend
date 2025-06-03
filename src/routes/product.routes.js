import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    createProduct, deleteProduct, editProduct,
    getAllProducts, getProductById, getProductBySlug,
    getProductsByCategory, getProductsByGroup,
    updateProductStock
} from "../controllers/product.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Product Routes
router.route("/createProduct").post(verifyJWT,
    upload.fields([
        {
            name: "images",
            maxCount: 4
        }
    ]),
    createProduct);
router.route("/:_id").put(verifyJWT, editProduct);
router.route("/:_id").delete(verifyJWT, deleteProduct);
router.route("/").get(getAllProducts);
router.route("/category/:categoryId").get(getProductsByCategory);
router.route("/group/:groupId").get(getProductsByGroup);
router.route("/:_id").get(verifyJWT, getProductById);
router.route("/details/:slug").get(getProductBySlug);

//Stock Routes
router.route("/addProductStock").post(verifyJWT, updateProductStock);

export default router