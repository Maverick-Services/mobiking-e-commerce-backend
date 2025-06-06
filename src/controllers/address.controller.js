import { Address } from "../models/address.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createAddress = asyncHandler(async (req, res) => {
    const {
        label, street, city,
        state, pinCode
    } = req.body

    if (
        [label, street, city, state, pinCode].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const newAddress = await Address.create({
        userId: req?.user?._id,
        label, street, city,
        state, pinCode
    })

    if (!newAddress) {
        throw new ApiError(500, "Something went wrong while creating the address")
    }

    const updatedUser = await User.findByIdAndUpdate(
        req?.user?._id,
        {
            $push: {
                address: newAddress?._id
            }
        },
        { new: true }
    )
        .select("-password -refreshToken")
        .populate({
            path: "cart",
            populate: {
                path: "items.productId",
                model: "Product"
            }
        })
        .populate("wishlist")
        .populate("address")
        .exec();

    if (!updatedUser) {
        throw new ApiError(500, "Something went wrong while adding the address for user")
    }

    return res.status(201).json(
        new ApiResponse(201, updatedUser, "Address added successfully")
    )

})

export {
    createAddress
}