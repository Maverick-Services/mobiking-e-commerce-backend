import mongoose from 'mongoose';

export const homeSchema = new mongoose.Schema({
    banners: [{
        type: String,
    }],
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],
}, { timestamps: true });
