import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: [true, "Group name must be unique"]
    },
    sequenceNo: {
        type: Number,
        default: 0
        // required: true,
        // unique: [true, "Sequence number must be unique"]
    },
    banner: {
        type: String,
        // required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    isBannerVisble: {
        type: Boolean,
        default: false
    },
    backgroundColor: {
        type: String
    },
    isBackgroundColorVisible: {
        type: Boolean,
        default: false
    },
    isSpecial: {
        type: Boolean,
        default: false
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    }]
}, { timestamps: true });

export const Group = mongoose.model('Group', groupSchema);