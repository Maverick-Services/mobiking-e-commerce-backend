import { Policy } from "../models/policy.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

export const createPolicy = asyncHandler(async (req, res) => {
  const { policyName, slug, heading, content, lastUpdated } = req.body;

  if (!policyName || !heading || !content) {
    throw new ApiError(400, "All fields are required");
  }

//   const exists = await Policy.findOne({ slug });
//   if (exists) {
//     throw new ApiError(409, "Policy with this slug already exists");
//   }

  const newPolicy = await Policy.create({ policyName, slug: slug || "", heading, content, lastUpdated: lastUpdated || null });

  return res
    .status(201)
    .json(new ApiResponse(201, newPolicy, "Policy created successfully"));
});

export const updatePolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { policyName, slug, heading, content, lastUpdated } = req.body;

  const policy = await Policy.findById(id);
  if (!policy) throw new ApiError(404, "Policy not found");

  policy.policyName = policyName || policy.policyName;
  policy.slug = slug || policy.slug;
  policy.heading = heading || policy.heading;
  policy.content = content || policy.content;
  policy.lastUpdated = lastUpdated || policy?.lastUpdated || null;

  const updated = await policy.save();

  return res
    .status(200)
    .json(new ApiResponse(200, updated, "Policy updated successfully"));
});

// GET All Policies
export const getPolicies = asyncHandler(async (req, res) => {
  const policies = await Policy.find({}).sort({ lastUpdated: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, policies, "Policies fetched successfully"));
});

export const getPolicyByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);

  const policy = await Policy.findOne(
    isObjectId ? { _id: idOrSlug } : { slug: idOrSlug }
  );

  if (!policy) {
    throw new ApiError(404, "Policy not found");
  }

  return res.status(200).json(
    new ApiResponse(200, policy, "Policy fetched successfully")
  );
});
