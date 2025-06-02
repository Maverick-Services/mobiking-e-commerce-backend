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
router.route("/:role").get(verifyJWT, getUsersByRole);
router.route("/:_id").get(verifyJWT, getUserById);

// router.route("/register").post(
//     upload.fields([
//         {
//             name: "avatar",
//             maxCount: 1
//         }, 
//         {
//             name: "coverImage",
//             maxCount: 1
//         }
//     ]),
//     registerUser
//     )

// router.route("/login").post(loginUser)

// //secured routes
// router.route("/logout").post(verifyJWT,  logoutUser)
// router.route("/refresh-token").post(refreshAccessToken)
// router.route("/change-password").post(verifyJWT, changeCurrentPassword)
// router.route("/current-user").get(verifyJWT, getCurrentUser)
// router.route("/update-account").patch(verifyJWT, updateAccountDetails)

// router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
// router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

// router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
// router.route("/history").get(verifyJWT, getWatchHistory)

export default router