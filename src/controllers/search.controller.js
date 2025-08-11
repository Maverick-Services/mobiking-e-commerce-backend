import { Product } from "../models/product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// export const searchProducts = asyncHandler(async (req, res) => {
//   const query = req.query.q?.trim();
//   const priceTo = req.query.priceTo?.trim();
//   const priceFrom = req.query.priceFrom?.trim();

//   if (!query || query.length < 2) {
//     throw new ApiError(400, "Search query must be at least 2 characters");
//   }

//   const regex = new RegExp(query, "i"); // Case-insensitive partial match

//   const filter = {
//     $or: [{ name: regex }, { fullName: regex }]
//   };

//   // Optional active filter
//   filter.active = true;

//   const products = await Product.find(filter)
//     .populate("orders stock groups category") // optional populate
//     .lean();

//   return res.status(200).json(
//     new ApiResponse(200, products, "Products fetched successfully")
//   );
// });

export const searchProducts = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  const priceTo = parseFloat(req.query.priceTo);
  const priceFrom = parseFloat(req.query.priceFrom);

  if (!query || query.length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  const regex = new RegExp(query, "i"); // Case-insensitive partial match

  const matchStage = {
    $and: [
      { active: true },
      { $or: [{ name: regex }, { fullName: regex }] }
    ]
  };

  const priceFilter = {};
  if (!isNaN(priceFrom)) priceFilter.$gte = priceFrom;
  if (!isNaN(priceTo)) priceFilter.$lte = priceTo;

  const pipeline = [
    { $match: matchStage },
    // Keep only the latest sellingPrice entry
    {
      $addFields: {
        latestPrice: {
          $let: {
            vars: {
              sortedPrices: { $sortArray: { input: "$sellingPrice", sortBy: { createdAt: -1 } } }
            },
            in: { $arrayElemAt: ["$$sortedPrices.price", 0] }
          }
        }
      }
    },
    ...(Object.keys(priceFilter).length > 0
      ? [{ $match: { latestPrice: priceFilter } }]
      : []),
    {
      $lookup: {
        from: "orders",
        localField: "orders",
        foreignField: "_id",
        as: "orders"
      }
    },
    {
      $lookup: {
        from: "stocks",
        localField: "stock",
        foreignField: "_id",
        as: "stock"
      }
    },
    {
      $lookup: {
        from: "groups",
        localField: "groups",
        foreignField: "_id",
        as: "groups"
      }
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    }
  ];

  const products = await Product.aggregate(pipeline);

  return res.status(200).json(
    new ApiResponse(200, products, "Products fetched successfully")
  );
});
