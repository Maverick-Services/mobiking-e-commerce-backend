import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import multer from "multer"
import { ApiError } from "./utils/ApiError.js"

const app = express()

app.use(cors(
    // {
    //     origin: process.env.CORS_ORIGIN,
    //     credentials: true
    // }
))

// app.use(express.json({ limit: "16kb" }))
// app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())


//routes import
import userRouter from './routes/user.routes.js'
import categoryRouter from './routes/category.routes.js'
import productRouter from './routes/product.routes.js'
import groupRouter from './routes/group.routes.js'
import homeRouter from './routes/home.routes.js'
import cartRouter from './routes/cart.routes.js'
import mediaRouter from './routes/media.routes.js'
import orderRouter from './routes/order.routes.js'
// import { startAbandonedCartScheduler } from './scheduler/abandonedCart.scheduler.js';

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/categories", categoryRouter)
app.use("/api/v1/products", productRouter)
app.use("/api/v1/groups", groupRouter)
app.use("/api/v1/home", homeRouter)
app.use("/api/v1/cart", cartRouter)
app.use("/api/v1/media", mediaRouter)
app.use("/api/v1/orders", orderRouter)

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Your server is up and running...."
    });
});

// startAbandonedCartScheduler();

// Global error handler
app.use((err, req, res, next) => {
    // logger.error(err);
    console.log(err);
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        return res
            .status(400)
            .json({ message: "Multer error", error: err.message });
    }
    if (err.message && err.message.toLowerCase().includes("cloudinary")) {
        // Cloudinary-specific errors
        return res
            .status(500)
            .json({ message: "Cloudinary error", error: err.message });
    }
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            status: err.statusCode,
            message: err.message,
            errors: err.errors || [],
            success: false,
        });
    }

    return res.status(500).json({
        status: 500,
        message: err.message || "Internal Server Error",
        success: false,
    });
});

export { app }