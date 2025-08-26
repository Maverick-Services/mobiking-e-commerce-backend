import { Category } from "../models/category.model.js";
import { SubCategory } from "../models/sub_category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

//Parent Ctegory
const createCategory = asyncHandler(async (req, res) => {
    const { name, slug, active, image } = req.body;

    if (!name || !slug) {
        throw new ApiError(400, "Details not found");
    }

    // const imageLocalPath = req.files?.image[0]?.path;

    // if (!imageLocalPath) {
    //     throw new ApiError(400, "Image is required")
    // }
    // const image = await uploadOnCloudinary(imageLocalPath)
    // if (!image) {
    //     throw new ApiError(400, "Image is required")
    // }

    const newCategory = await Category.create({
        name,
        slug,
        image: image ? image : "",
        active
    });

    if (!newCategory) {
        throw new ApiError(409, "Could not create category");
    }

    return res.status(201).json(
        new ApiResponse(201, newCategory, "Category created Successfully")
    )
});

const editCategory = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const { name, slug, active, image } = req.body;

    if (!_id || !name || !slug) {
        throw new ApiError(400, "Details not found");
    }

    const foundCategory = await Category.findById(_id);
    if (!foundCategory) {
        throw new ApiError(409, `Category not found`);
    }

    const updatedCategory = await Category.findByIdAndUpdate(
        { _id },
        {
            name,
            slug,
            active,
            image: image ? image : foundCategory?.image
        },
        { new: true }
    ).populate("subCategories")
        .exec();

    if (!updatedCategory) {
        throw new ApiError(409, "Could not update category");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedCategory, "Category updated Successfully")
    )
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { _id } = req.params;

    if (!_id) {
        throw new ApiError(400, "Details not found");
    }

    const foundCategory = await Category.findById(_id);
    if (!foundCategory) {
        throw new ApiError(409, `Category not found`);
    }

    const deletedCategory = await Category.findByIdAndDelete(_id);

    if (!deletedCategory) {
        throw new ApiError(409, "Could not delete category");
    }

    return res.status(200).json(
        new ApiResponse(200, deletedCategory, "Category deleted Successfully")
    )
});

const getAllCategories = asyncHandler(async (req, res) => {
    const allCategories = await Category.find({}).populate({
        path: "subCategories",
        model: "SubCategory",
        select: "-products"
    }).exec();

    if (!allCategories) {
        throw new ApiError(409, "Could not find categories");
    }

    return res.status(200).json(
        new ApiResponse(200, allCategories, "Categories fetched Successfully")
    )
});

const getCategoryById = asyncHandler(async (req, res) => {
    const completeCatgeoryDetails = await Category.findById(req?.params?._id).populate("subCategories").exec();

    if (!completeCatgeoryDetails) {
        throw new ApiError(409, "Could not fetch category details");
    }

    return res.status(200).json(
        new ApiResponse(200, completeCatgeoryDetails, "Category details fetched Successfully")
    )
});

const getCategoryBySlug = asyncHandler(async (req, res) => {
    const completeCatgeoryDetails = await Category.findOne({
        slug: req?.params?.slug
    }).populate("subCategories").exec();

    if (!completeCatgeoryDetails) {
        throw new ApiError(409, "Could not fetch category details");
    }

    return res.status(200).json(
        new ApiResponse(200, completeCatgeoryDetails, "Category details fetched Successfully")
    )
});


