import mongoose from 'mongoose';

const homeSchema = new mongoose.Schema({
    banners: [{
        type: String,
        required: true
    }],
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],
}, { timestamps: true });

export const Home = mongoose.model('Home', homeSchema);