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

// ******************************************************
//                  PLACE, ACCEPT, REJECT ORDER CONTROLLERS
// ******************************************************

const createPosOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            userId,
            name, phoneNo,
            orderAmount,
            gst,
            discount,
            subtotal,
            method = 'COD',
            items
        } = req.body;

        if (
            !userId ||
            !name || !phoneNo ||
            !orderAmount ||
            // !gst || 
            !method || !items
        ) {
            throw new ApiError(400, 'Required details not found.');
        }

        const newOrderDoc = new Order({
            userId,
            name, phoneNo,
            method,
            type: 'Pos',
            status: 'Delivered',
            paymentStatus: 'Paid',
            orderId: uuidv4().split('-')[0].toUpperCase(),
            orderAmount,
            discount,
            gst,
            subtotal,
            items
        });

        let updatedUser = null;
        await session.withTransaction(async () => {
            // Save order
            await newOrderDoc.save({ session });

            // Decrement stock
            const bulkOps = newOrderDoc?.items.map(it => ({
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
            const failed = bulkRes.modifiedCount !== newOrderDoc.items.length;
            if (failed) throw new ApiError(404, 'One or more items are out of stock.');

            // ✅ Add order to each product

            //Finding unique product ids and then add them
            const uniqueProductIds = new Set();
            newOrderDoc.items.forEach(it => {
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
            !name || !phoneNo ||
            !orderAmount || deliveryCharge < 0 ||
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

        // console.log("details", userId, cartId, name, phoneNo,
        //     orderAmount, subtotal, deliveryCharge,
        //     // !gst || 
        //     address);
        if (
            !userId || !cartId || !name || !phoneNo ||
            !orderAmount || !subtotal || deliveryCharge > 0 ||
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

        await newCart.save({ session, timestamps: false });

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

const updateOrder = asyncHandler(async (req, res) => {
    try {
        const orderId = req?.params?._id;
        const updates = req?.body;

        if (
            !orderId
        ) {
            throw new ApiError(400, 'Order Id not found.');
        }

        const foundOrder = await Order.findById(orderId);
        if (!foundOrder) {
            throw new ApiError(400, 'Order not found.');
        }

        if (foundOrder?.shipmentId) {
            throw new ApiError(409, 'Order is created at shiprocket');
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                ...updates
            },
            { new: true }
        );

        return res.status(201).json(
            new ApiResponse(201, { updatedOrder }, "Order updated Successfully")
        );

    } catch (err) {
        console.error('Error updating order:', err.message);
        return res.status(500).json({ message: err.message || 'Internal server error' });
    }
});

const addItemQuantityInOrder = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            orderId,
            productId,
            variantName,
            quantity = 1
        } = req.body;

        if (!orderId || !productId || !variantName || !quantity || quantity <= 0) {
            throw new ApiError(400, "All fields are required and quantity must be > 0");
        }

        let updatedOrder;

        await session.withTransaction(async () => {
            const [order, product] = await Promise.all([
                Order.findById(orderId).session(session),
                Product.findById(productId).populate("category").session(session)
            ]);

            if (!order) throw new ApiError(404, "Order not found");
            if (!product) throw new ApiError(404, "Product not found");

            const availableVariantStock = product.variants.get(variantName);
            if (!availableVariantStock || availableVariantStock < quantity || product.totalStock < quantity) {
                throw new ApiError(400, `Item ${product.fullName} in variant ${variantName} is out of stock`);
            }

            // Decrease stock
            product.totalStock -= quantity;
            product.variants.set(variantName, availableVariantStock - quantity);
            await product.save({ session });

            // Update or add item to order
            const existingItem = order.items.find(
                item =>
                    item.productId.toString() === productId &&
                    item.variantName === variantName
            );

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                order.items.push({
                    productId,
                    name: product.fullName,
                    price: product.sellingPrice[product.sellingPrice.length - 1]?.price || 0,
                    variantName,
                    quantity
                });
            }

            // Recalculate subtotal and deliveryCharge
            let subtotal = 0;
            const categoryCharges = new Map();

            for (const item of order.items) {
                const prod = await Product.findOne({ _id: item.productId })
                    .session(session)
                    .populate("category")
                    .exec();

                if (!prod || !prod.category) {
                    throw new ApiError(400, `Product or category missing for ${item.productId}`);
                }

                subtotal += item.price * item.quantity;

                const categoryId = prod.category._id.toString();
                const deliveryCharge = prod.category.deliveryCharge || 0;

                if (deliveryCharge > 0 && !categoryCharges.has(categoryId)) {
                    categoryCharges.set(categoryId, deliveryCharge);
                }
            }

            //   const totalDeliveryCharge = Array.from(categoryCharges.values()).reduce(
            //     (acc, charge) => acc + charge,
            //     0
            //   );
            const totalDeliveryCharge = Math.max(...Array.from(categoryCharges.values()));

            order.subtotal = subtotal;
            order.deliveryCharge = totalDeliveryCharge;
            order.orderAmount = subtotal - (order.discount || 0) + totalDeliveryCharge;

            updatedOrder = await order.save({ session });
        });

        return res
            .status(200)
            .json(new ApiResponse(200, updatedOrder, "Item quantity added successfully"));

    } catch (err) {
        console.error("Add Item Quantity Error:", err.message);
        return res.status(500).json({
            success: false,
            message: err.message || "Internal server error"
        });
    } finally {
        session.endSession();
    }
};

const removeItemQuantityInOrder = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            orderId,
            productId,
            variantName,
            quantity = 1
        } = req.body;

        if (!orderId || !productId || !variantName || !quantity || quantity <= 0) {
            throw new ApiError(400, "All fields are required and quantity must be > 0");
        }

        let updatedOrder;

        await session.withTransaction(async () => {
            const [order, product] = await Promise.all([
                Order.findById(orderId).session(session),
                Product.findById(productId).populate("category").session(session)
            ]);

            if (!order) throw new ApiError(404, "Order not found");
            if (!product) throw new ApiError(404, "Product not found");

            // Find item in order
            const existingItemIndex = order.items.findIndex(
                item =>
                    item.productId.toString() === productId &&
                    item.variantName === variantName
            );

            if (existingItemIndex === -1) {
                throw new ApiError(400, "Item not found in order");
            }

            const existingItem = order.items[existingItemIndex];

            if (existingItem.quantity < quantity) {
                throw new ApiError(400, "Cannot remove more quantity than exists in order");
            }

            // Restore stock
            const currentVariantStock = product.variants.get(variantName) || 0;
            product.totalStock += quantity;
            product.variants.set(variantName, currentVariantStock + quantity);
            await product.save({ session });

            // Decrease quantity or remove item
            existingItem.quantity -= quantity;
            if (existingItem.quantity <= 0) {
                order.items.splice(existingItemIndex, 1);
            }

            // 🔁 Recalculate subtotal, deliveryCharge, and orderAmount
            let subtotal = 0;
            const categoryCharges = new Map();

            for (const item of order.items) {
                console.log("inside items: ", item);
                const p = await Product.findOne({ _id: item.productId })
                    .session(session)
                    .populate("category")
                    .exec();

                if (!p || !p.category) {
                    throw new ApiError(400, `Product or category missing for ${item.productId}`);
                }

                subtotal += item.price * item.quantity;

                const categoryId = p.category._id.toString();
                const deliveryCharge = p.category.deliveryCharge || 0;

                if (deliveryCharge > 0 && !categoryCharges.has(categoryId)) {
                    categoryCharges.set(categoryId, deliveryCharge);
                }
            }

            const totalDeliveryCharge = categoryCharges && categoryCharges?.length
                ? Math.max(...Array.from(categoryCharges.values())) : 0;
            //   const totalDeliveryCharge = Array.from(categoryCharges.values()).reduce(
            //     (acc, charge) => acc + charge,
            //     0
            //   );

            order.subtotal = subtotal;
            order.deliveryCharge = totalDeliveryCharge;
            order.orderAmount = subtotal - (order.discount || 0) + totalDeliveryCharge;

            updatedOrder = await order.save({ session });
        });

        return res.status(200).json(
            new ApiResponse(200, updatedOrder, "Item quantity removed successfully")
        );

    } catch (err) {
        console.error("Remove Item Quantity Error:", err.message);
        return res.status(500).json({
            success: false,
            message: err.message || "Internal server error"
        });
    } finally {
        session.endSession();
    }
};

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

        if (foundOrder && foundOrder?.abondonedOrder)
            return res.status(404).json({ message: `Order is Abandoned` });

        if (foundOrder && foundOrder?.status != "New")
            return res.status(404).json({ message: `Order is ${foundOrder?.status}` });

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
            billing_address: foundOrder?.address || "Rohini Delhi",
            billing_address: foundOrder?.address || "",
            billing_city: foundOrder?.city || foundOrder.addressId?.city,
            billing_pincode: foundOrder?.pincode || foundOrder.addressId?.pinCode,
            billing_state: foundOrder?.state || foundOrder.addressId?.state,
            billing_country: foundOrder?.country || "India",
            billing_email: foundOrder?.email ? foundOrder.email : "",
            billing_phone: foundOrder?.phoneNo,
            shipping_is_billing: true,
            order_items,                                   // ← variant‑aware items
            payment_method: foundOrder?.method === "Online" ? "Prepaid" : "COD",
            shipping_charges: foundOrder?.deliveryCharge || 0,
            total_discount: 0,
            sub_total: foundOrder?.subtotal,
            length: foundOrder?.length || 10,
            breadth: foundOrder?.breadth || 10,
            height: foundOrder?.height || 10,
            weight: foundOrder?.weight || 0.5
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