//Sub categories
const createSubCategory = asyncHandler(async (req, res) => {
    const {
        name, slug, active,
        sequenceNo, featured,
        deliveryCharge,
        minOrderAmount,
        minFreeDeliveryOrderAmount,
        categoryId,
        icon,
        theme,
        upperBanner,
        lowerBanner,
        photos, tags
    } = req.body;

    //Todo: Add Images, upper, lower banner in the subcategories

    if (!name || !slug ||
        // !sequenceNo || 
        !categoryId) {
        throw new ApiError(400, "Details not found");
    }

    // Validate parent category Id
    const foundCategory = await Category.findById(categoryId);
    if (!foundCategory) {
        throw new ApiError(409, `Parent category not found`);
    }

    // const upperBannerLocalPath = req.files?.upperBanner[0]?.path;
    // const lowerBannerLocalPath = req.files?.lowerBanner[0]?.path;

    // if (!upperBannerLocalPath || !lowerBannerLocalPath) {
    //     throw new ApiError(400, "Avatar file is required")
    // }

    // const upperBanner = await uploadOnCloudinary(upperBannerLocalPath)
    // const lowerBanner = await uploadOnCloudinary(lowerBannerLocalPath)
    // // console.log(photosLocalPath);

    // let photos = [];

    // if (Array.isArray(req.files?.photos) && req.files.photos.length > 0) {
    //     const uploadPromises = req.files.photos.map(async (fl) => {
    //         const filePath = fl?.path;
    //         const photo = await uploadOnCloudinary(filePath);
    //         return photo;
    //     });

    //     photos = await Promise.all(uploadPromises); // ✅ Wait for all uploads
    //     photos = photos?.map(ph => ph?.secure_url);
    // }

    // if (!upperBanner || !lowerBanner) {
    //     throw new ApiError(400, "Upper and lower banners are required")
    // }

    const newSubCategory = await SubCategory.create({
        name, slug, active,
        sequenceNo: sequenceNo || 0, featured,
        icon,
        theme,
        upperBanner: upperBanner ? upperBanner : "",
        lowerBanner: lowerBanner ? lowerBanner : "",
        photos: photos ? photos : [],
        tags: tags || [],
        deliveryCharge,
        minOrderAmount,
        minFreeDeliveryOrderAmount,
        parentCategory: categoryId
    });

    if (!newSubCategory) {
        throw new ApiError(409, "Could not create sub category");
    }

    //add the subCategory in parent category
    const updatedCategory = await Category.findByIdAndUpdate(
        { _id: categoryId },
        {
            $push: {
                subCategories: newSubCategory?._id
            }
        },
        { new: true }
    ).populate("subCategories").exec();
    console.log("Parent Category: ", updatedCategory);

    return res.status(201).json(
        new ApiResponse(201, newSubCategory, "Sub category created Successfully")
    )
});

const editSubCategory = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        name, slug, active,
        sequenceNo, featured,
        deliveryCharge,
        minOrderAmount,
        minFreeDeliveryOrderAmount,
        categoryId,
        icon,
        theme,
        upperBanner,
        lowerBanner,
        photos,
        tags
    } = req.body;

    //Todo: Add Images, upper, lower banner in the subcategories

    if (!_id || !name || !slug ||
        // !sequenceNo || 
        !categoryId) {
        throw new ApiError(400, "Details not found");
    }

    // Validate parent category Id
    const foundCategory = await Category.findById(categoryId);
    if (!foundCategory) {
        throw new ApiError(409, `Parent category not found`);
    }

    // Validate sub category Id
    const foundSubCategory = await SubCategory.findById(_id);
    if (!foundSubCategory) {
        throw new ApiError(409, `Sub category not found`);
    }

    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
        { _id },
        {
            name, slug, active,
            sequenceNo: sequenceNo || foundSubCategory?.sequenceNo || 0,
            featured,
            deliveryCharge,
            minOrderAmount,
            minFreeDeliveryOrderAmount,
            parentCategory: categoryId,
            icon: icon ? icon : foundSubCategory?.icon,
            theme: theme || foundSubCategory?.theme || "",
            upperBanner: upperBanner ? upperBanner : foundSubCategory?.upperBanner,
            lowerBanner: lowerBanner ? lowerBanner : foundSubCategory?.lowerBanner,
            photos: photos ? photos : foundSubCategory?.photos,
            tags: tags ? tags : foundSubCategory?.tags,
        },
        { new: true }
    ).populate("parentCategory products").exec();
    if (!updatedSubCategory) {
        throw new ApiError(409, "Could not update sub category");
    }

    // update parent category
    if (foundSubCategory?.parentCategory !== updatedSubCategory?.parentCategory) {
        //Remove subCategory in old parent category
        const oldCategory = await Category.findByIdAndUpdate(
            { _id: foundSubCategory?.parentCategory },
            {
                $pull: {
                    subCategories: foundSubCategory?._id
                }
            },
            { new: true }
        ).populate("subCategories").exec();
        console.log("Old Parent Category: ", oldCategory);

        //add the subCategory in new parent category
        const newCategory = await Category.findByIdAndUpdate(
            { _id: updatedSubCategory?.parentCategory?._id },
            {
                $push: {
                    subCategories: updatedSubCategory?._id
                }
            },
            { new: true }
        ).populate("subCategories").exec();
        console.log("New Parent Category: ", newCategory);
    }

    return res.status(200).json(
        new ApiResponse(200, updatedSubCategory, "Sub Category updated Successfully")
    )
});

