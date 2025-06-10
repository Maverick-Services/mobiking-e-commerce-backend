import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from "uuid";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Product } from '../models/product.model.js';   // <-- import Product
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from '../utils/asyncHandler.js';

const razorpayConfig = () => {
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    return razorpay;
}

const createCodOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            userId, cartId,
            name, email, phoneNo,
            orderAmount,
            discount,
            deliveryCharge,
            gst,
            subtotal,
            address,
            method = 'COD',
            isAppOrder
        } = req.body;

        if (
            !userId || !address || !cartId ||
            !name || !email || !phoneNo ||
            !orderAmount || !deliveryCharge || !gst || !subtotal || !method
        ) {
            throw new ApiError(400, 'Required details not found.');
        }

        const cart = await Cart.findOne({ _id: cartId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            throw new ApiError(400, 'Cart is empty or not found.');
        }

        // console.log('Cart Items:', cart.items.map(it => ({
        //     quantity: it.quantity,
        //     variantName: it.variantName,
        //     productId: it.productId,
        //     productIdType: typeof it.productId,
        //     productPopulated: it.productId?._id
        // })));

        const newOrderDoc = new Order({
            userId,
            name, email, phoneNo,
            address,
            method,
            type: 'Regular',
            status: 'New',
            paymentStatus: 'Pending',
            isAppOrder,
            abondonedOrder: false,
            orderId: uuidv4().split('-')[0].toUpperCase(),
            orderAmount,
            discount,
            deliveryCharge,
            gst,
            subtotal,
            items: cart.items
        });

        let updatedUser = null;
        await session.withTransaction(async () => {
            // Save order
            await newOrderDoc.save({ session });

            // Decrement stock
            const bulkOps = cart.items.map(it => ({
                updateOne: {
                    filter: {
                        _id: it.productId._id,
                        totalStock: { $gte: it.quantity },
                        [`variants.${it.variantName}`]: { $gte: it.quantity }
                    },
                    update: {
                        $inc: {
                            totalStock: -it.quantity,
                            [`variants.${it.variantName}`]: -it.quantity
                        }
                    }
                }
            }));

            const bulkRes = await Product.bulkWrite(bulkOps, { session });
            const failed = bulkRes.modifiedCount !== cart.items.length;
            if (failed) throw new ApiError(404, 'One or more items are out of stock.');

            // ✅ Add order to each product

            //Finding unique product ids and then add them
            const uniqueProductIds = new Set();
            cart.items.forEach(it => {
                if (it.productId && it.productId._id) {
                    uniqueProductIds.add(it.productId._id.toString());
                }
            });

            const productOrderOps = Array.from(uniqueProductIds).map(productId => ({
                updateOne: {
                    filter: { _id: productId },
                    update: { $push: { orders: newOrderDoc._id } }
                }
            }));

            // console.log("Product Ids: ",productOrderOps);
            if (productOrderOps.length > 0) {
                const productResult = await Product.bulkWrite(productOrderOps, { session });
                console.log('Order pushed to products:', productResult);
            } else {
                console.warn('⚠️ No valid products found to push order');
            }

            // Clear cart
            cart.items = [];
            cart.totalCartValue = 0;
            await cart.save({ session });

            // Add order to user
            updatedUser = await User.findByIdAndUpdate(
                req?.user?._id,
                { $push: { orders: newOrderDoc._id } },
                { new: true, session }
            ).select('-password -refreshToken')
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
                .populate("address")
                .populate("orders")
                .exec();

            if (!updatedUser) throw new ApiError(500, "Failed to update user orders");

        });

        return res.status(201).json(
            new ApiResponse(201, { order: newOrderDoc, user: updatedUser }, "Order Placed Successfully")
        );

    } catch (err) {
        console.error('Error placing order:', err.message);
        return res.status(500).json({ message: err.message || 'Internal server error' });
    } finally {
        session.endSession();
    }
});

export const createOnlineOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            userId, cartId,
            name, email, phoneNo,
            orderAmount,
            discount,
            deliveryCharge,
            gst,
            subtotal,
            address,
            isAppOrder
        } = req.body;

        if (
            !userId || !cartId || !name || !email || !phoneNo ||
            !orderAmount || !subtotal || !deliveryCharge || !gst || !address
        ) {
            throw new ApiError(400, 'Required order details missing.');
        }

        const cart = await Cart.findOne({ _id: cartId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            throw new ApiError(400, 'Cart is empty or not found.');
        }

        const razorpay = await razorpayConfig();

        // 1️⃣ Create Razorpay Order
        const razorpayOrder = await razorpay.orders.create({
            amount: orderAmount * 100, // in paise
            currency: 'INR',
            receipt: `rcpt_${uuidv4().split('-')[0]}`,
            payment_capture: 1
        });

        // 2️⃣ Create Order in DB (status: Created)
        const newOrder = new Order({
            userId,
            name, email, phoneNo,
            address,
            method: 'Online',
            type: 'Regular',
            status: 'New',
            paymentStatus: 'Pending',
            isAppOrder,
            abondonedOrder: false,
            orderId: uuidv4().split('-')[0].toUpperCase(),
            razorpayOrderId: razorpayOrder.id,
            orderAmount,
            discount,
            deliveryCharge,
            gst,
            subtotal,
            items: cart.items
        });

        await newOrder.save({ session });

        return res.status(201).json(
            new ApiResponse(201, {
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID,
                newOrderId: newOrder._id
            }, 'Razorpay Order Created')
        );

    } catch (err) {
        console.error('createOnlineOrder error:', err);
        return res.status(500).json({ message: err.message || 'Internal server error' });
    } finally {
        session.endSession();
    }
});