// ******************************************************
//                 HOLD ABANDONED ORDER CONTROLLERS
// ******************************************************

const holdAbandonedOrder = asyncHandler(async (req, res, next) => {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order && order?.status === "Hold") throw new ApiError(404, 'Order already on hold');
    if (order && !order?.abondonedOrder) throw new ApiError(404, 'Not an abandoned order');

    order.status = 'Hold';
    order.reason = reason;
    const savedOrder = await order.save();
    if (!savedOrder) {
        throw new ApiError(500, "Could not hold order");
    }
    return res.json({ message: 'Order put on Hold' });
});

// ******************************************************
//                 REJECT ORDER CONTROLLERS
// ******************************************************

const rejectAllRequest = (requests, reason) => {
    const updatedRequests = requests?.map((r) => {
        r.isResolved = true;
        r.status = "Rejected";
        r.resolvedAt = new Date().toISOString();
        r.reason = r?.reason ? r.reason : reason;
        return r;
    });
    return updatedRequests;
}

// 1️⃣ Reject when order accepted but not created on Shiprocket
const preShiprocketReject = async (req, res, next) => {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order && order?.status === "Rejected") return res.status(404).json({ message: 'Order already rejected' });
    // Stage: created locally but no Shiprocket order
    if (!order.shipmentId) {
        order.status = 'Rejected';
        order.reason = reason;
        const updatedRequestArr = rejectAllRequest(order?.requests, "Order Rejected");
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order rejected, stock restored' });
    }
    else {
        req.order = order;
        next();
    }
};

