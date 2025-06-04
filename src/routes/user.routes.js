import { Router } from "express";
import {
    createEmployee,
    deleteEmployee,
    editEmployee,
    getUserById,
    getUsersByRole,
    loginUser,
    logoutUser,
    refreshAccessToken
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router()

router.route("/createEmployee").post(verifyJWT,
    upload.fields([
        {
            name: "profilePicture",
            maxCount: 1
        },
        {
            name: "documents",
            maxCount: 4
        }
    ]),
    createEmployee);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken)
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/employees/:_id").put(verifyJWT, editEmployee);
router.route("/employees/:_id").delete(verifyJWT, deleteEmployee);
router.route("/role/:role").get(verifyJWT, getUsersByRole);
router.route("/:_id").get(verifyJWT, getUserById);

export default router