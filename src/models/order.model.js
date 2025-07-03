import mongoose from "mongoose";
import { itemsSchema } from "./cart.model.js";

const requestSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            "Cancel",
            "Warranty",
            "Return"
        ]
    },
    isRaised: { type: Boolean, default: false },
    raisedAt: { type: String },
    isResolved: { type: Boolean, default: false },
    status: {
        type: String,
        enum: [
            "Pending",
            "Accepted",
            "Rejected"
        ],
        default: "Pending"
    },
    resolvedAt: { type: String },
    reason: { type: String },
}, { timestamps: true }, { _id: false })

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
        reason: { type: String },
        shippingStatus: {
            type: String,
            enum: [
                "Pending",
                "PENDING",
                "Courier Assigned",
                "Pickup Scheduled",
                "In Transit",
                "IN TRANSIT",
                "Shipped",
                "Delivered",
                "CANCELLED",
                "Cancelled"
            ],
            default: "Pending"
        },
        scans: {
            type: mongoose.Schema.Types.Mixed,
            default: []
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

        deliveredAt: String,    // set when status → Delivered
        rtoInitiatedAt: { type: String },   // set when RTO starts
        rtoDeliveredAt: { type: String },   // set when RTO parcel returns

        /****************  PAYMENT FIELDS  *****************/
        razorpayOrderId: String,
        razorpayPaymentId: String,

        /****************  ORDER REQUESTS  *****************/
        requests: [requestSchema],

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
            enum: ["COD", "Online", "UPI", "Cash"],
            default: "COD"
        },
        isAppOrder: {
            type: Boolean,
            default: false
        },
        abondonedOrder: {
            type: Boolean,
            default: false
        },

        /****************  PRICING  *****************/
        orderAmount: { type: Number, required: true },
        deliveryCharge: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        gst: { type: String },
        subtotal: Number,

        /****************  CUSTOMER INFO  *****************/
        name: String,
        email: String,
        phoneNo: String,

        /****************  ADDRESS  *****************/
        address: String,
        address2: String,
        city: String,
        state: String,
        pincode: String,
        country: String,
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

        /****************  QUERIES  *****************/
        query: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Query",
            // required: true
        },

        /************** Product/Itesm Details *******************/
        items: [itemsSchema],
        length: Number,
        breadth: Number,
        height: Number,
        weight: {
            type: Number,
            default: 0.5
        },
    },
    { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);