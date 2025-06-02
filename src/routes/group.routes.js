import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addProductInGroup, createGroup, removeProductFromGroup } from "../controllers/group.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Product Routes
router.route("/createGroup").post(
    upload.fields([
        {
            name: "banner",
            maxCount: 1
        }
    ]),
    verifyJWT, createGroup);
router.route("/addProduct").post(verifyJWT, addProductInGroup);
router.route("/removeProduct").post(verifyJWT, removeProductFromGroup);

export default router