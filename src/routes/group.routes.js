import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    addProductInGroup,
    createGroup,
    editGroup,
    getAllGroups,
    getGroupsByCategories,
    getSpecialGroups,
    removeProductFromGroup,
    syncGroupProducts
} from "../controllers/group.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Product Routes
router.route("/createGroup").post(verifyJWT, createGroup);
router.route("/:_id").put(verifyJWT, editGroup);
router.route("/addProduct").post(verifyJWT, addProductInGroup);
router.route("/removeProduct").post(verifyJWT, removeProductFromGroup);
router.route("/updateProducts").post(verifyJWT, syncGroupProducts);
router.route("/").get(getAllGroups);
router.route("/special").get(getSpecialGroups);
router.route("/category/:category").get(getGroupsByCategories);

export default router