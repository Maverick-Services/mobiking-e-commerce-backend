import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { v4 as uuidv4 } from "uuid";

export const createAbandonedOrderFromCart = async (cartId, userId, address) => {
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
