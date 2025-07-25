import { Home } from "../models/home.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const createHome = asyncHandler(async (req, res) => {
    let {
        categories,
        groups,
        active,
        banners
    } = req.body;

    if (
        !groups && !groups?.length
    ) {
        throw new ApiError(400, "Groups not found");
    }

    if (
        !categories && !categories?.length
    ) {
        throw new ApiError(400, "Categories not found");
    }

    //create new Home
    const newHomeLayout = await Home.create({
        active,
        banners: banners ? banners : []
    });
    if (!newHomeLayout) {
        throw new ApiError(409, "Could not create home layout");
    }

    const homeLayout = await Home.findByIdAndUpdate(
        newHomeLayout?._id,
        {
            $push: {
                groups: groups,
                categories: categories
            }
        },
        { new: true }
    )
        .populate('groups')
        .populate([
            {
                path: 'groups',
                populate: {
                    path: 'products',
                    model: 'Product',
                    populate: {
                        path: 'category',
                        model: 'SubCategory'
                    }
                }
            },
            {
                path: 'categories',
                model: 'SubCategory'
            }
        ])
        .populate("categories")
        .exec();

    //return response
    return res.status(201).json(
        new ApiResponse(201, homeLayout, "Home layout created Successfully")
    )
});

const editHomeLayout = asyncHandler(async (req, res) => {
    let {
        categories,
        groups,
        active,
        banners
    } = req.body;

    const homeId = req.params?._id;

    if (
        !homeId
    ) {
        throw new ApiError(400, "Home Layout Id not found");
    }

    // if (
    //     groups && !groups?.length
    // ) {
    //     throw new ApiError(400, "No groups sent");
    // }

    // if (
    //     categories && !categories?.length
    // ) {
    //     throw new ApiError(400, "No categories sent");
    // }

    // if (
    //     !categories && !categories?.length
    // ) {
    //     throw new ApiError(400, "Categories not found");
    // }

    // check if home layout exist
    const foundHomeLayout = await Home.findById(homeId)

    if (!foundHomeLayout) {
        throw new ApiError(400, "Home Layout does not exit");
    }

    //create new Home
    const updatedHomeLayout = await Home.findByIdAndUpdate(
        homeId,
        {
            active: active ? active : foundHomeLayout?.active,
            banners: banners ? banners : foundHomeLayout?.banners,
            groups: groups || foundHomeLayout?.groups || [],
            categories: categories || foundHomeLayout?.categories || []
        },
        { new: true }
    )
        .populate('groups')
        .populate([
            {
                path: 'groups',
                populate: {
                    path: 'products',
                    model: 'Product',
                    populate: {
                        path: 'category',
                        model: 'SubCategory'
                    }
                }
            },
            {
                path: 'categories',
                model: 'SubCategory'
            }
        ])
        .populate("categories")
        .exec();

    if (!updatedHomeLayout) {
        throw new ApiError(409, "Could not update home layout");
    }

    //return response
    return res.status(200).json(
        new ApiResponse(200, updatedHomeLayout, "Home layout updated Successfully")
    )
});

const getHomeLayout = asyncHandler(async (req, res) => {
    const latestLayout = await Home.findOne({
        active: true
    }).sort({ createdAt: -1 })
        .populate('groups')
        .populate([
            {
                path: 'groups',
                populate: {
                    path: 'products',
                    model: 'Product',
                    populate: {
                        path: 'category',
                        model: 'SubCategory'
                    }
                }
            },
            {
                path: 'categories',
                model: 'SubCategory'
            }
        ])
        .populate("categories")
        .exec();

    if (!latestLayout) {
        throw new ApiError(400, "No layout Found");
    }

    return res.status(200).json(
        new ApiResponse(200, latestLayout, "Home Layout fetched successfully")
    );
})

const getAllHomeLayout = asyncHandler(async (req, res) => {
    const allLayouts = await Home.find({}).sort({ createdAt: -1 })
        .populate('groups')
        .populate([
            {
                path: 'groups',
                populate: {
                    path: 'products',
                    model: 'Product',
                    populate: {
                        path: 'category',
                        model: 'SubCategory'
                    }
                }
            },
            {
                path: 'categories',
                model: 'SubCategory'
            }
        ])
        .populate("categories")
        .exec();

    if (!allLayouts) {
        throw new ApiError(400, "No layouts Found");
    }

    return res.status(200).json(
        new ApiResponse(200, allLayouts, "Home Layouts fetched successfully")
    );
})

export {
    createHome,
    editHomeLayout,
    getHomeLayout,
    getAllHomeLayout
}