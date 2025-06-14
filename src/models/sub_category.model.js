import mongoose from "mongoose";

const subCatgeorySchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: [true, "Name already exist"]
    },
    slug: {
        type: String,
        lowercase: true,
        required: true,
        unique: [true, "Slug already exist"]
    },
    sequenceNo: {
        type: Number,
        required: [true, "Sequence Number already exist"],
        unique: [true, "Sequence Number must be Unique"]
    },
    upperBanner: {
        type: String,
        // keep it required - commented temporarily
        // required: [true, "Upper Banner already exist"]
    },
    lowerBanner: {
        type: String,
        // keep it required - commented temporarily
        // required: [true, "Lower Banner already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    deliveryCharge: {
        type: Number,
    },
    minOrderAmount: {
        type: Number,
    },
    minFreeDeliveryOrderAmount: {
        type: Number,
    },
    photos: [{
        type: String,
    }],
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    }]
}, { timestamps: true });

export const SubCategory = mongoose.model('SubCategory', subCatgeorySchema);