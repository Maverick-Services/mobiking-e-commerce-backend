import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addProductInGroup, createGroup, getAllGroups, removeProductFromGroup } from "../controllers/group.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Product Routes
router.route("/createGroup").post(verifyJWT, createGroup);
router.route("/addProduct").post(verifyJWT, addProductInGroup);
router.route("/removeProduct").post(verifyJWT, removeProductFromGroup);
router.route("/").get(getAllGroups);

export default router