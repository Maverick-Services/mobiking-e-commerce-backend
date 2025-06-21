import { Router } from "express";
import {
    createCustomer,
    createEmployee,
    deleteEmployee,
    editEmployee,
    getUserById,
    getUsersByRole,
    loginUser,
    logoutUser,
    placeCancelRequest,
    placeWarrantyRequest,
    refreshAccessToken
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    addProductInWishList,
    removeProductFromWishList
} from "../controllers/wishlist.controller.js";
import {
    createAddress,
    deleteAddress, editAddress,
    getAllAddressByUser
} from "../controllers/address.controller.js";

const router = Router()

router.route("/createCustomer").post(verifyJWT, createCustomer);
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
router.route("/address/:_id").put(verifyJWT, editAddress);
router.route("/address/:_id").delete(verifyJWT, deleteAddress);
router.route("/address/view").get(verifyJWT, getAllAddressByUser);

//Order Routes
router.route("/request/cancel").post(verifyJWT, placeCancelRequest);
router.route("/request/warranty").post(verifyJWT, placeWarrantyRequest);

export default router