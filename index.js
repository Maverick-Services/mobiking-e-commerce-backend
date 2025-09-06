import { app, connectDB } from "./src/index.js";

let isConnected = false;

export default async function handler(req, res) {
    if (!isConnected) {
        await connectDB();
        isConnected = true;
    }
    return app(req, res);
}

// import './src/index.js';