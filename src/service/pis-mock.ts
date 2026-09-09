import type { definitions } from './pis-gen';

const types = ['physical', 'digital', 'service'] as const;
const defaultImage = '/images/products/default-product-image.png';

export const generateMockProduct = (id: number): definitions['model.GetProductByIdResponse'] => {
	const type = types[id % types.length];
	const name = `Product ${id}`;
	const hasVariants = id % 2 === 0; // Alternate between having variants and not

	const variantACombination = [
		{ key: 'ตัวเลือก', value: '1 ชั่วโมง' },
		{ key: 'ช่าง', value: 'คุณมะนาว' }
	];

	const variantBCombination = [
		{ key: 'ตัวเลือก', value: '1 ชั่วโมง' },
		{ key: 'ช่าง', value: 'คุณมะพร้าว' }
	];

	const variants = hasVariants
		? Array.from({ length: id % 3 }, (_, index) => {
				const isVariantA = index % 2 === 0;
				return {
					id: `variant_${id}_${index + 1}`,
					price: 100 * (index + 1),
					name: isVariantA ? '1 ชั่วโมง/คุณมะนาว' : '1 ชั่วโมง/คุณมะพร้าว',
					variant_combination: isVariantA ? variantACombination : variantBCombination,
					available: true
				};
			})
		: [];

	const images = [
		{ id: `image_${id}_1`, image_url: `/images/ui/Sukidog.png` },
		{ id: `image_${id}_2`, image_url: `/images/ui/Sukidog.png` }
	];

	const price = hasVariants ? undefined : 1000 + id * 10;

	return {
		id: `product_${id}`,
		type: type,
		name: name,
		variant: variants.length > 0 ? variants : undefined,
		images: images,
		price: price
	};
};

export const mockProducts = Array.from({ length: 30 }, (_, index) =>
	generateMockProduct(index + 1)
);
