import mongoose from "mongoose";

const stockSchema = new mongoose.Schema({
    variantName: {
        type: String,
        required: true,
    },
    purchasePrice: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    }
}, { timestamps: true });

export const Stock = mongoose.model('Stock', stockSchema);