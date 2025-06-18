import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from "uuid";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Product } from '../models/product.model.js';   // <-- import Product
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from '../utils/asyncHandler.js';
import { checkPickupStatus } from './shiprocket.controller.js';

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
            addressId,
            method = 'COD',
            isAppOrder
        } = req.body;

        if (
            !userId || !address || !cartId ||
            !name || !email || !phoneNo ||
            !orderAmount || !deliveryCharge ||
            // !gst || 
            !subtotal || !method
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
            addressId,
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

const createOnlineOrder = asyncHandler(async (req, res) => {
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
            addressId,
            isAppOrder
        } = req.body;

        if (
            !userId || !cartId || !name || !email || !phoneNo ||
            !orderAmount || !subtotal || !deliveryCharge ||
            // !gst || 
            !address
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
            addressId,
            method: 'Online',
            type: 'Regular',
            status: 'New',
            paymentStatus: 'Pending',
            isAppOrder,
            abondonedOrder: true,
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

        const newCart = new Cart({
            userId: cart.userId,
            items: cart.items,
            totalCartValue: cart.totalCartValue
        });

        await newCart.save({ session });

        const updatedUser = await User.findByIdAndUpdate(
            cart.userId,
            { cart: newCart._id },
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

        await Cart.findByIdAndDelete(cart._id, { session });

        return res.status(201).json(
            new ApiResponse(201, {
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID,
                newOrderId: newOrder._id,
                user: updatedUser
            }, 'Razorpay Order Created')
        );

    } catch (err) {
        console.error('createOnlineOrder error:', err);
        return res.status(500).json({ message: err.message || 'Internal server error' });
    } finally {
        session.endSession();
    }
});

const verifyPayment = async (req, res) => {
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

        let updatedUser = null;

        if (isValid) {
            // ✅ Payment Verified
            await session.withTransaction(async () => {
                order.abondonedOrder = false;
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

                updatedUser = await User.findByIdAndUpdate(
                    order.userId,
                    { $push: { orders: order._id } },
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
                    .exec();;

                cart.items = [];
                cart.totalCartValue = 0;
                await cart.save({ session });
            });

            return res.status(200).json(
                new ApiResponse(200, { order, user: updatedUser }, "Payment Verified. Order Completed")
            );
        }

        // ❌ Payment Verification Failed
        // await session.withTransaction(async () => {
        //     order.abondonedOrder = true;
        //     await order.save({ session });

        //     const newCart = new Cart({
        //         userId: cart.userId,
        //         items: cart.items,
        //         totalCartValue: cart.totalCartValue
        //     });

        //     await newCart.save({ session });

        //     updatedUser = await User.findByIdAndUpdate(
        //         cart.userId,
        //         { cart: newCart._id },
        //         { new: true, session }
        //     ).select('-password -refreshToken')
        //         .populate({
        //             path: "cart",
        //             populate: {
        //                 path: "items.productId",
        //                 model: "Product",
        //                 populate: {
        //                     path: "category",  // This is the key part
        //                     model: "SubCategory"
        //                 }
        //             }
        //         })
        //         .populate("wishlist")
        //         .populate("address")
        //         .populate("orders")
        //         .exec();

        //     await Cart.findByIdAndDelete(cart._id, { session });
        // });

        return res.status(400).json(
            new ApiResponse(400, { user: updatedUser }, 'Payment Failed. Cart Restored')
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
    const userOrders = await Order.find(
        { userId: req?.user?._id, abondonedOrder: false },
        // {  }
    )
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

const acceptOrder = asyncHandler(async (req, res, next) => {
    try {
        const { shiprocketToken } = req;
        const { orderId } = req.body;

        //Validate Order Id
        if (!orderId) {
            throw new ApiError(400, 'Order Id not Found');
        }

        //check if order exist
        const foundOrder = await Order.findById(orderId)
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
            .populate('addressId')
            .exec();
        // console.log("Found Order", foundOrder);
        if (!foundOrder) {
            throw new ApiError(400, 'Order does not exist');
        }

        if (foundOrder && foundOrder?.status === "Cancelled")
            return res.status(404).json({ message: 'Order is cancelled' });

        //Format the items name
        const order_items = foundOrder.items.map((item) => {
            const variant = item.variantName || ""; // e.g. "Red / XL"

            return {
                name: `${item.productId.fullName}${variant ? `\n , ${variant}` : ""}`, // Two-line name
                sku: uuidv4().split('-')[0].toUpperCase() || item?.productId?._id,
                // sku: `${item.productId._id}-${variant.replace(/\s+/g, "_").toUpperCase()}`,
                units: item.quantity,
                selling_price: item.price,
                tax: item?.productId?.gst
            };
        });

        //Create the shiprocket payload for order creation
        const payload = {
            order_id: foundOrder._id,
            order_date: foundOrder.createdAt || new Date().toISOString().split("T")[0],
            pickup_location: "Work",
            billing_customer_name: foundOrder.name,
            billing_last_name: "",
            billing_address: foundOrder.address || "Rohini Delhi",
            billing_city: foundOrder.addressId?.city,
            billing_pincode: foundOrder.addressId?.pinCode,
            billing_state: foundOrder.addressId?.state,
            billing_country: "India",
            billing_email: foundOrder.email,
            billing_phone: foundOrder.phoneNo,
            shipping_is_billing: true,
            order_items,                                   // ← variant‑aware items
            payment_method: foundOrder.method === "Online" ? "Prepaid" : "COD",
            shipping_charges: foundOrder.deliveryCharge || 0,
            total_discount: foundOrder.discount || 0,
            sub_total: foundOrder.subtotal,
            length: 10,
            breadth: 10,
            height: 10,
            weight: 1
        };

        // create order on shiprocket and get the shipmnet Id
        const { data } = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', payload, {
            headers: {
                Authorization: `Bearer ${shiprocketToken}`
            }
        });
        // console.log("shiprocket order creation response", data);
        // console.log("New Order: ", data, "Payload sent: ", payload);

        if (!data?.shipment_id) {
            throw new ApiError(409, 'Could create order at Shiprocket');
        }

        let updatedOrder = await Order.findByIdAndUpdate(
            foundOrder?._id,
            {
                status: 'Accepted',
                shipmentId: data?.shipment_id,
                shiprocketOrderId: data?.order_id,
                shiprocketChannelId: data?.channel_order_id,
            },
            { new: true }
        ).populate({
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
            .populate('addressId')
            .exec();

        req.order = updatedOrder;
        next();
        // return res.status(200).json(
        //     new ApiResponse(200, { shipmentId: data?.shipment_id }, "Order created with Shiprocket")
        //     // { message: 'Order created with Shiprocket', shipmentId: data?.shipment_id }
        // );

    } catch (err) {
        console.error("Shiprocket Order Error:", err?.response?.data || err);
        res.status(500).json({ error: 'Shiprocket order creation failed' });
    }
});

// Utility: adjust stock back to inventory
async function adjustStock(order) {
    const ops = order.items.map(item => ({
        updateOne: {
            filter: { _id: item.productId },
            update: {
                $inc: {
                    totalStock: item.quantity,
                    [`variants.${item.variantName}`]: item.quantity
                }
            }
        }
    }));
    await Product.bulkWrite(ops);
}

// 1️⃣ Cancel when order accepted but not created on Shiprocket
const preShiprocketCancel = async (req, res, next) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order && order?.status === "Cancelled") return res.status(404).json({ message: 'Order already cancelled' });
    // Stage: accepted locally but no Shiprocket order
    if (!order.shipmentId) {
        order.status = 'Cancelled';
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order cancelled before Shiprocket creation, stock restored' });
    }
    req.order = order;
    next();
};

// 2️⃣ Cancel when only Shiprocket order created, no AWB
const createdCancel = async (req, res, next) => {
    const order = req.order;
    if (order?.shipmentId && !order?.awbCode) {
        // Cancel Shiprocket order
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel',
            { ids: [order.shiprocketOrderId] },
            { headers: { Authorization: `Bearer ${req.shiprocketToken}` } }
        );
        order.status = 'Cancelled';
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order cancelled on Shiprocket before courier assignment, stock restored' });
    }
    next();
};

// 3️⃣ Cancel when AWB assigned but pickup not scheduled
const awbCancel = async (req, res, next) => {
    const order = req.order;
    if (order?.awbCode && !order?.pickupDate) {
        // await axios.delete(
        //     'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
        //     { headers: { Authorization: `Bearer ${req.shiprocketToken}` }, data: { shipment_id: order.shipmentId } }
        // );
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs',
            { awbs: [order?.awbCode] },
            { headers: { Authorization: `Bearer ${req.shiprocketToken}` } }
        );
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel',
            { ids: [order?.shiprocketOrderId] },
            { headers: { Authorization: `Bearer ${req.shiprocketToken}` } }
        );
        order.status = 'Cancelled';
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Courier assigned and order cancelled, stock restored' });
    }
    next();
};

