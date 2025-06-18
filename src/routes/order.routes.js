import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { shiprocketAuth } from "../middlewares/shiprocket.middlewares.js";
import {
    createCodOrder,
    createOnlineOrder, verifyPayment,
    getAllOrders, getAllOrdersByUser,
    acceptOrder,
    preShiprocketCancel,
    createdCancel,
    awbCancel,
    postPickupCancel,
    inTransitCancel,
    deliveredCancel
} from "../controllers/order.controller.js";
import {
    assignBestCourier,
    generateLabelAndManifestBackground,
    schedulePickup,
    shiprocketWebhook
} from "../controllers/shiprocket.controller.js";

const router = Router()

//Place Order Routes
router.route("/cod/new").post(verifyJWT, createCodOrder);
router.route("/online/new").post(verifyJWT, createOnlineOrder);
router.route("/online/verify").post(verifyJWT, verifyPayment);
router.route("/user").get(verifyJWT, getAllOrdersByUser);
router.route("/").get(verifyJWT, getAllOrders);

//Admin Order Routes
router.route("/accept").post(
    verifyJWT,
    shiprocketAuth,
    acceptOrder,
    assignBestCourier,
    schedulePickup,
    generateLabelAndManifestBackground
);

router.route("/cancel").post(
    verifyJWT,
    shiprocketAuth,
    preShiprocketCancel,
    createdCancel,
    awbCancel,
    postPickupCancel,
    inTransitCancel,
    deliveredCancel
)


// Track order routes
router.route('/webhook/shiprocket').post(
    shiprocketWebhook
);

export default router;