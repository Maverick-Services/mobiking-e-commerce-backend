// controllers/query.controller.js
import mongoose from "mongoose";
import { Query } from "../models/query.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ROLES } from "../constants.js";


export const raiseQueryByUser = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    // Ensure user is authenticated and has correct role
    const user = req.user;

    if (!user || user.role !== "user") {
        throw new ApiError(403, "Unauthorized: Only customers can raise queries");
    }

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    // 1️⃣ Create new query
    const newQuery = new Query({
        title,
        description,
        raisedBy: user._id,
        assignedTo: null,
        raisedAt: new Date(),
        replies: []
    });

    const savedQuery = await newQuery.save();

    // 2️⃣ Push query ID into user's `queries` array
    await User.findByIdAndUpdate(user._id, {
        $push: { queries: savedQuery._id }
    });

    // 3️⃣ Return response
    return res.status(201).json(
        new ApiResponse(201, savedQuery, "Query raised successfully")
    );
});

export const getQueries = asyncHandler(async (req, res) => {
    const user = req.user;
    // const { assignedTo, raisedBy } = req.body;

    // Build dynamic filter
    const filter = {};

    // Only return user-specific queries if role is 'user'
    // if (user.role === "user") {
    //     filter.raisedBy = user._id;
    // } else {
    //     if (raisedBy) filter.raisedBy = raisedBy;
    //     if (assignedTo) filter.assignedTo = assignedTo;
    // }

    // Fetch and populate user details
    const queries = await Query.find(
        // filter
    )
        .populate("raisedBy", "name email role")
        .populate("assignedTo", "name email role")
        .populate("replies.messagedBy", "name email role")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, queries, "Queries fetched successfully")
    );
});

export const addReplyToQuery = asyncHandler(async (req, res) => {
    const { queryId, message } = req.body;
    const user = req.user;

    // Validate input
    if (!queryId || !message) {
        throw new ApiError(400, "Query ID and message are required");
    }

    // Fetch query
    const query = await Query.findById(queryId);

    if (!query) {
        throw new ApiError(404, "Query not found");
    }

    // Check if query is not assigned yet
    if (!query?.assignedTo) {
        throw new ApiError(403, "Query not assigned yet");
    }

    // Add reply
    const reply = {
        message,
        messagedBy: user._id,
        messagedAt: new Date()
    };

    query.replies.push(reply);
    const updatedQuery = await query.save();

    // Populate before sending
    const populated = await Query.findById(updatedQuery._id)
        .populate("raisedBy", "name email role")
        .populate("assignedTo", "name email role")
        .populate("replies.messagedBy", "name email role");

    return res.status(200).json(
        new ApiResponse(200, populated, "Reply added to query successfully")
    );
});

export const assignQueriesInBulk = asyncHandler(async (req, res) => {
    const { queryIds, userId } = req.body;

    // Validate input
    if (!Array.isArray(queryIds) || queryIds.length === 0 || !userId) {
        throw new ApiError(400, "queryIds[] and userId are required");
    }

    // Validate assignee user
    const assignee = await User.findById(userId).select("_id name email role");
    if (!assignee) {
        throw new ApiError(404, "Assignee user not found");
    }

    if (assignee?.role == ROLES.USER) {
        throw new ApiError(404, "Query can not be assigned to customer");
    }

    // Filter valid ObjectIds
    const validIds = queryIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (validIds.length === 0) {
        throw new ApiError(400, "No valid queryIds provided");
    }

    // Assign queries that are not already assigned
    await Query.updateMany(
        { _id: { $in: validIds }, assignedTo: { $in: [null, undefined] } },
        {
            $set: {
                assignedTo: assignee._id,
                assignedAt: new Date()
            }
        }
    );

    return res.status(200).json(
        new ApiResponse(200, assignee, "Queries assigned successfully")
    );
});