// controllers/dashboard.controller.js

import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// 1. Total Customers
export const getTotalCustomers = async (req, res) => {
    try {
        const totalCustomers = await User.countDocuments();
        return res.status(200).json(new ApiResponse(200, { totalCustomers }, "Total customers fetched"));
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

// 3. Total Sales (Delivered orders)
export const getTotalSales = async (req, res) => {
    try {
        const agg = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { _id: null, totalSales: { $sum: "$orderAmount" } } },
        ]);
        const totalSales = agg[0]?.totalSales || 0;
        return res.status(200).json(new ApiResponse(200, { totalSales }, "Total sales fetched"));
    } catch (err) {
        console.error("Error fetching total sales:", err);
        return res.status(500).json(new ApiError(500, "Internal server error"));
    }
};

// 4. Sales in Date Range (Delivered orders)
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
                    status: "Delivered",
                    createdAt: { $gte: start, $lte: end },
                },
            },
            {
                $group: { _id: null, salesInRange: { $sum: "$orderAmount" } },
            },
        ]);
        const salesInRange = agg[0]?.salesInRange || 0;
        return res.status(200).json(new ApiResponse(200, { salesInRange }, "Sales in range fetched"));
    } catch (err) {
        console.error("Error fetching sales in range:", err);
        return res.status(err.statusCode || 500).json(new ApiError(err.statusCode || 500, err.message));
    }
};
