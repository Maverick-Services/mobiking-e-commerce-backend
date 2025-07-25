// controllers/dashboard.controller.js

import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// function getDateRangeArray(days) {
//   const dates = [];
//   const today = new Date();
//   for (let i = days - 1; i >= 0; i--) {
//     const d = new Date(today);
//     d.setDate(today.getDate() - i);
//     dates.push(d.toISOString().split("T")[0]); // 'YYYY-MM-DD'
//   }
//   return dates;
// }

const generateDateRangeArray = (startDate, endDate) => {
  const dates = [];

  console.log(startDate, endDate)
  const current = new Date(Date.UTC(
    new Date(startDate).getUTCFullYear(),
    new Date(startDate).getUTCMonth(),
    new Date(startDate).getUTCDate()
  ));

  const end = new Date(Date.UTC(
    new Date(endDate).getUTCFullYear(),
    new Date(endDate).getUTCMonth(),
    new Date(endDate).getUTCDate()
  ));

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10)); // YYYY-MM-DD
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

// 1. Total Customers
export const getTotalCustomers = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: "user" });
    return res.status(200).json(
      new ApiResponse(200, { totalCustomers }, "Total customers fetched")
    );
  } catch (err) {
    console.error("Error fetching customers:", err);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

// 2. Total Orders
export const getTotalOrders = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    return res.status(200).json(new ApiResponse(200, { totalOrders }, "Total orders fetched"));
  } catch (err) {
    console.error("Error fetching orders:", err);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

// 3. Total Sales
export const getTotalSales = async (req, res) => {
  try {
    const agg = await Order.aggregate([
      {
        $match: {
          abondonedOrder: false,
          status: {
            $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$orderAmount" }
        }
      }
    ]);

    const totalSales = agg[0]?.totalSales || 0;
    return res.status(200).json(new ApiResponse(200, { totalSales }, "Total sales fetched"));
  } catch (err) {
    console.error("Error fetching total sales:", err);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

// 4. Sales in Date Range
export const getSalesInRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) throw new ApiError(400, "Start and end date required");

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const agg = await Order.aggregate([
      {
        $match: {
          abondonedOrder: false,
          status: {
            $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"]
          },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          salesInRange: { $sum: "$orderAmount" }
        }
      }
    ]);

    const salesInRange = agg[0]?.salesInRange || 0;
    return res.status(200).json(new ApiResponse(200, { salesInRange }, "Sales in range fetched"));
  } catch (err) {
    console.error("Error fetching sales in range:", err);
    return res.status(err.statusCode || 500).json(new ApiError(err.statusCode || 500, err.message));
  }
};

export const getDailyOrderCounts = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApiError(400, "Start and end date are required");
  }

  const from = new Date(startDate);
  const to = new Date(new Date(endDate).setHours(23, 59, 59, 999));

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new ApiError(400, "Invalid date format");
  }

  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

  const agg = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        // abondonedOrder: false,
        // status: { $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"] }
      }
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // Map aggregation result to daily count object
  const countMap = {};
  agg.forEach(entry => {
    countMap[entry._id.day] = entry.count;
  });

  // Step 3: Generate complete date range
  const dates = generateDateRangeArray(startDate, endDate);
  const dailyCounts = dates.map(date => countMap[date] || 0);

  return res.status(200).json(
    new ApiResponse(200, { dates, dailyCounts }, "Daily order counts")
  );
});

