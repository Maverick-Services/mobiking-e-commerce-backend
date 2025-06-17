import mongoose from "mongoose";

const sellingPriceSchema = new mongoose.Schema({
    price: {
        type: Number,
        required: true
    }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    fullName: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        lowercase: true,
        required: true,
        unique: [true, 'Slug must be unique']
    },
    description: {
        type: String,
        required: true,
    },
    active: {
        type: Boolean,
        default: true
    },
    newArrival: {
        type: Boolean,
        default: false
    },
    liked: {
        type: Boolean,
        default: false
    },
    bestSeller: {
        type: Boolean,
        default: false
    },
    recommended: {
        type: Boolean,
        default: false
    },
    sellingPrice: [sellingPriceSchema],
    gst: {
        type: Number,
        default: 0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
        required: [true, 'Category is required']
    },
    // variant array
    variants: {
        type: Map,
        of: Number,
        default: () => new Map()
    },
    images: [{
        type: String,
    }],
    totalStock: {
        type: Number,
        default: 0
    },
    stock: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
    }],
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],

}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);