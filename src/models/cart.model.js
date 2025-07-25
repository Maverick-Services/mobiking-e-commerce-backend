import mongoose from 'mongoose';

export const itemsSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    fullName: {
        type: String,
    },
    basePrice: {
        type: String,
    },
    variantName: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    price: {
        type: Number,
        required: true
    }
}, { _id: false }, { timestamps: true });

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    totalCartValue: {
        type: Number,
        required: true,
        default: 0
    },
    items: [itemsSchema]
}, { timestamps: true });

export const Cart = mongoose.model('Cart', cartSchema);