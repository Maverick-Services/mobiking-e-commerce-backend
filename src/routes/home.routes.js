import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { createHome } from "../controllers/home.controller.js";

const router = Router()

//Product Routes
router.route("/createHomeLayout").post(
    verifyJWT,
    upload.fields([
        {
            name: "banners",
            maxCount: 4
        }
    ]),
    createHome);

export default router