// 4️⃣ Cancel when pickup scheduled (or label generated)
const postPickupCancel = async (req, res, next) => {
    const order = req.order;

    //If order is picked up then call next controller for rto
    const pickupCheck = await checkPickupStatus(order?.shipmentId, req?.shiprocketToken);

    if (pickupCheck?.completed) next();

    if (order?.pickupDate && order?.shippingStatus === 'Pickup Scheduled') {
        // Initiate RTO
        // await axios.post(
        //     'https://apiv2.shiprocket.in/v1/external/courier/rto',
        //     { shipment_id: order.shipmentId },
        //     { headers: { Authorization: `Bearer ${req.shiprocketToken}` } }
        // );
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs',
            { awbs: [order?.awbCode] },
            { headers: { Authorization: `Bearer ${req?.shiprocketToken}` } }
        );
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel',
            { ids: [order?.shiprocketOrderId] },
            { headers: { Authorization: `Bearer ${req?.shiprocketToken}` } }
        );
        order.status = 'Cancelled';
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Pickup cancelled via RTO, stock will be restored on return' });
    }
    else
        next();
};

// 5️⃣ RTO when shipment picked up or in transit
const inTransitCancel = async (req, res, next) => {
    const order = req.order;
    const inTransitStates = ['Shipped', 'In Transit', 'Picked Up'];
    if (inTransitStates.includes(order.shippingStatus)) {
        order.status = 'Cancelled';
        await order.save();
        // stock to be adjusted on return processing
        return res.json({ message: 'Order marked cancelled; stock will restore upon return' });
    }
    next();
};

// 6️⃣ RTO when delivered
const deliveredCancel = async (req, res) => {
    const order = req.order;
    if (order.shippingStatus === 'Delivered') {
        return res.status(400).json({ message: 'Cannot cancel after delivery' });
    }
    // fallback
    return res.status(400).json({ message: 'Invalid cancellation stage' });
};

export {
    createCodOrder,
    createOnlineOrder,
    verifyPayment,
    getAllOrdersByUser,
    getAllOrders,
    createAbandonedOrderFromCart,
    acceptOrder,
    preShiprocketCancel,
    createdCancel,
    awbCancel,
    postPickupCancel,
    inTransitCancel,
    deliveredCancel
}