// 2️⃣ Reject when only Shiprocket order created, no AWB
const createdReject = async (req, res, next) => {
    const order = req.order;
    const { reason } = req.body;
    if (order?.shipmentId && !order?.awbCode) {
        // Cancel Shiprocket order
        await axios.post(
            'https://apiv2.shiprocket.in/v1/external/orders/cancel',
            { ids: [order.shiprocketOrderId] },
            { headers: { Authorization: `Bearer ${req.shiprocketToken}` } }
        );
        order.status = 'Rejected';
        order.reason = reason;
        const updatedRequestArr = rejectAllRequest(order?.requests, req?.reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order cancelled on Shiprocket, marked Rejected, stock restored' });
    }
    else next();
};

// 3️⃣ Reject when AWB assigned but pickup not scheduled
const awbReject = async (req, res) => {
    const order = req.order;
    const { reason } = req.body;
    if (order?.awbCode && !order?.pickupDate) {
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
        order.status = 'Rejected';
        order.reason = reason;
        const updatedRequestArr = rejectAllRequest(order?.requests, req?.reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Courier and order cancelled on shiprocket, marked rejected, stock restored' });
    }
    else
        return res.status(400).json({ message: 'Could not Reject Order' });
};

// ******************************************************
//                  FETCH ORDERS CONTROLLERS
// ******************************************************

const getFilteredOrdersByDate = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    /* ------------------------- 1. Validate Inputs ------------------------- */
    if (!startDate || !endDate) {
        throw new ApiError(400, "Start date and end date are required");
    }

    const from = new Date(startDate);
    const to = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new ApiError(400, "Invalid date format provided");
    }

    /* ------------------------- 2. Define Filters -------------------------- */
    const filters = {
        createdAt: { $gte: from, $lte: to },
        abondonedOrder: false,
        status: { $nin: ["Rejected", "Cancelled", "Returned", "Replaced", "Hold"] }
    };

    /* ---------------------- 3. Fetch Orders in Range ---------------------- */
    const orders = await Order.find(filters)
        .populate({
            path: "userId",
            model: "User",
            select: "-password -refreshToken",
            populate: {
                path: "orders",
                model: "Order"
            }
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",
                model: "SubCategory"
            }
        })
        .sort({ createdAt: -1 });

    /* --------------------------- 4. Respond ------------------------------- */
    return res
        .status(200)
        .json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

