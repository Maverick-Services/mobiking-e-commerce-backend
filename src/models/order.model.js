import mongoose from "mongoose";
import { itemsSchema } from "./cart.model.js";

const orderSchema = new mongoose.Schema(
    {
        /****************  CORE ORDER STATES  *****************/
        status: {
            type: String,
            enum: [
                "New",
                "Accepted",
                "Rejected",
                "Shipped",
                "Delivered",
                "Cancelled",
                "Returned",
                "Replaced",
                "Hold"
            ],
            default: "New"
        },
        shippingStatus: {
            type: String,
            enum: [
                "Pending",
                "Courier Assigned",
                "Pickup Scheduled",
                "Shipped",
                "Delivered",
            ],
            default: "Pending"
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Paid"],
            default: "Pending"
        },

        /****************  SHIPROCKET FIELDS  *****************/
        shipmentId: String,  // Shiprocket shipment_id
        shiprocketOrderId: String,  // Shiprocket order_id
        shiprocketChannelId: String,  // Channel order ref
        awbCode: String,  // Air‑way bill
        courierName: String,
        courierAssignedAt: Date,

        pickupScheduled: {
            type: Boolean,
            default: false
        },
        pickupTokenNumber: String,  // “2025‑06‑14”
        pickupDate: String,  // “2025‑06‑14”
        expectedDeliveryDate: String,  // “2025‑06‑14”
        pickupSlot: String,  // e.g. “14:00‑18:00”
        shippingLabelUrl: String,  // e.g. “14:00‑18:00”
        shippingManifestUrl: String,  // e.g. “14:00‑18:00”

        deliveredAt: Date,    // set when status → Delivered

        /****************  PAYMENT FIELDS  *****************/
        razorpayOrderId: String,
        razorpayPaymentId: String,

        /****************  ORDER METADATA  *****************/
        orderId: {
            type: String,
            required: true,
            unique: true
        },
        type: {
            type: String,
            enum: ["Regular", "Pos"],
            default: "Regular"
        },
        method: {
            type: String,
            enum: ["COD", "Online"],
            default: "COD"
        },
        isAppOrder: {
            type: Boolean,
            default: false
        },
        abondonedOrder: {
            type: Boolean,
            default: true
        },

        /****************  PRICING  *****************/
        orderAmount: { type: Number, required: true },
        deliveryCharge: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        subtotal: Number,

        /****************  CUSTOMER INFO  *****************/
        name: String,
        email: String,
        phoneNo: String,

        /****************  ADDRESS  *****************/
        address: String,
        addressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address"
        },

        /****************  RELATIONS  *****************/
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        items: [itemsSchema]
    },
    { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);

// import mongoose from "mongoose";
// import { itemsSchema } from './cart.model.js';

// const orderSchema = new mongoose.Schema({

//     status: {
//         type: String,
//         enum: [
//             "New",
//             "Accepted",
//             "Courier Assigned",
//             "Pickup Scheduled",
//             "Shipped",
//             "Delivered",
//             "Rejected",
//             "Cancelled",
//             "Returned",
//             "Replaced",
//             "Hold"
//         ],
//         default: 'New'
//     },
//     paymentStatus: {
//         type: String,
//         enum: ['Pending', 'Paid'],
//         default: 'Pending'
//     },
//     type: {
//         type: String,
//         enum: ['Regular', 'Pos'],
//         default: 'Regular'
//     },
//     method: {
//         type: String,
//         enum: ['COD', 'Online'],
//         default: 'COD',
//         // required: true
//     },
//     isAppOrder: {
//         type: Boolean,
//         default: false
//     },
//     abondonedOrder: {
//         type: Boolean,
//         default: true
//     },
//     orderId: {
//         type: String,
//         required: true,
//         unique: true
//     },
//     /****************  SHIPROCKET FIELDS  *****************/
//     shipmentId: String,  // Shiprocket shipment_id
//     shiprocketOrderId: String,  // Shiprocket order_id
//     shiprocketChannelId: String,  // Channel order ref
//     shippingStatus: String,  // Last tracking status
//     awbCode: String,  // Air‑way bill
//     courierName: String,
//     courierAssignedAt: Date,

//     pickupScheduled: {
//         type: Boolean,
//         default: false
//     },
//     pickupDate: String,  // “2025‑06‑14”
//     pickupSlot: String,  // e.g. “14:00‑18:00”

//     deliveredAt: Date,    // set when status → Delivered

//     /****************  PAYMENT FIELDS  *****************/
//     razorpayOrderId: String,
//     razorpayPaymentId: String,
//     address: {
//         type: String,
//         required: true,
//     },
//     razorpayOrderId: {
//         type: String,
//         // required: true,
//         // unique: true
//     },
//     razorpayPaymentId: {
//         type: String,
//         // required: true,
//         // unique: true
//     },
//     orderAmount: {
//         type: Number,
//         required: true
//     },
//     name: {
//         type: String,
//         // required: true
//     },
//     email: {
//         type: String,
//         // required: true
//     },
//     phoneNo: {
//         type: String,
//         // required: true
//     },
//     deliveryCharge: {
//         type: Number,
//         default: 0
//     },
//     discount: {
//         type: Number,
//         default: 0
//     },
//     gst: {
//         type: Number,
//         default: 0
//     },
//     subtotal: {
//         type: Number,
//     },

//     addressId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Address',
//         // required: true
//     },
//     userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     items: [itemsSchema]

// }, { timestamps: true });

// export const Order = mongoose.model('Order', orderSchema);