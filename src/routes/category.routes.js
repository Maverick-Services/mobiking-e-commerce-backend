import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    createCategory, createSubCategory, deleteCategory,
    deleteSubCategory, editCategory, editSubCategory,
    getAllCategories, getAllFeaturedSubCategories, getAllSubCategories,
    getCategoryById, getCategoryBySlug,
    getSubCategoryById, getSubCategoryBySlug
} from "../controllers/category.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Category Routes
router.route("/createCategory").post(verifyJWT, createCategory);
router.route("/:_id").put(verifyJWT, editCategory);
router.route("/:_id").delete(verifyJWT, deleteCategory);
router.route("/").get(getAllCategories);
router.route("/view/:_id").get(verifyJWT, getCategoryById);
router.route("/details/:slug").get(getCategoryBySlug);

//Sub Category Routes
router.route("/createSubCategory").post(verifyJWT, createSubCategory);
router.route("/subCategories/:_id").put(verifyJWT, editSubCategory);
router.route("/subCategories/:_id").delete(verifyJWT, deleteSubCategory);
router.route("/subCategories").get(getAllSubCategories);
router.route("/subCategories/featured").get(getAllFeaturedSubCategories);
router.route("/subCategories/view/:_id").get(verifyJWT, getSubCategoryById);
router.route("/subCategories/details/:slug").get(getSubCategoryBySlug);

export default router