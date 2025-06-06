import mongoose from "mongoose";
import { itemsSchema } from './cart.model.js';

const orderSchema = new mongoose.Schema({

    status: {
        type: String,
        enum: ['New', 'Accepted', 'Rejected', 'Cancelled', 'Shipped', 'Delivered', 'Returned', 'Replaced', 'Hold'],
        default: 'New'
    },
    type: {
        type: String,
        enum: ['Regular', 'Pos'],
        default: 'Regular'
    },
    isAppOrder: {
        type: Boolean,
        default: false
    },
    abondonedOrder: {
        type: Boolean,
        default: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    deliveryCharge: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    gst: {
        type: Number,
        default: 0
    },
    subtotal: {
        type: Number,
    },
    method: {
        type: String,
        enum: ['COD', 'ONLINE'],
        default: 'COD',
        // required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [itemsSchema]

}, { timestamps: true });

export const Order = mongoose.model('Order', orderSchema);