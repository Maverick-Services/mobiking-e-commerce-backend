import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

const configureCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        configureCloudinary();

        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            folder: process.env.CLOUDINARY_FOLDER_NAME,
            resource_type: "auto"
        })

        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return response;

    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        // remove the locally saved temporary file as the upload operation got failed
        console.log("Response", error);
        return null;
    }
}

const deleteOnCloudinary = async (publicId) => {
    try {
        if (!publicId) return null

        configureCloudinary();

        //destroy the file on cloudinary
        const response = await cloudinary.uploader.destroy(publicId);
        return response;

    } catch (error) {
        console.log("Response", error);
        return null;
    }
}

const getImagesFromCloudinary = async () => {
    try {

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        const response = await cloudinary.search
            .expression(`folder:${process.env.CLOUDINARY_FOLDER_NAME}`)
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();

        let images = null;
        if (response) {
            images = response?.resources?.map((img) => ({
                id: img.asset_id,
                public_id: img.public_id,
                url: img.secure_url,
                format: img.format,
                width: img.width,
                height: img.height,
                size: Math.round(img.bytes / 1024), // size in KB
                created_at: img.created_at,
            }));
        }
        return images;

    } catch (error) {
        console.log("Response", error);
        return null;
    }
}

export { uploadOnCloudinary, deleteOnCloudinary, getImagesFromCloudinary }