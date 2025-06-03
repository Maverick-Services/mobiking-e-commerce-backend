import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createHome, getHomeLayout } from "../controllers/home.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

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

router.route("/").get(getHomeLayout);

export default router