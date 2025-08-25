import { Counter } from "../models/counter.model.js";

const initCounter = async () => {
    const exists = await Counter.findById("orderId");
    if (!exists) {
        await Counter.create({ _id: "orderId", seq: 80000 });
        console.log("✅ Counter initialized at 80000");
    } else {
        console.log("ℹ️ Counter already exists at:", exists.seq);
    }
};

export {
    initCounter
}