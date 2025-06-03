import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

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
import multer from "multer"
import { ApiError } from "./utils/ApiError.js"
// import healthcheckRouter from "./routes/healthcheck.routes.js"
// import tweetRouter from "./routes/tweet.routes.js"
// import subscriptionRouter from "./routes/subscription.routes.js"
// import videoRouter from "./routes/video.routes.js"
// import commentRouter from "./routes/comment.routes.js"
// import likeRouter from "./routes/like.routes.js"
// import playlistRouter from "./routes/playlist.routes.js"
// import dashboardRouter from "./routes/dashboard.routes.js"

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/categories", categoryRouter)
app.use("/api/v1/products", productRouter)
app.use("/api/v1/groups", groupRouter)
app.use("/api/v1/home", homeRouter)
// app.use("/api/v1/healthcheck", healthcheckRouter)
// app.use("/api/v1/tweets", tweetRouter)
// app.use("/api/v1/subscriptions", subscriptionRouter)
// app.use("/api/v1/videos", videoRouter)
// app.use("/api/v1/comments", commentRouter)
// app.use("/api/v1/likes", likeRouter)
// app.use("/api/v1/playlist", playlistRouter)
// app.use("/api/v1/dashboard", dashboardRouter)

// http://localhost:8000/api/v1/users/register

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Your server is up and running...."
    });
});

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