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
    deliveredCancel,
    createPosOrder,
    preShiprocketReject,
    createdReject,
    awbReject,
    holdAbandonedOrder,
    getOrdersByDate,
    getOrderById,
    updateOrder,
    addItemQuantityInOrder,
    removeItemQuantityInOrder,
    getFilteredOrdersByDate,
    returnOrder,
    getOrdersByRequestType,
    createManualOrder
} from "../controllers/order.controller.js";
import {
    assignBestCourier,
    generateLabelAndManifestBackground,
    schedulePickup,
    shiprocketWebhook,
    verifyShiprocketToken
} from "../controllers/shiprocket.controller.js";
import { getPaginatedOrders } from "../controllers/pagination.controller.js";

const router = Router()

//Place Order Routes
router.route("/pos/new").post(verifyJWT, createPosOrder);
router.route("/manual/new").post(verifyJWT, createManualOrder);
router.route("/cod/new").post(verifyJWT, createCodOrder);
router.route("/online/new").post(verifyJWT, createOnlineOrder);
router.route("/online/verify").post(verifyJWT, verifyPayment);
router.route("/user").get(verifyJWT, getAllOrdersByUser);
router.route("/:_id").put(verifyJWT, updateOrder);
router.route("/items/add").post(verifyJWT, addItemQuantityInOrder);
router.route("/items/remove").post(verifyJWT, removeItemQuantityInOrder);
router.route("/details/:_id").get(verifyJWT, getOrderById);
router.route("/custom/filtered").get(verifyJWT, getFilteredOrdersByDate);
router.route("/custom").get(verifyJWT, getOrdersByDate);
router.route("/").get(verifyJWT, getAllOrders);
//Paginated Orders
router.route("/paginated").get(verifyJWT, getPaginatedOrders);
router.route("/request").get(verifyJWT, getOrdersByRequestType);

//Admin Order Routes
router.route("/hold").post(verifyJWT, holdAbandonedOrder);
router.route("/accept").post(
    verifyJWT,
    shiprocketAuth,
    acceptOrder,
    assignBestCourier,
    schedulePickup,
    generateLabelAndManifestBackground
);

router.route("/schedulePickup").post(
    verifyJWT,
    shiprocketAuth,
    schedulePickup,
    generateLabelAndManifestBackground
);

router.route("/reject").post(
    verifyJWT,
    shiprocketAuth,
    preShiprocketReject,
    createdReject,
    awbReject
)

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

router.route('/return').post(
    verifyJWT,
    shiprocketAuth,
    returnOrder
)

// Track order routes
router.route('/webhook').post(
    verifyShiprocketToken,
    shiprocketWebhook
);

export default router;