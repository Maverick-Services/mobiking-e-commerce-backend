import { Product } from "../models/product.model.js";
import { Stock } from "../models/stock.model.js";
import { SubCategory } from "../models/sub_category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const createProduct = asyncHandler(async (req, res) => {
    let {
        name, fullName, description,
        price, categoryId,
        slug, active, images,
        descriptionPoints,
        keyInformation,
        basePrice, regularPrice,
        sku, hsn
    } = req.body;

    //TODO: Add Images to it

    //Validate details
    if (
        !slug ||
        !name || !fullName || !description ||
        !price || !categoryId
    ) {
        throw new ApiError(400, "Details not found");
    }

    name = name.trim()
    fullName = fullName.trim()
    description = description.trim()

    // Validate parent category Id
    const foundCategory = await SubCategory.findById(categoryId);
    if (!foundCategory) {
        throw new ApiError(409, `Category not found`);
    }

    //create selling price
    const sellingPrice = [{ price }]

    // let images = [];

    // if (Array.isArray(req.files?.images) && req.files.images.length > 0) {
    //     const uploadPromises = req.files.images.map(async (fl) => {
    //         const filePath = fl?.path;
    //         const image = await uploadOnCloudinary(filePath);
    //         return image;
    //     });

    //     images = await Promise.all(uploadPromises); // ✅ Wait for all uploads
    //     images = images?.map(ph => ph?.secure_url);
    // }

    //create new product
    const newProduct = await Product.create({
        name, fullName, description,
        slug, active,
        sellingPrice,
        category: categoryId,
        images: images ? images : [],
        keyInformation,
        descriptionPoints,
        sku, hsn,
        basePrice: basePrice || 0,
        regularPrice: regularPrice || 0
    });
    if (!newProduct) {
        throw new ApiError(409, "Could not create product");
    }

    //add the product in subCategory
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
        { _id: categoryId },
        {
            $push: {
                products: newProduct?._id
            }
        },
        { new: true }
    ).populate("parentCategory products").exec();
    console.log("Sub Category: ", updatedSubCategory);

    //return response
    return res.status(201).json(
        new ApiResponse(201, newProduct, "Product created Successfully")
    )
});

// const updateProductStock = asyncHandler(async (req, res) => {
//     const {
//         vendor,
//         variantName,
//         purchasePrice,
//         quantity,
//         productId
//     } = req.body;

//     // Validate input
//     if (
//         !vendor ||
//         !variantName ||
//         !purchasePrice ||
//         !quantity ||
//         !productId
//     ) {
//         throw new ApiError(400, "Details not found");
//     }

//     const parsedQuantity = parseInt(quantity);
//     if (isNaN(parsedQuantity) || parsedQuantity < 0) {
//         throw new ApiError(400, "Quantity must be a valid number");
//     }

//     // Check if product exists
//     const existingProduct = await Product.findById(productId)
//         .populate("category stock").exec(); //populate order, group here

//     if (!existingProduct) {
//         throw new ApiError(409, "Product not found");
//     }

//     // Create new stock entry
//     const newProductStock = await Stock.create({
//         vendor,
//         variantName,
//         purchasePrice,
//         quantity,
//         productId
//     });

//     if (!newProductStock) {
//         throw new ApiError(409, "Could not create stock");
//     }

//     // Update totalStock and variant quantity
//     const currentVariantQty = existingProduct.variants.get(variantName) || 0;
//     const updatedVariantQty = currentVariantQty + parsedQuantity;
//     const updatedTotalStock = existingProduct.totalStock + parsedQuantity;


//     existingProduct.totalStock = updatedTotalStock;
//     existingProduct.variants.set(variantName, updatedVariantQty);
//     existingProduct.stock.push(newProductStock._id);

//     const updatedProduct = await Product.findByIdAndUpdate(
//         existingProduct?._id,
//         {
//             totalStock: existingProduct.totalStock,
//             variants: existingProduct.variants,
//             stock: existingProduct.stock
//         },
//         { new: true }
//     ).populate("category stock groups").exec(); //populate orders

//     return res.status(201).json(
//         new ApiResponse(201, updatedProduct, "Product stock updated successfully")
//     );
// });

const updateProductStock = asyncHandler(async (req, res) => {
    let {
        vendor,
        variantName,
        purchasePrice,
        quantity,
        productId
    } = req.body;


    if (!variantName || quantity === undefined || !productId) {
        throw new ApiError(400, "All stock details are required");
    }
    variantName = variantName.trim()

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity)) {
        throw new ApiError(400, "Quantity must be a valid number");
    }

    if (parsedQuantity == 0) {
        throw new ApiError(400, "Quantity cannot be 0");
    }

    // Fetch product
    const existingProduct = await Product.findById(productId)
        .populate("category stock")
        .exec();

    if (!existingProduct) {
        throw new ApiError(409, "Product not found");
    }

    const currentVariantQty = existingProduct.variants.get(variantName) || 0;
    const currentTotalStock = existingProduct.totalStock || 0;

    const updatedVariantQty = currentVariantQty + parsedQuantity;
    const updatedTotalStock = currentTotalStock + parsedQuantity;

    // Prevent going below zero
    if (updatedVariantQty < 0 || updatedTotalStock < 0) {
        throw new ApiError(400, "Insufficient stock for this operation");
    }

    // Create stock entry (even for deduction)
    const newProductStock = await Stock.create({
        vendor,
        variantName,
        purchasePrice,
        quantity: parsedQuantity,
        productId
    });

    if (!newProductStock) {
        throw new ApiError(500, "Could not create stock entry");
    }

    // Update product
    existingProduct.totalStock = updatedTotalStock;
    existingProduct.variants.set(variantName, updatedVariantQty);
    existingProduct.stock.push(newProductStock._id);

    const updatedProduct = await Product.findByIdAndUpdate(
        existingProduct._id,
        {
            totalStock: updatedTotalStock,
            variants: existingProduct.variants,
            stock: existingProduct.stock
        },
        { new: true }
    )
        .populate("category stock groups")
        .exec();

    return res.status(201).json(
        new ApiResponse(201, updatedProduct, "Product stock updated successfully")
    );
});

