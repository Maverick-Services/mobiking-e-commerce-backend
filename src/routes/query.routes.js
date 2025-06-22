import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    addRatingToQuery,
    addReplyToQuery,
    assignQueriesInBulk,
    closeQuery,
    getQueries,
    getQueriesForLoggedInUser,
    raiseQueryByUser
} from "../controllers/query.controller.js";

const router = Router()

//Product Routes
router.route("/raiseQuery").post(verifyJWT, raiseQueryByUser);
router.route("/reply").post(verifyJWT, addReplyToQuery);
router.route("/assign").post(verifyJWT, assignQueriesInBulk);
router.route("/close").post(verifyJWT, closeQuery);
router.route("/rate").post(verifyJWT, addRatingToQuery);
router.route("/").get(verifyJWT, getQueries);
router.route("/my").get(verifyJWT, getQueriesForLoggedInUser);

export default router