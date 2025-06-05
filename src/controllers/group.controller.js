import { Group } from "../models/group.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createGroup = asyncHandler(async (req, res) => {
    const {
        name, sequenceNo, active,
        banner, isBannerVisble, isSpecial
    } = req.body;

    //Validate details
    if (
        !name || !sequenceNo
    ) {
        throw new ApiError(400, "Details not found");
    }

    //create new product
    const newGroup = await Group.create({
        name, sequenceNo, active,
        isBannerVisble, isSpecial,
        banner: banner ? banner : ""
    });
    if (!newGroup) {
        throw new ApiError(500, "Could not create group");
    }

    //return response
    return res.status(201).json(
        new ApiResponse(201, newGroup, "Group created Successfully")
    )
});

const addProductInGroup = asyncHandler(async (req, res) => {
    const {
        productId, groupId
    } = req.body;

    //Validate details
    if (
        !productId || !groupId
    ) {
        throw new ApiError(400, "Details not found");
    }

    //Check if group and product exist
    const foundGroup = await Group.findById(groupId);
    if (!foundGroup) {
        throw new ApiError(409, `Group not found`);
    }

    const foundProduct = await Product.findById(productId);
    if (!foundProduct) {
        throw new ApiError(409, `Product not found`);
    }

    //check if product is already there in group
    if (foundProduct?.groups.some(gr => gr == groupId)) {
        throw new ApiError(409, `Product already present in group`);
    }

    //add product in group
    const updatedGroup = await Group.findByIdAndUpdate(
        groupId,
        {
            $push: {
                products: foundProduct?._id
            }
        },
        { new: true }
    ).populate("products").exec();
    if (!updatedGroup) {
        throw new ApiError(500, `Could not update group`);
    }

    //add group Id in product
    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
            $push: {
                groups: foundGroup?._id
            }
        },
        { new: true }
    ).populate("groups").exec(); //populate orders also
    if (!updatedProduct) {
        throw new ApiError(500, `Could not update group id in product`);
    }

    //return response
    return res.status(200).json(
        new ApiResponse(200, updatedGroup, "Product added in group successfully")
    )
});

const removeProductFromGroup = asyncHandler(async (req, res) => {
    const {
        productId, groupId
    } = req.body;

    //Validate details
    if (
        !productId || !groupId
    ) {
        throw new ApiError(400, "Details not found");
    }

    //Check if group and product exist
    const foundGroup = await Group.findById(groupId);
    if (!foundGroup) {
        throw new ApiError(409, `Group not found`);
    }

    const foundProduct = await Product.findById(productId);
    if (!foundProduct) {
        throw new ApiError(409, `Product not found`);
    }

    //check if product is already removed from group
    if (!foundProduct?.groups.some(gr => gr == groupId)) {
        throw new ApiError(409, `Product is not present in group`);
    }

    //add product in group
    const updatedGroup = await Group.findByIdAndUpdate(
        groupId,
        {
            $pull: {
                products: foundProduct?._id
            }
        },
        { new: true }
    ).populate("products").exec();
    if (!updatedGroup) {
        throw new ApiError(500, `Could not update group`);
    }

    //add group Id in product
    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
            $pull: {
                groups: foundGroup?._id
            }
        },
        { new: true }
    ).populate("groups").exec(); //populate orders also
    if (!updatedProduct) {
        throw new ApiError(500, `Could not update group id in product`);
    }

    //return response
    return res.status(200).json(
        new ApiResponse(200, updatedGroup, "Product removed from group successfully")
    )
});

export {
    createGroup,
    addProductInGroup,
    removeProductFromGroup
}