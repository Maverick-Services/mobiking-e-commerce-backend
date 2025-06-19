import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createHome, editHomeLayout, getHomeLayout } from "../controllers/home.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

//Product Routes
router.route("/createHomeLayout").post(verifyJWT, createHome);
router.route("/:_id").put(verifyJWT, editHomeLayout);
router.route("/").get(getHomeLayout);

export default router