const editProduct = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        name, fullName, description,
        price, categoryId,
        slug, active,
        descriptionPoints,
        keyInformation, images,
        basePrice, regularPrice,
        hsn, sku
    } = req.body;

    //TODO: Add Images to it

    //Validations
    if (
        !_id
        // || !slug ||
        // !name || !fullName || !description ||
        // price == undefined || price == null || !categoryId
    ) {
        throw new ApiError(400, "Details not found");
    }

    const foundProduct = await Product.findById(_id);
    if (!foundProduct) {
        throw new ApiError(409, `Product not found`);
    }

    const foundCategory = await SubCategory.findById(categoryId);
    if (!foundCategory) {
        throw new ApiError(409, `Category not found`);
    }

    //create selling price
    let sellingPrice = foundProduct?.sellingPrice[foundProduct?.sellingPrice?.length - 1];
    if (sellingPrice?.price !== price) {
        sellingPrice = [...foundProduct?.sellingPrice, { price }]
    } else {
        sellingPrice = foundProduct?.sellingPrice
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        { _id },
        {
            name: name?.trim(),
            fullName: fullName?.trim(),
            description: description?.trim(),
            slug,
            hsn, sku,
            active: active != undefined ? active : foundProduct?.active,
            sellingPrice,
            descriptionPoints: descriptionPoints || foundProduct?.descriptionPoints,
            keyInformation: keyInformation || foundProduct?.keyInformation,
            basePrice: basePrice || foundProduct?.basePrice || 0,
            regularPrice: regularPrice || foundProduct?.regularPrice || 0,
            category: categoryId,
            images: images ? images : foundProduct?.images
        },
        { new: true }
    ).populate("category stock groups").exec(); //populate order, group here
    if (!updatedProduct) {
        throw new ApiError(409, "Could not update product");
    }


    ////YET TO BE UODATED 
    // update parent category
    if (foundProduct?.category !== updatedProduct?.category?._id) {
        //Remove product in old sub category
        const oldCategory = await SubCategory.findByIdAndUpdate(
            { _id: foundProduct?.category },
            {
                $pull: {
                    products: foundProduct?._id
                }
            },
            { new: true }
        ).populate("products parentCategory").exec();
        console.log("Old Sub Category: ", oldCategory);

        //add the product in new sub category
        const newCategory = await SubCategory.findByIdAndUpdate(
            { _id: updatedProduct?.category?._id },
            {
                $push: {
                    products: updatedProduct?._id
                }
            },
            { new: true }
        ).populate("products parentCategory").exec();
        console.log("New Sub Category: ", newCategory);
    }

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated Successfully")
    )
});

const updateProductStatus = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        active,
    } = req.body;

    //Validations
    if (
        !_id
    ) {
        throw new ApiError(400, "Details not found");
    }

    const foundProduct = await Product.findById(_id);
    if (!foundProduct) {
        throw new ApiError(409, `Product not found`);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        { _id },
        {
            active: active != undefined ? active : foundProduct?.active
        },
        { new: true }
    ).populate("category stock groups").exec(); //populate order, group here
    if (!updatedProduct) {
        throw new ApiError(409, "Could not update product");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated Successfully")
    )
});

const getProductBySlug = asyncHandler(async (req, res) => {
    const completeProductDetails = await Product.findOne({
        slug: req.params.slug
    }).populate("category stock groups").exec();

    if (!completeProductDetails) {
        throw new ApiError(409, "Could not fetch product details");
    }

    return res.status(200).json(
        new ApiResponse(200, completeProductDetails, "Product details fetched Successfully")
    )
});

const getAllProducts = asyncHandler(async (req, res) => {
    const allProducts = await Product.find({}).populate("orders stock groups category").exec();

    if (!allProducts) {
        throw new ApiError(409, "Could not find products");
    }

    return res.status(200).json(
        new ApiResponse(200, allProducts, "Products fetched Successfully")
    )
});

const getAllActiveInstockProducts = asyncHandler(async (req, res) => {
    const allProducts = await Product.find({
        active: true, totalStock: { $gt: 0 }
    }).populate("orders stock groups category").exec();

    if (!allProducts) {
        throw new ApiError(409, "Could not find products");
    }

    return res.status(200).json(
        new ApiResponse(200, allProducts, "Products fetched Successfully")
    )
});

const markProductInGroup = asyncHandler(async (req, res) => { });
const deleteProduct = asyncHandler(async (req, res) => { });
const getProductsByCategory = asyncHandler(async (req, res) => { });
const getProductsByGroup = asyncHandler(async (req, res) => { });
const getProductById = asyncHandler(async (req, res) => { });

export {
    createProduct,
    updateProductStock,
    editProduct,
    updateProductStatus,
    markProductInGroup,
    deleteProduct,
    getAllProducts,
    getAllActiveInstockProducts,
    getProductsByCategory,
    getProductsByGroup,
    getProductById,
    getProductBySlug
}