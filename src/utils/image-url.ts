export const getImageUrl = (path: string | undefined): string => {
	let defaultImage = '/images/products/default-product-image.png';
	if (!path) return defaultImage; // if no path, return default image
	if (path.startsWith('/images/')) return path; // Local asset
	if (path.startsWith('https')) return path; // Already a full URL

	const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL;
	if (!baseUrl) return defaultImage; // if no base URL, return default image

	return `${baseUrl}${path}`;
};
