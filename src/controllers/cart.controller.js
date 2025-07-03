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
        quantity // optional now
    } = req.body;

    // Parse quantity or default to 1
    const parsedQuantity = parseInt(quantity);
    const qtyToAdd = (!quantity || isNaN(parsedQuantity) || parsedQuantity <= 0) ? 1 : parsedQuantity;

    if (!cartId || !productId || !variantName) {
        throw new ApiError(400, "cartId, productId, and variantName are required");
    }

    // 1. Fetch product with category
    const product = await Product.findById(productId)
        .populate("category")
        .exec();

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    const availableVariantStock = product.variants.get(variantName);
    if (availableVariantStock === undefined) {
        throw new ApiError(400, "Selected variant does not exist");
    }

    const latestPrice = product.sellingPrice?.[product.sellingPrice.length - 1]?.price;
    if (!latestPrice || isNaN(latestPrice)) {
        throw new ApiError(400, "No valid price found for product");
    }

    // 2. Check if cart exists or create
    let cart = await Cart.findById(cartId);
    if (!cart) {
        cart = await Cart.create({
            _id: cartId,
            userId: req.user._id,
            items: []
        });
    }

    let items = cart.items || [];
    const existingIndex = items.findIndex(
        item =>
            item.productId.toString() === productId &&
            item.variantName === variantName
    );

    if (existingIndex !== -1) {
        // Item exists — increment quantity
        const currentQty = items[existingIndex].quantity;
        const newQty = currentQty + qtyToAdd;

        if (newQty > availableVariantStock) {
            throw new ApiError(400, `Only ${availableVariantStock} units available for ${variantName}`);
        }

        items[existingIndex] = {
            ...items[existingIndex].toObject(),
            fullName: product?.fullName,
            basePrice: product?.basePrice,
            quantity: newQty,
            price: latestPrice // sync to latest price
        };
    } else {
        // Add new item
        if (qtyToAdd > availableVariantStock) {
            throw new ApiError(400, `Only ${availableVariantStock} units available for ${variantName}`);
        }

        items.push({
            productId,
            fullName: product?.fullName,
            basePrice: product?.basePrice,
            variantName,
            quantity: qtyToAdd,
            price: latestPrice
        });
    }

    // 3. Save updated cart
    cart.items = items;

    // Recalculate total cart value
    cart.totalCartValue = items.reduce((total, item) => {
        return total + item.quantity * item.price;
    }, 0);

    const updatedCart = await cart.save();
    if (!updatedCart) {
        throw new ApiError(500, "Failed to update cart");
    }

    // 4. Populate user with product details
    const updatedUser = await User.findById(req.user._id)
        .select('-password -refreshToken')
        .populate({
            path: "cart",
            populate: {
                path: "items.productId",
                model: "Product",
                populate: {
                    path: "category",  // This is the key part
                    model: "SubCategory"
                }
            }
        })
        .populate("wishlist")
        // .populate("orders")
        .exec();
    //populate orders

    return res.status(201).json(
        new ApiResponse(201, {
            user: updatedUser
        }, "Product added to cart successfully")
    );
});

const removeProductFromCart = asyncHandler(async (req, res) => {
    const { cartId, productId, variantName } = req.body;

    if (!cartId || !productId || !variantName) {
        throw new ApiError(400, "cartId, productId, and variantName are required");
    }

    // 1. Fetch the cart
    const cart = await Cart.findById(cartId);
    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    const items = cart.items || [];

    const index = items.findIndex(
        item =>
            item.productId.toString() === productId &&
            item.variantName === variantName
    );

    if (index === -1) {
        throw new ApiError(404, "Item not found in cart");
    }

    // 2. Fetch product to get latest price (for consistency)
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    const latestPrice = product.sellingPrice?.[product.sellingPrice.length - 1]?.price;
    if (!latestPrice || isNaN(latestPrice)) {
        throw new ApiError(400, "Invalid product price");
    }

    // 3. Decrement quantity or remove if 1
    if (items[index].quantity > 1) {
        items[index].fullName = product?.fullName;
        items[index].basePrice = product?.basePrice;
        items[index].quantity -= 1;
        items[index].price = latestPrice; // Sync latest price
    } else {
        items.splice(index, 1); // Remove if quantity is now 0
    }

    // 4. Save updated cart
    cart.items = items;

    // Recalculate total cart value
    cart.totalCartValue = items.reduce((total, item) => {
        return total + item.quantity * item.price;
    }, 0);

    let updatedCart = await cart.save();

    if (!updatedCart) {
        throw new ApiError(500, "Failed to update cart");
    }

    // 5. Populate user with cart and product details
    const updatedUser = await User.findById(req.user._id)
        .select('-password -refreshToken')
        .populate({
            path: "cart",
            populate: {
                path: "items.productId",
                model: "Product",
                populate: {
                    path: "category",  // This is the key part
                    model: "SubCategory"
                }
            }
        })
        .populate("wishlist")
        // .populate("orders")
        .exec();
    //populate orders

    // 6. Recalculate total cart value
    const totalCartValue = updatedUser.cart.items.reduce((total, item) => {
        return total + item.quantity * item.price;
    }, 0);

    updatedCart.items = items;
    updatedCart.totalCartValue = totalCartValue;
    updatedCart = await updatedCart.save();

    return res.status(200).json(
        new ApiResponse(200, {
            user: updatedUser,
            // totalCartValue
        }, "Product removed from cart successfully")
    );
});

export {
    addProductInCart,
    removeProductFromCart
}