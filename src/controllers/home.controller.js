import { Home } from "../models/home.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const createHome = asyncHandler(async (req, res) => {
    const { groups, active } = req.body;

    //Validate details
    if (
        !groups && !groups.length
    ) {
        throw new ApiError(400, "Groups not found");
    }

    let banners = [];

    if (Array.isArray(req.files?.banners) && req.files.banners.length > 0) {
        const uploadPromises = req.files.banners.map(async (fl) => {
            const filePath = fl?.path;
            const banner = await uploadOnCloudinary(filePath);
            return banner;
        });

        banners = await Promise.all(uploadPromises); // ✅ Wait for all uploads
        banners = banners?.map(ph => ph?.secure_url);
    }

    console.log(banners);
    // if (!banners || !banners?.length) {
    //     throw new ApiError(400, "Banners are Required");
    // }

    //create new product
    const newHomeLayout = await Home.create({
        active,
        banners,
        groups: groups ? groups : []
    });
    if (!newHomeLayout) {
        throw new ApiError(409, "Could not create home layout");
    }

    const homeLayout = await Home.findById(newHomeLayout?._id)
        .populate('groups')
        .populate({
            path: 'groups',
            populate: {
                path: 'products',
                model: 'Product',
                populate: {
                    path: 'category',
                    model: 'SubCategory'
                }
            }
        })
        .exec();

    //return response
    return res.status(201).json(
        new ApiResponse(201, homeLayout, "Home layout created Successfully")
    )
});

export {
    createHome
}