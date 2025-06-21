import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    addReplyToQuery,
    assignQueriesInBulk,
    getQueries,
    raiseQueryByUser
} from "../controllers/query.controller.js";

const router = Router()

//Product Routes
router.route("/raiseQuery").post(verifyJWT, raiseQueryByUser);
router.route("/reply").post(verifyJWT, addReplyToQuery);
router.route("/assign").post(verifyJWT, assignQueriesInBulk);
router.route("/").get(verifyJWT, getQueries);

export default router