import { Product } from "../models/product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SubCategory } from "../models/sub_category.model.js";

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
export const getSearchSuggestions = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) {
    throw new ApiError(400, "Query is required");
  }

  const regex = new RegExp(query, "i"); // case-insensitive

  // 1️⃣ Fetch product tags
  const products = await Product.find(
    { tags: regex }, // match inside tags
    "tags"           // only fetch tags
  );

  // 2️⃣ Fetch subcategory tags
  const subCategories = await SubCategory.find(
    { tags: regex },
    "tags"
  );

  // 3️⃣ Flatten & dedupe tags
  const productTags = [...new Set(products.flatMap(p => p.tags))];
  const subCategoryTags = [...new Set(subCategories.flatMap(sc => sc.tags))];

  // 4️⃣ Filter by regex (in case some tags slipped in)
  const filteredProductTags = productTags.filter(tag => regex.test(tag));
  const filteredSubCategoryTags = subCategoryTags.filter(tag => regex.test(tag));

  // 5️⃣ Build suggestions
  const suggestions = {
    productSuggestions: filteredProductTags,
    subCategorySuggestions: filteredSubCategoryTags
  };

  return res.status(200).json(
    new ApiResponse(200, { query, suggestions }, "Suggestions fetched successfully")
  );
});

export const searchProducts = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  const searchKey = req.query?.searchKey?.trim();
  const priceTo = parseFloat(req.query.priceTo);
  const priceFrom = parseFloat(req.query.priceFrom);

  if (!query && !searchKey) {
    throw new ApiError(400, "Search query or search key not found");
  }

  if (query && query.length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  let matchStage = {};

  if (searchKey) {
    const regex = new RegExp(searchKey, "i"); // Case-insensitive partial match
    // console.log(searchKey, regex);
    matchStage = {
      $and: [
        { active: true },
        {
          tags: regex
        }
      ]
    }
  } else if (query) {
    const regex = new RegExp(query, "i"); // Case-insensitive partial match
    matchStage = {
      $and: [
        { active: true },
        { $or: [{ name: regex }, { fullName: regex }] }
      ]
    };
  }

  // if (query) {
  //   const regex = new RegExp(query, "i"); // Case-insensitive partial match
  //   matchStage = {
  //     $and: [
  //       { active: true },
  //       { $or: [{ name: regex }, { fullName: regex }] }
  //     ]
  //   };
  // } else if (searchKey) {
  //   const regex = new RegExp(searchKey, "i"); // Case-insensitive partial match
  //   // console.log(searchKey, regex);
  //   matchStage = {
  //     $and: [
  //       { active: true },
  //       {
  //         tags: regex
  //       }
  //     ]
  //   }
  // }

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