const updateSubCategoryStatus = asyncHandler(async (req, res) => {
    const { _id } = req.params;
    const {
        active,
    } = req.body;

    //Todo: Add Images, upper, lower banner in the subcategories

    if (!_id) {
        throw new ApiError(400, "Details not found");
    }

    // Validate sub category Id
    const foundSubCategory = await SubCategory.findById(_id);
    if (!foundSubCategory) {
        throw new ApiError(409, `Sub category not found`);
    }

    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
        { _id },
        {
            active: active != undefined ? active : foundSubCategory?.active
        },
        { new: true }
    ).populate("parentCategory products").exec();
    if (!updatedSubCategory) {
        throw new ApiError(409, "Could not update sub category");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedSubCategory, "Sub Category updated Successfully")
    )
});

const deleteSubCategory = asyncHandler(async (req, res) => {
    const { _id } = req.params;

    //Todo: Add Images, upper, lower banner in the subcategories

    if (!_id) {
        throw new ApiError(400, "Details not found");
    }

    // Validate sub category Id
    const foundSubCategory = await SubCategory.findById(_id);
    if (!foundSubCategory) {
        throw new ApiError(409, `Sub category not found`);
    }

    const deletedSubCategory = await SubCategory.findByIdAndDelete(_id).populate("parentCategory products").exec();
    if (!deletedSubCategory) {
        throw new ApiError(409, "Could not delete sub category");
    }
    // console.log("Sub Category: ", deletedSubCategory);

    //delete the subCategory in parent category
    const updatedCategory = await Category.findByIdAndUpdate(
        { _id: deletedSubCategory?.parentCategory?._id },
        {
            $pull: {
                subCategories: deletedSubCategory?._id
            }
        },
        { new: true }
    ).populate("subCategories").exec();
    console.log("Parent Category: ", updatedCategory);

    return res.status(200).json(
        new ApiResponse(200, deleteSubCategory, "Sub Category deleted Successfully")
    )
});

const getAllSubCategories = asyncHandler(async (req, res) => {
    const allSubCategories = await SubCategory.find({})
        .populate({
            path: "parentCategory",
            model: "Category",
        })
        .populate({
            path: "products",
            model: "Product",
            // select: "-"
        }).exec();

    if (!allSubCategories) {
        throw new ApiError(409, "Could not find sub categories");
    }

    return res.status(200).json(
        new ApiResponse(200, allSubCategories, "Sub Categories fetched Successfully")
    )
});

const getAllFeaturedSubCategories = asyncHandler(async (req, res) => {
    const allFeaturedSubCategories = await SubCategory.find({
        featured: true
    }).populate("parentCategory products").exec();

    if (!allFeaturedSubCategories) {
        throw new ApiError(409, "Could not find featured sub categories");
    }

    return res.status(200).json(
        new ApiResponse(200, allFeaturedSubCategories, "Featured Sub Categories fetched Successfully")
    )
});

const getSubCategoryById = asyncHandler(async (req, res) => {
    const completeSubCategoryDetails = await SubCategory.findById(req.params._id).populate("parentCategory").populate("products").exec();

    if (!completeSubCategoryDetails) {
        throw new ApiError(409, "Could not fetch sub category details");
    }

    return res.status(200).json(
        new ApiResponse(200, completeSubCategoryDetails, "Sub Category details fetched Successfully")
    )
});

const getSubCategoryBySlug = asyncHandler(async (req, res) => {
    const completeSubCategoryDetails = await SubCategory.findOne({
        slug: req.params.slug
    }).populate("parentCategory").populate("products").exec();

    if (!completeSubCategoryDetails) {
        throw new ApiError(409, "Could not fetch sub category details");
    }

    return res.status(200).json(
        new ApiResponse(200, completeSubCategoryDetails, "Sub Category details fetched Successfully")
    )
});


export {
    createCategory,
    editCategory,
    updateSubCategoryStatus,
    deleteCategory,
    getAllCategories,
    getCategoryById,
    getCategoryBySlug,
    createSubCategory,
    editSubCategory,
    deleteSubCategory,
    getAllSubCategories,
    getAllFeaturedSubCategories,
    getSubCategoryById,
    getSubCategoryBySlug
}