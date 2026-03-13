// server/src/services/cloudinaryService.js
// Cloudinary upload and delete operations

const { cloudinary } = require('../config/cloudinary');

const uploadFile = async (filePath, folder = 'vibely/messages', resourceType = 'auto') => {
    try {
        // Determine resource type
        // Just upload as 'auto' and let Cloudinary decide, or inspect file extension?
        // Better to let Cloudinary auto-detect for image/video, but force 'raw' for others if needed.
        // For simplicity, we can try 'auto' which handles image/video well. 
        // For documents (pdf, doc, etc), we might need 'raw'.

        const result = await cloudinary.uploader.upload(filePath, {
            folder,
            resource_type: resourceType, // Detects image/video/raw OR uses explicit type
            // Transformations mainly apply to images/videos
            transformation: [
                { quality: 'auto', fetch_format: 'auto' }, // Compression
            ],
            // Use original filename for raw files
            use_filename: true,
            unique_filename: true,
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
            originalName: result.original_filename
        };
    } catch (error) {
        // If 'auto' fails for some raw files, try explicitly 'raw'
        try {
            const result = await cloudinary.uploader.upload(filePath, {
                folder,
                resource_type: 'raw',
                use_filename: true,
                unique_filename: true,
            });
            return {
                url: result.secure_url,
                publicId: result.public_id,
                resourceType: 'raw',
                format: result.format || result.original_filename.split('.').pop(),
                bytes: result.bytes,
                originalName: result.original_filename
            };
        } catch (retryError) {
            console.error('Cloudinary upload error:', retryError.message);
            throw new Error('Failed to upload file');
        }
    }
};

const uploadAvatar = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'vibely/avatars',
            resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'face' },
                { quality: 'auto', fetch_format: 'auto' },
            ],
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
        };
    } catch (error) {
        console.error('Cloudinary avatar upload error:', error.message);
        throw new Error('Failed to upload avatar');
    }
};

const deleteImage = async (publicId, resourceType = 'image') => {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
        console.error('Cloudinary delete error:', error.message);
    }
};

module.exports = { uploadFile, uploadAvatar, deleteImage };
