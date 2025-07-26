import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        unique: true
    },
    value: {
        type: String,
    },
    percent: {
        type: String,
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    }
}, { timestamps: true });

export const Coupon = mongoose.model("Coupon", couponSchema);