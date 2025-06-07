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

const editAddress = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        label, street, city,
        state, pinCode
    } = req?.body;

    if (!_id) {
        throw new ApiError(400, "Address Id Required");
    }

    const foundAddress = await Address.findById(_id)

    if (!foundAddress) {
        throw new ApiError(500, "Address not found")
    }

    const updatedAddess = await Address.findByIdAndUpdate(
        _id,
        {
            label, street, city,
            state, pinCode
        },
        { new: true }
    )
        .populate({
            path: "userId",
            select: "-password -refreshToken"
        })
        .exec();

    if (!updatedAddess) {
        throw new ApiError(500, "Something went wrong while updating the address for user")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedAddess, "Address updated successfully")
    )

})

const deleteAddress = asyncHandler(async (req, res) => {
    const { _id } = req.params;

    if (!_id) {
        throw new ApiError(400, "Address Id Required");
    }

    const foundAddress = await Address.findById(_id)

    if (!foundAddress) {
        throw new ApiError(500, "Address not found")
    }

    const deletedAddress = await Address.findByIdAndDelete(_id)
        .populate({
            path: "userId",
            select: "-password -refreshToken"
        })
        .exec();

    if (!deletedAddress) {
        throw new ApiError(500, "Something went wrong while deleting the address for user")
    }

    //Remove Id from user
    const updatedUser = await User.findByIdAndUpdate(
        req?.user?._id,
        {
            $pull: {
                address: deletedAddress?._id
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

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "Address deleted successfully")
    )

})

const getAllAddressByUser = asyncHandler(async (req, res) => {

    // console.log("User", req?.user?._id);
    const userAddresses = await Address.find({ userId: req?.user?._id })
        .populate({
            path: "userId",
            select: "-password -refreshToken"
        })
        .exec();

    if (!userAddresses) {
        throw new ApiError(500, "Something went wrong while fetching the addresses")
    }

    return res.status(200).json(
        new ApiResponse(200, userAddresses, "Address fetched successfully")
    )

})

export {
    createAddress,
    editAddress,
    deleteAddress,
    getAllAddressByUser
}