export const getDailyOrderSourceCounts = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApiError(400, "Start and end date are required");
  }

  const from = new Date(startDate);
  const to = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

  const agg = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        // abondonedOrder: false,
        // status: { $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"] }
      }
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          type: "$type",
          isAppOrder: "$isAppOrder"
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // Map to { [day]: { app: 0, website: 0, pos: 0 } }
  const dataMap = {};
  for (const { _id, count } of agg) {
    const day = _id.day;
    if (!dataMap[day]) {
      dataMap[day] = { app: 0, website: 0, pos: 0 };
    }

    if (_id.type === "Regular" && _id.isAppOrder === true) dataMap[day].app += count;
    if (_id.type === "Regular" && _id.isAppOrder === false) dataMap[day].website += count;
    if (_id.type === "Pos") dataMap[day].pos += count;
  }

  // Fill missing days
  // const dates = getDateRangeArray(days);
  const dates = generateDateRangeArray(startDate, endDate);
  const appOrders = [];
  const websiteOrders = [];
  const posOrders = [];

  for (const date of dates) {
    const row = dataMap[date] || { app: 0, website: 0, pos: 0 };
    appOrders.push(row.app);
    websiteOrders.push(row.website);
    posOrders.push(row.pos);
  }

  // for (const date of dates) {
  //   const row = dataMap[date] || { app: 0, website: 0, pos: 0 };
  //   appOrders.push(row.app);
  //   websiteOrders.push(row.website);
  //   posOrders.push(row.pos);
  // }

  return res.status(200).json(
    new ApiResponse(200, { dates, appOrders, websiteOrders, posOrders }, "Order source counts by day")
  );
});

export const getDailyCustomerSignupCounts = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApiError(400, "Start and end date are required");
  }

  const from = new Date(startDate);
  const to = new Date(new Date(endDate).setHours(23, 59, 59, 999));

  const agg = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        role: "user"
      }
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert aggregation result to a map
  const countMap = {};
  for (const entry of agg) {
    countMap[entry._id.day] = entry.count;
  }

  // Generate full range of dates between from and to
  const dates = generateDateRangeArray(from, to);

  // Fill counts with either value or 0
  const customerCounts = dates.map(date => countMap[date] || 0);

  return res.status(200).json(
    new ApiResponse(200, { dates, customerCounts }, "Daily customer signup counts")
  );
});

export const getDailySalesInRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    throw new ApiError(400, "Start and end date required");
  }

  const from = new Date(startDate);
  const to = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

  // Step 1: Aggregate sales by day
  const agg = await Order.aggregate([
    {
      $match: {
        abondonedOrder: false,
        status: {
          $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"]
        },
        createdAt: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        },
        total: { $sum: "$orderAmount" }
      }
    }
  ]);

  // // Step 2: Map data to date → sales
  // const salesMap = {};
  // for (const { _id, total } of agg) {
  //   salesMap[_id.day] = total;
  // }

  // // Step 3: Generate ordered date array and fill values
  // const dates = getDateRangeArray(days);
  // const salesCounts = dates.map(date => salesMap[date] || 0);

  // Step 2: Map data to date → sales
  const salesMap = {};
  for (const { _id, total } of agg) {
    salesMap[_id.day] = total;
  }

  // Step 3: Generate full range of dates and map to sales
  const dates = generateDateRangeArray(startDate, endDate);
  const salesCounts = dates.map(date => salesMap[date] || 0);

  return res.status(200).json(
    new ApiResponse(200, { dates, salesCounts }, "Daily sales data fetched")
  );
});

/**
 * @route   POST /api/v1/universal/columns
 * @body    { model: "ModelName", columns: ["field1", "field2"] }
 */

export const fetchModelColumns = asyncHandler(async (req, res) => {
  const { model, columns } = req.body;

  if (!model || !Array.isArray(columns) || columns.length === 0) {
    throw new ApiError(400, "Model name and columns array are required");
  }

  // Get the model dynamically from mongoose
  const Model = mongoose.models[model];
  if (!Model) {
    throw new ApiError(404, `Model '${model}' not found`);
  }

  // Detect reference fields to populate
  const schemaPaths = Model.schema.paths;
  const populateFields = [];

  for (const col of columns) {
    const path = schemaPaths[col];
    if (!path) {
      console.warn(`⚠️ Column '${col}' not found in schema of model '${model}'`);
      continue;
    }

    // console.log(path)
    // Check if the field is an ObjectId with a ref
    if (
      path.instance === "ObjectId" &&
      path.options &&
      typeof path.options.ref === "string"
    ) {
      populateFields.push(col);
    }
  }

  // Build projection: "field1 field2"
  const projection = columns.join(" ");

  // Build query
  let query = Model.find({}, projection);
  for (const field of populateFields) {
    query = query.populate(field);
  }

  const data = await query.limit(100).exec(); // optional limit

  return res
    .status(200)
    .json(new ApiResponse(200, data, `${model} columns fetched successfully`));
});