const getOrdersByDate = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    /* ------------------------- 1. Validate Inputs ------------------------- */
    if (!startDate || !endDate) {
        throw new ApiError(400, "Start date and end date are required");
    }

    const from = new Date(startDate);
    const to = new Date(new Date(endDate).setHours(23, 59, 59, 999)); // End of the day

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new ApiError(400, "Invalid date format provided");
    }

    /* ---------------------- 2. Fetch Orders in Range ---------------------- */
    const orders = await Order.find({
        createdAt: {
            $gte: from,
            $lte: to,
        },
    })
        .populate({
            path: 'userId',
            model: "User",
            select: "-password -refreshToken",
            populate: {
                path: "orders",  // This is the key part
                model: "Order"
            }
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",  // This is the key part
                model: "SubCategory"
            }
        })
        .sort({ createdAt: -1 });
    // .exec()

    /* --------------------------- 3. Respond ------------------------------- */
    return res
        .status(200)
        .json(new ApiResponse(200, orders, "Orders fetched successfully"));
});

const getAllOrdersByUser = asyncHandler(async (req, res) => {

    // console.log("User", req?.user?._id);
    const userOrders = await Order.find(
        { userId: req?.user?._id, abondonedOrder: false },
        // {  }
    )
        .populate({
            path: 'userId',
            model: "User",
            select: "-password -refreshToken",
            populate: {
                path: "orders",  // This is the key part
                model: "Order"
            }
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",  // This is the key part
                model: "SubCategory"
            }
        })
        .populate({
            path: "query",
            populate: {
                path: "replies.messagedBy",
                model: "User",
                select: "name email phone role"
            }
        })
        .sort({ createdAt: -1 })
    // .exec();

    if (!userOrders) {
        throw new ApiError(500, "Something went wrong while fetching the orders")
    }

    return res.status(200).json(
        new ApiResponse(200, userOrders, "Orders fetched successfully")
    )

})

const getOrderById = asyncHandler(async (req, res) => {

    if (!req?.params?._id) {
        throw new ApiError(400, "Order Id not found");
    }

    const order = await Order.findById(req?.params?._id)
        .populate({
            path: 'userId',
            model: "User",
            select: "-password -refreshToken",
            populate: {
                path: "orders",  // This is the key part
                model: "Order"
            }
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

    if (!order) {
        throw new ApiError(409, "Could not find order");
    }

    return res.status(200).json(
        new ApiResponse(200, order, "Order fetched Successfully")
    )
});

const getAllOrders = asyncHandler(async (req, res) => {
    const allOrder = await Order.find({})
        .populate({
            path: 'userId',
            model: "User",
            select: "-password -refreshToken",
            populate: {
                path: "orders",  // This is the key part
                model: "Order"
            }
        })
        .populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",  // This is the key part
                model: "SubCategory"
            }
        })
        .sort({ createdAt: -1 })
    // .exec();

    if (!allOrder) {
        throw new ApiError(409, "Could not find orders");
    }

    return res.status(200).json(
        new ApiResponse(200, allOrder, "Orders fetched Successfully")
    )
});

