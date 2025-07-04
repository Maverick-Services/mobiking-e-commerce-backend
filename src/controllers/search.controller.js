import { Product } from "../models/product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const searchProducts = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();

  if (!query || query.length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  const regex = new RegExp(query, "i"); // Case-insensitive partial match

  const filter = {
    $or: [{ name: regex }, { fullName: regex }]
  };

  // Optional active filter
  filter.active = true;

  const products = await Product.find(filter)
    .populate("orders stock groups category") // optional populate
    .lean();

  return res.status(200).json(
    new ApiResponse(200, products, "Products fetched successfully")
  );
});
