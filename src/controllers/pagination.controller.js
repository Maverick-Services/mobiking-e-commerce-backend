import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";

export const getPaginatedOrders = asyncHandler(async (req, res) => {
  const status = req?.query?.status;
  const type = req?.query?.type;
  const startDate = req?.query?.startDate;
  const endDate = req?.query?.endDate;

  const page = Math.max(1, parseInt(req?.query?.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req?.query?.limit) || 30));
  const skip = (page - 1) * limit;

  const filter = {};

  // Status and Type filtering
  if (status && status !== "all") {
    filter.status = status;
  }

  if (type && type !== "all") {
    filter.type = type;
  }

  // Date range filtering
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the whole day
    filter.createdAt = { $gte: start, $lte: end };
  }

  const [orders, totalCount] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'userId',
        model: "User",
        select: "-password -refreshToken",
        populate: {
          path: "orders",
          model: "Order"
        }
      })
      .populate({
        path: "items.productId",
        model: "Product",
        populate: {
          path: "category",
          model: "SubCategory"
        }
      })
      .lean(),
    Order.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(200).json(
    new ApiResponse(200, {
      orders,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }, "Orders fetched successfully")
  );
});

export const getPaginatedProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    active,
    category,
    startDate,
    endDate,
  } = req.query;

  const parsedPage = Math.max(1, parseInt(page));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = {};

  // Filter by active
  if (active !== undefined) {
    filter.active = active === "true";
  }

  // Filter by category
  if (category) {
    filter.category = category;
  }

  // Filter by date range
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const [products, totalCount] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate("category", "name slug")
      .lean(),

    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / parsedLimit);

  return res.status(200).json(
    new ApiResponse(200, {
      products,
      totalCount,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    }, "Products fetched successfully")
  );
});

export const getPaginatedUsers = asyncHandler(async (req, res) => {
  const { role, startDate, endDate } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const filter = {};

  if (role && role !== "all") {
    filter.role = role;
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999); // Include full end day
    filter.createdAt = { $gte: start, $lte: end };
  }

  const [users, totalCount] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password -refreshToken")
      .lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(200).json(
    new ApiResponse(200, {
      users,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }, "Users fetched successfully")
  );
});

