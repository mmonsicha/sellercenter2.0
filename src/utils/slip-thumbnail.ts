const THUMBNAIL_MAX_DIMENSION = 480;
const THUMBNAIL_JPEG_QUALITY = 0.85;

export async function createThumbnailFile(file: File): Promise<File> {
	const imageUrl = URL.createObjectURL(file);

	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Unable to load slip image'));
			img.src = imageUrl;
		});

		const scale = Math.min(1, THUMBNAIL_MAX_DIMENSION / Math.max(image.width, image.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(image.width * scale));
		canvas.height = Math.max(1, Math.round(image.height * scale));

		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Unable to prepare thumbnail context');
		}

		context.drawImage(image, 0, 0, canvas.width, canvas.height);

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(value) => {
					if (value) {
						resolve(value);
						return;
					}

					reject(new Error('Unable to create thumbnail blob'));
				},
				'image/jpeg',
				THUMBNAIL_JPEG_QUALITY
			);
		});

		const baseName = file.name.replace(/\.[^.]+$/, '');
		return new File([blob], `${baseName}-thumbnail.jpg`, {
			type: 'image/jpeg'
		});
	} finally {
		URL.revokeObjectURL(imageUrl);
	}
}
