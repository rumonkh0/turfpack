import cloudinary from '../config/cloudinary.js';

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  if (String(publicId).startsWith('local:')) return;
  
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary deletion result for ${publicId}:`, result);
    return result;
  } catch (error) {
    console.error(`Cloudinary deletion failed for ${publicId}:`, error);
    throw error;
  }
};
