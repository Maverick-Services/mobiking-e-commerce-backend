import mongoose from 'mongoose';

const homeSchema = new mongoose.Schema({
    active: {
        type: Boolean,
        default: true
    },
    banners: [{
        type: String,
        required: true
    }],
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
    }],
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],
}, { timestamps: true });

export const Home = mongoose.model('Home', homeSchema);