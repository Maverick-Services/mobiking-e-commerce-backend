import { Cart } from '../models/cart.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Product } from './../models/product.model.js';

const addProductInCart = asyncHandler(async (req, res) => {
    const {
        cartId,
        productId,
        variantName,
        quantity,
        price
    } = req.body;

    // Validate input
    if (
        !cartId ||
        !productId ||
        !variantName ||
        !quantity ||
        !price
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

    // Check if cart exists
    const existingCart = await Cart.findById(cartId)
        .populate("userId").exec(); //populate order, group here

    if (!existingCart) {
        throw new ApiError(409, "Cart not found");
    }

    let items = existingCart?.items;
    if (items.length > 0 && items?.filter(it => it?.productId == productId && it?.variantName == variantName).length > 0) {
        console.log("Item Found: ", items?.map(it => ({ ...it, variantName: 'blue' })));
        items = items?.map(it => {
            if (it?.productId == productId && it?.variantName == variantName) {
                // it = {
                //     ...it,
                //     quantity,
                //     price
                // }
            }
            return it;
        })
    } else {
        items.push({
            productId,
            variantName,
            quantity,
            price
        })
    }

    // Create new stock entry
    const updatedCart = await Cart.findByIdAndUpdate(
        cartId,
        {
            items
        },
        { new: true }
    );

    if (!updatedCart) {
        throw new ApiError(409, "Could not add Items to cart");
    }

    const updatedUser = await User.findById(req?.user?._id)
        .populate("cart wishlist").exec(); //populate orders

    return res.status(201).json(
        new ApiResponse(201, updatedUser, "Product added successfully")
    );
});

export {
    addProductInCart
}