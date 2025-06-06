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
import { addProductInWishList, removeProductFromWishList } from "../controllers/wishlist.controller.js";
import { createAddress } from "../controllers/address.controller.js";

const router = Router()

router.route("/createUser").post(verifyJWT, createEmployee);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken)
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/employees/:_id").put(verifyJWT, editEmployee);
router.route("/employees/:_id").delete(verifyJWT, deleteEmployee);
router.route("/role/:role").get(verifyJWT, getUsersByRole);
router.route("/:_id").get(verifyJWT, getUserById);

//Whishlist Routes
router.route("/wishlist/add").post(verifyJWT, addProductInWishList);
router.route("/wishlist/remove").post(verifyJWT, removeProductFromWishList);

//Address Routes
router.route("/address/add").post(verifyJWT, createAddress);

export default router