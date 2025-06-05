import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteOnCloudinary, getImagesFromCloudinary } from "../utils/cloudinary.js";

export const addImage = asyncHandler(async (req) => {
    try {
        const { image } = req.body;

        if (!image) {
            return ApiError(400, "Image is required");
        }

        const uploadResponse = await uploadOnCloudinary(image);

        console.log("Cloudinary Response:", uploadResponse);

        return ApiResponse(200, { imageURL: uploadResponse.secure_url }, "Image Uploaded Successfully");
    } catch (error) {
        return ApiError(500, "Could not upload Image");
    }
})

export const deleteImage = asyncHandler(async (req) => {
    try {
        const { publicId } = req.body;

        if (!publicId) {
            return ApiError(400, "Public Id is required");
        }

        const result = await deleteOnCloudinary(publicId);
        if (!result) {
            throw new ApiError(500, 'Someting went wrong while deleting image');
        }

        return ApiResponse(200, "Image deleted Successfully");
    } catch (error) {
        return ApiError(500, "Could not delete Image");
    }
})

export const getImages = asyncHandler(async (req) => {
    try {

        const result = await getImagesFromCloudinary();
        if (!result) {
            throw new ApiError(500, 'Someting went wrong while fetching images');
        }

        return ApiResponse(200, "Images fetched Successfully");
    } catch (error) {
        return ApiError(500, "Could not fetch images");
    }
})