const createAbandonedOrderFromCart = async (cartId, userId, address) => {
    if (!cartId || !userId
        // || !address
    ) {
        throw new Error("Cart ID, User ID, and address are required.");
    }

    const cart = await Cart.findById(cartId).populate("items.productId").populate("userId");
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart not found or empty.");
    }

    let subtotal = 0;
    cart.items.forEach(item => {
        subtotal += item.quantity * item.price;
    });

    // const deliveryCharge = subtotal >= 500 ? 0 : 40;
    // const discount = 0;
    // const gst = parseFloat((subtotal * 0.18).toFixed(2));
    const orderAmount = subtotal;

    const newOrder = new Order({
        orderId: `ORD-${uuidv4()}`,
        userId,
        orderAmount,
        address,
        name: cart?.userId?.name,
        phoneNo: cart?.userId?.phoneNo,
        email: cart?.userId?.email,
        // deliveryCharge,
        // discount,
        // gst,
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


// ******************************************************
//                  ORDER CANCELLATION CONTROLLERS
// ******************************************************

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

const updateRequestStatus = (requests, reason) => {
    const updatedRequests = requests?.map((r) => {
        if (r?.type === "Cancel" && !r?.isResolved) {
            r.isResolved = true;
            r.status = "Accepted";
            r.resolvedAt = new Date().toISOString();
            r.reason = r?.reason ? r.reason : reason;
        }
        return r;
    });
    return updatedRequests;
}

// 1️⃣ Cancel when order accepted but not created on Shiprocket
const preShiprocketCancel = async (req, res, next) => {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order && order?.status === "Cancelled") return res.status(404).json({ message: 'Order already cancelled' });
    // Stage: accepted locally but no Shiprocket order
    if (!order.shipmentId) {
        order.status = 'Cancelled';
        const updatedRequestArr = updateRequestStatus(order?.requests, reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order cancelled, stock restored' });
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
        const updatedRequestArr = updateRequestStatus(order?.requests, req?.reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Order cancelled on Shiprocket, stock restored' });
    }
    next();
};

// 3️⃣ Cancel when AWB assigned but pickup not scheduled
const awbCancel = async (req, res, next) => {
    const order = req.order;
    if (order?.awbCode && !order?.pickupDate) {
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
        const updatedRequestArr = updateRequestStatus(order?.requests, req?.reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Courier and order cancelled, stock restored' });
    }
    next();
};

// 4️⃣ Cancel when pickup scheduled (or label generated)
const postPickupCancel = async (req, res, next) => {
    const order = req.order;

    //If order is picked up then call next controller for rto
    const pickupCheck = await checkPickupStatus(order?.shipmentId, req?.shiprocketToken);

    if (pickupCheck?.completed)
        return res.status(400).json({ message: 'Order cannot be cancelled as it is already picked up' });

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
        const updatedRequestArr = updateRequestStatus(order?.requests, req?.reason);
        console.log("Request Array:", updatedRequestArr);
        order.requests = updatedRequestArr;
        await order.save();
        await adjustStock(order);
        return res.json({ message: 'Pickup and Order cancelled, stock restored' });
    }
    else
        // fallback
        return res.status(400).json({ message: 'Order cannot be cancelled as it is already picked up' });
};


// ******************************************************
//                  ORDER RTO CONTROLLERS
// ******************************************************

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
    createPosOrder,
    createCodOrder,
    createOnlineOrder,
    updateOrder,
    addItemQuantityInOrder,
    removeItemQuantityInOrder,
    verifyPayment,
    getAllOrdersByUser,
    getOrderById,
    getAllOrders,
    getFilteredOrdersByDate,
    getOrdersByDate,
    createAbandonedOrderFromCart,
    holdAbandonedOrder,
    acceptOrder,
    preShiprocketReject,
    createdReject,
    awbReject,
    preShiprocketCancel,
    createdCancel,
    awbCancel,
    postPickupCancel,
    inTransitCancel,
    deliveredCancel
}