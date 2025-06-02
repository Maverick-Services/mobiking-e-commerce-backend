import { Product } from "../models/product.model.js";
import { Stock } from "../models/stock.model.js";
import { SubCategory } from "../models/sub_category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createProduct = asyncHandler(async (req, res) => {
    const {
        name, fullName, description,
        price, categoryId,
        slug, active } = req.body;

    //TODO: Add Images to it

    //Validate details
    if (
        !slug ||
        !name || !fullName || !description ||
        !price || !categoryId
    ) {
        throw new ApiError(400, "Details not found");
    }

    // Validate parent category Id
    const foundCategory = await SubCategory.findById(categoryId);
    if (!foundCategory) {
        throw new ApiError(409, `Category not found`);
    }

    //create selling price
    const sellingPrice = [{ price }]

    //create new product
    const newProduct = await Product.create({
        name, fullName, description,
        slug, active,
        sellingPrice,
        category: categoryId
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

const updateProductStock = asyncHandler(async (req, res) => {
    const {
        variantName,
        purchasePrice,
        quantity,
        productId
    } = req.body;

    // Validate input
    if (
        !variantName ||
        !purchasePrice ||
        !quantity ||
        !productId
    ) {
        throw new ApiError(400, "Details not found");
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        throw new ApiError(400, "Quantity must be a valid number");
    }

    // Check if product exists
    const existingProduct = await Product.findById(productId)
        .populate("category stock").exec(); //populate order, group here

    if (!existingProduct) {
        throw new ApiError(409, "Product not found");
    }

    // Create new stock entry
    const newProductStock = await Stock.create({
        variantName,
        purchasePrice,
        quantity,
        productId
    });

    if (!newProductStock) {
        throw new ApiError(409, "Could not create stock");
    }

    // Update totalStock and variant quantity
    const currentVariantQty = existingProduct.variants.get(variantName) || 0;
    const updatedVariantQty = currentVariantQty + parsedQuantity;
    const updatedTotalStock = existingProduct.totalStock + parsedQuantity;


    existingProduct.totalStock = updatedTotalStock;
    existingProduct.variants.set(variantName, updatedVariantQty);
    existingProduct.stock.push(newProductStock._id);

    const updatedProduct = await Product.findByIdAndUpdate(
        existingProduct?._id,
        {
            totalStock: existingProduct.totalStock,
            variants: existingProduct.variants,
            stock: existingProduct.stock
        },
        { new: true }
    ).populate("category stock orders groups").exec();

    return res.status(201).json(
        new ApiResponse(201, updatedProduct, "Product stock updated successfully")
    );
});

const editProduct = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        name, fullName, description,
        price, categoryId,
        slug, active
    } = req.body;

    //TODO: Add Images to it

    //Validations
    if (
        !_id ||
        !slug ||
        !name || !fullName || !description ||
        !price || !categoryId
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
            name, fullName, description,
            slug, active,
            sellingPrice,
            category: categoryId
        },
        { new: true }
    ).populate("category stock").exec(); //populate order, group here
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

const markProductInGroup = asyncHandler(async (req, res) => { });
const deleteProduct = asyncHandler(async (req, res) => { });
const getAllProducts = asyncHandler(async (req, res) => { });
const getProductsByCategory = asyncHandler(async (req, res) => { });
const getProductsByGroup = asyncHandler(async (req, res) => { });
const getProductById = asyncHandler(async (req, res) => { });
const getProductBySlug = asyncHandler(async (req, res) => { });

export {
    createProduct,
    updateProductStock,
    editProduct,
    markProductInGroup,
    deleteProduct,
    getAllProducts,
    getProductsByCategory,
    getProductsByGroup,
    getProductById,
    getProductBySlug
}