export const verifyPayment = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId: dbOrderId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !dbOrderId) {
            throw new ApiError(400, 'Payment verification details missing.');
        }

        // 1️⃣ Verify Signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        const isValid = generatedSignature === razorpay_signature;

        const order = await Order.findById(dbOrderId).populate('items.productId');
        if (!order) throw new ApiError(404, 'Order not found.');

        const cart = await Cart.findOne({ userId: order.userId });

        if (isValid) {
            // ✅ Payment Verified
            await session.withTransaction(async () => {
                order.paymentStatus = 'Paid';
                order.razorpayOrderId = razorpay_order_id;
                order.razorpayPaymentId = razorpay_payment_id;
                await order.save({ session });

                const uniqueProductIds = [
                    ...new Set(order.items.map(it => it.productId._id.toString()))
                ];

                for (const item of order.items) {
                    await Product.updateOne(
                        {
                            _id: item.productId._id,
                            totalStock: { $gte: item.quantity },
                            [`variants.${item.variantName}`]: { $gte: item.quantity }
                        },
                        {
                            $inc: {
                                totalStock: -item.quantity,
                                [`variants.${item.variantName}`]: -item.quantity
                            }
                        },
                        { session }
                    );
                }

                await Product.updateMany(
                    { _id: { $in: uniqueProductIds } },
                    { $push: { orders: order._id } },
                    { session }
                );

                await User.findByIdAndUpdate(
                    order.userId,
                    { $push: { orders: order._id } },
                    { session }
                );

                cart.items = [];
                cart.totalCartValue = 0;
                await cart.save({ session });
            });

            return res.status(200).json(
                new ApiResponse(200, order, "Payment Verified. Order Completed")
            );
        }

        // ❌ Payment Verification Failed
        await session.withTransaction(async () => {
            order.abondonedOrder = true;
            await order.save({ session });

            const newCart = new Cart({
                userId: cart.userId,
                items: cart.items,
                totalCartValue: cart.totalCartValue
            });

            await newCart.save({ session });

            await User.findByIdAndUpdate(
                cart.userId,
                { cart: newCart._id },
                { session }
            );

            await Cart.findByIdAndDelete(cart._id, { session });
        });

        return res.status(400).json(
            new ApiResponse(400, null, 'Payment Failed. Cart Restored')
        );

    } catch (err) {
        console.error('verifyPayment error:', err);
        return res.status(500).json({ message: err.message || 'Internal server error' });
    } finally {
        session.endSession();
    }
};

const getAllOrdersByUser = asyncHandler(async (req, res) => {

    // console.log("User", req?.user?._id);
    const userOrders = await Order.find({ userId: req?.user?._id })
        .populate({
            path: "userId",
            select: "-password -refreshToken"
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",  // This is the key part
                model: "SubCategory"
            }
        })
        .exec();

    if (!userOrders) {
        throw new ApiError(500, "Something went wrong while fetching the orders")
    }

    return res.status(200).json(
        new ApiResponse(200, userOrders, "Orders fetched successfully")
    )

})

const getAllOrders = asyncHandler(async (req, res) => {
    const allOrder = await Order.find({})
        .populate({
            path: 'userId',
            select: "-password -refreshToken"
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",  // This is the key part
                model: "SubCategory"
            }
        })
        .exec();

    if (!allOrder) {
        throw new ApiError(409, "Could not find orders");
    }

    return res.status(200).json(
        new ApiResponse(200, allOrder, "Orders fetched Successfully")
    )
});

const createAbandonedOrderFromCart = async (cartId, userId, address) => {
    if (!cartId || !userId || !address) {
        throw new Error("Cart ID, User ID, and address are required.");
    }

    const cart = await Cart.findById(cartId).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart not found or empty.");
    }

    let subtotal = 0;
    cart.items.forEach(item => {
        subtotal += item.quantity * item.price;
    });

    const deliveryCharge = subtotal >= 500 ? 0 : 40;
    const discount = 0;
    const gst = parseFloat((subtotal * 0.18).toFixed(2));
    const orderAmount = subtotal + gst + deliveryCharge - discount;

    const newOrder = new Order({
        orderId: `ORD-${uuidv4()}`,
        userId,
        orderAmount,
        address,
        deliveryCharge,
        discount,
        gst,
        subtotal,
        abondonedOrder: true,
        isAppOrder: false,
        method: "COD",
        items: cart.items.map(item => ({
            productId: item.productId._id,
            variantName: item.variantName,
            quantity: item.quantity,
            price: item.price,
        })),
    });

    await newOrder.save();
    return newOrder;
};

export {
    createCodOrder,
    getAllOrdersByUser,
    getAllOrders,
    createAbandonedOrderFromCart
}