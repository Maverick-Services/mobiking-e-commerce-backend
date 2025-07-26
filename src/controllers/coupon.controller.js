import { Coupon } from "../models/coupon.model.js"; // adjust path as needed
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// CREATE COUPON
export const createCoupon = asyncHandler(async (req, res) => {
    const { code, value, percent, startDate, endDate } = req.body;

    if (!code || (!value && !percent)) {
        throw new ApiError(400, "Code and either value or percent are required");
    }

    const couponExists = await Coupon.findOne({ code });
    if (couponExists) {
        throw new ApiError(409, "Coupon code already exists");
    }

    const newCoupon = await Coupon.create({ code, value, percent, startDate, endDate });

    return res
        .status(201)
        .json(new ApiResponse(201, newCoupon, "Coupon created successfully"));
});

// UPDATE COUPON
export const updateCoupon = asyncHandler(async (req, res) => {
    const { id } = req.body;
    const { code, value, percent, startDate, endDate } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new ApiError(404, "Coupon not found");

    coupon.code = code || coupon?.code;
    coupon.value = value || coupon?.value;
    coupon.percent = percent || coupon?.percent;
    coupon.startDate = startDate || coupon?.startDate;
    coupon.endDate = endDate || coupon?.endDate;

    const updated = await coupon.save();

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Coupon updated successfully"));
});

// DELETE COUPON
export const deleteCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deleted = await Coupon.findByIdAndDelete(id);

    if (!deleted) throw new ApiError(404, "Coupon not found");

    return res
        .status(200)
        .json(new ApiResponse(200, deleted, "Coupon deleted successfully"));
});

// GET COUPON BY CODE
export const getCouponByCode = asyncHandler(async (req, res) => {
    const { code } = req.params;

    if (!code) throw new ApiError(400, "Coupon code is required");

    const coupon = await Coupon.findOne({ code });
    if (!coupon) throw new ApiError(404, "Coupon not found");

    return res
        .status(200)
        .json(new ApiResponse(200, coupon, "Coupon fetched successfully"));
});

// GET ALL COUPONS
export const getCoupons = asyncHandler(async (req, res) => {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, coupons, "Coupons fetched successfully"));
});
