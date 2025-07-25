import mongoose from "mongoose";
import { Group } from "../models/group.model.js";
import { Product } from "../models/product.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createGroup = asyncHandler(async (req, res) => {
    const {
        name, sequenceNo, active,
        banner, isBannerVisble, isSpecial,
        backgroundColor, isBackgroundColorVisible,
        categories
    } = req.body;

    //Validate details
    if (
        !name
    ) {
        throw new ApiError(400, "Details not found");
    }

    //create new group
    const newGroup = await Group.create({
        name, sequenceNo: sequenceNo || 0, active,
        isBannerVisble, isSpecial,
        backgroundColor, isBackgroundColorVisible,
        banner: banner ? banner : "",
        categories: categories ? categories : []
    });
    if (!newGroup) {
        throw new ApiError(500, "Could not create group");
    }

    //return response
    return res.status(201).json(
        new ApiResponse(201, newGroup, "Group created Successfully")
    )
});

const editGroup = asyncHandler(async (req, res) => {
    const {
        name, sequenceNo, active,
        banner, isBannerVisble, isSpecial,
        backgroundColor, isBackgroundColorVisible,
        categories
    } = req.body;

    //Validate details
    if (
        !req?.params?._id
    ) {
        throw new ApiError(400, "Details not found");
    }

    const foundGroup = await Group.findById(req?.params?._id);
    if (!foundGroup) {
        throw new ApiError(409, `Group not found`);
    }

    //edit group
    const updatedGroup = await Group.findByIdAndUpdate(
        req?.params?._id,
        {
            name: name || foundGroup?.name,
            sequenceNo: sequenceNo ? sequenceNo : foundGroup?.sequenceNo || 0,
            active: active != undefined ? active : foundGroup?.active,
            isBannerVisble: isBannerVisble != undefined ? isBannerVisble : foundGroup?.isBannerVisble,
            isSpecial: isSpecial != undefined ? isSpecial : foundGroup?.isSpecial,
            banner: banner ? banner : foundGroup?.banner,
            categories: categories ? categories : foundGroup?.categories,
            backgroundColor: backgroundColor || foundGroup?.backgroundColor || "",
            isBackgroundColorVisible: isBackgroundColorVisible != undefined ? isBackgroundColorVisible : foundGroup?.isBackgroundColorVisible,
        },
        { new: true }
    );
    if (!updatedGroup) {
        throw new ApiError(500, "Could not edit group");
    }

    //return response
    return res.status(201).json(
        new ApiResponse(201, updatedGroup, "Group edited Successfully")
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

// Controller for bulk updating products in group at group module
const syncGroupProducts = asyncHandler(async (req, res) => {
    const { groupId, products } = req.body;

    /* ------------------------------ 1. validation ----------------------------- */
    if (!groupId || !Array.isArray(products)) {
        throw new ApiError(400, "groupId and productIds[] are required");
    }

    // normalise IDs → ObjectIds & dedupe
    const desired = [
        ...new Set(products?.map(id => new mongoose.Types.ObjectId(id)))
    ];

    /* ------------------------------ 2. look‑ups ------------------------------- */
    const group = await Group.findById(groupId);
    if (!group) throw new ApiError(404, "Group not found");

    const current = group?.products?.map(id => id.toString());

    /* ------------------------------ 3. diff sets ------------------------------ */
    const desiredSet = new Set(desired.map(id => id.toString()));
    const currentSet = new Set(current);

    const productsToAdd = desired.filter(id => !currentSet.has(id.toString()));
    const productsToRemove = current.filter(id => !desiredSet.has(id));

    /* ------------------------ 4. verify product existence --------------------- */
    const count = await Product.countDocuments({ _id: { $in: desired } });
    if (count !== desired.length) {
        throw new ApiError(400, "One or more productIds are invalid");
    }

    /* ----------------------- 5. transactional bulk ops ----------------------- */
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // 5a. update Group
            group.products = desired;          // overwrite to exact list
            await group.save({ session });

            // 5b. add groupId to each new Product
            if (productsToAdd.length) {
                await Product.updateMany(
                    { _id: { $in: productsToAdd } },
                    { $addToSet: { groups: group._id } },
                    { session }
                );
            }

            // 5c. pull groupId from removed Products
            if (productsToRemove.length) {
                await Product.updateMany(
                    { _id: { $in: productsToRemove } },
                    { $pull: { groups: group._id } },
                    { session }
                );
            }
        });
    } finally {
        await session.endSession();
    }

    /* ------------------------------ 6. response ------------------------------- */
    const populatedGroup = await Group.findById(groupId)
        .populate("products")
        .exec();

    return res
        .status(200)
        .json(new ApiResponse(200, populatedGroup, "Group products synced"));
});

const getAllGroups = asyncHandler(async (req, res) => {
    const allGroups = await Group.find({}).populate("products categories").exec();

    if (!allGroups) {
        throw new ApiError(409, "Could not find groups");
    }

    return res.status(200).json(
        new ApiResponse(200, allGroups, "Groups fetched Successfully")
    )
});

const getSpecialGroups = asyncHandler(async (req, res) => {
    const allGroups = await Group.find({ isSpecial: true }).populate("products categories").exec();

    if (!allGroups) {
        throw new ApiError(409, "Could not find groups");
    }

    return res.status(200).json(
        new ApiResponse(200, allGroups, "Groups fetched Successfully")
    )
});

const getGroupsByCategories = asyncHandler(async (req, res) => {

    const { category } = req?.params;
    if (!category) {
        throw new ApiError("Category Id not found");
    }

    const allGroups = await Group.find({
        categories: { $in: category }
    }
    ).populate("products categories").exec();

    if (!allGroups) {
        throw new ApiError(409, "Could not find groups");
    }

    return res.status(200).json(
        new ApiResponse(200, allGroups, "Groups fetched Successfully")
    )
});

export {
    createGroup,
    editGroup,
    addProductInGroup,
    removeProductFromGroup,
    syncGroupProducts,
    getAllGroups,
    getSpecialGroups,
    getGroupsByCategories
}