import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { Query } from "../models/query.model.js";
// import mongoose from "mongoose";

export const getPaginatedOrders = asyncHandler(async (req, res) => {
  const status = req?.query?.status;
  const type = req?.query?.type;
  const startDate = req?.query?.startDate;
  const endDate = req?.query?.endDate;
  const searchQuery = req?.query?.searchQuery?.trim();
  const queryParameter = req?.query?.queryParameter;

  const page = Math.max(1, parseInt(req?.query?.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req?.query?.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  // Filter by status and type
  if (status && status !== "all") filter.status = status;
  if (type && type !== "all") filter.type = type;

  // Filter by date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }

  // Filter by customer or order
  if (searchQuery && queryParameter === "customer") {
    const regex = new RegExp(searchQuery);
    filter.$or = [
      { name: regex },
      { email: regex },
      { phoneNo: regex }
    ];
  } else if (searchQuery && queryParameter === "order") {
    filter.orderId = new RegExp(searchQuery);
  }

  const [
    orders, totalCount,
    newCount, acceptedCount, shippedCount, cancelledCount, deliveredCount
  ] = await Promise.all([
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
    Order.countDocuments({ ...filter, status: "New" }),
    Order.countDocuments({ ...filter, status: "Accepted" }),
    Order.countDocuments({ ...filter, status: "Shipped" }),
    Order.countDocuments({ ...filter, status: "Canelled" }),
    Order.countDocuments({ ...filter, status: "Delivered" }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return res.status(200).json(
    new ApiResponse(200, {
      orders,
      totalCount,
      newCount, acceptedCount,
      shippedCount, cancelledCount,
      deliveredCount,
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
    limit = 10,
    active,
    category,
    startDate,
    endDate,
  } = req.query;
  const searchQuery = req?.query?.searchQuery?.trim();

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

  if (searchQuery) {
    const regex = new RegExp(searchQuery);
    filter.$or = [
      { name: regex },
      { fullName: regex },
    ];
  }

  const [products, totalCount] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      // .populate("category", "name slug")
      .populate("orders stock groups category")
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

// export const getPaginatedUsers = asyncHandler(async (req, res) => {
//   const { role, startDate, endDate } = req.query;
//   const searchQuery = req?.query?.searchQuery?.trim();

//   const page = Math.max(1, parseInt(req.query.page) || 1);
//   const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
//   const skip = (page - 1) * limit;

//   const filter = {};

//   if (role && role !== "all") {
//     filter.role = role;
//   }

//   if (startDate && endDate) {
//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     end.setUTCHours(23, 59, 59, 999); // Include full end day
//     filter.createdAt = { $gte: start, $lte: end };
//   }

//   if (searchQuery) {
//     const regex = new RegExp(searchQuery);
//     filter.$or = [
//       { name: regex },
//       { email: regex },
//       { phoneNo: regex }
//     ];
//   }

//   const [users, totalCount] = await Promise.all([
//     User.find(filter)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .select("-password -refreshToken")
//       .lean(),
//     User.countDocuments(filter),
//   ]);

//   const totalPages = Math.ceil(totalCount / limit);

//   return res.status(200).json(
//     new ApiResponse(200, {
//       users,
//       totalCount,
//       pagination: {
//         page,
//         limit,
//         totalPages,
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//     }, "Users fetched successfully")
//   );
// });

export const getPaginatedUsers = asyncHandler(async (req, res) => {
  const { role, startDate, endDate, type } = req.query;
  const searchQuery = req?.query?.searchQuery?.trim();

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (role && role !== "all") {
    filter.role = role;
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }

  if (searchQuery) {
    const regex = new RegExp(searchQuery, "i");
    filter.$or = [
      { name: regex },
      { email: regex },
      { phoneNo: regex }
    ];
  }

  /* ========== Special TYPE Filtering (Frequent / OneOrder / NoOrder) ========== */
  let userIdsToIncludeOrExclude = [];

  if (type === "frequent") {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const frequentUsers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo },
        }
      },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 }
        }
      },
      {
        $match: {
          orderCount: { $gte: 2 }
        }
      }
    ]);

    userIdsToIncludeOrExclude = frequentUsers.map(u => u._id);
    filter._id = { $in: userIdsToIncludeOrExclude };

  } else if (type === "oneOrder") {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const oneOrderUsers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: twoMonthsAgo }
        }
      },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 }
        }
      },
      {
        $match: {
          orderCount: 1
        }
      }
    ]);

    userIdsToIncludeOrExclude = oneOrderUsers.map(u => u._id);
    filter._id = { $in: userIdsToIncludeOrExclude };

  } else if (type === "noOrder") {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Find users with orders
    const usersWithOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: twoMonthsAgo }
        }
      },
      {
        $group: {
          _id: "$userId"
        }
      }
    ]);

    const usersWithOrdersIds = usersWithOrders.map(u => u._id);
    filter._id = { $nin: usersWithOrdersIds };
  }

  /* ========== Fetch Users with Pagination ========== */
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

export const getPaginatedQueries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    isResolved,
    startDate,
    endDate,
  } = req.query;
  const searchQuery = req?.query?.searchQuery?.trim();

  const parsedPage = Math.max(1, parseInt(page));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = {};

  // Filter by active
  if (isResolved !== undefined) {
    filter.active = active === "true";
  }

  // Filter by date range
  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  if (searchQuery) {
    const regex = new RegExp(searchQuery);
    filter.$or = [
      { title: regex },
      { desciption: regex },
    ];
  }

  const [queries, totalCount] = await Promise.all([
    Query.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),

    Query.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / parsedLimit);

  return res.status(200).json(
    new ApiResponse(200, {
      queries,
      totalCount,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    }, "Queries fetched successfully")
  );
});
