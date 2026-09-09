import type {
	SaleCustomerInput,
	SalePrice,
	SaleProduct,
	SaleVariant
} from '$lib/entities/sale/sale';
import type { definitions } from './pis-gen';

const defaultImage = '/images/products/default-product-image.png';

export const toSale = (p: definitions['model.GetProductByIdResponse']): SaleProduct => {
	return {
		type: p.type ?? '',
		product_id: p.id ?? '',
		code: p.code ?? '',
		label: p.name ?? '',
		price: p.price ? { min: p.price, max: 0 } : minMaxPrice(p.variant ?? []),
		variant: toVariant(p.variant ?? []),
		image: toImage(p.images ?? []),
		customerInput: toCustomerInput(p.customer_inputs)
	};
};

const toCustomerInput = (cInputs?: any[]): SaleCustomerInput[] => {
	var c: SaleCustomerInput[] = [];
	if (cInputs) {
		cInputs.map((i) => {
			c.push({
				required: i.required,
				isLimit: i.isLimit,
				limit: i.limit,
				type: i.type,
				label: i.label
			});
		});
	}

	return c;
};

const toVariant = (variants: definitions['model.CreateProductVariantRequest'][]): SaleVariant[] => {
	const sVariant: SaleVariant[] = variants.map((v) => ({
		id: v.id ?? '',
		image: toImage(v.images ?? []),
		name: v.name ?? '',
		sku: v.sku ?? '',
		price: v.price ?? 0,
		variant_combination: v.variant_combination ?? []
	}));
	return sVariant;
};

const toImage = (images: definitions['model.CreateProductImageRequest'][]): string => {
	return (images && images.length > 0 ? images[0].image_url : defaultImage) ?? defaultImage;
};

const minMaxPrice = (variants: definitions['model.CreateProductVariantRequest'][]): SalePrice => {
	if (variants.length === 0) {
		return { min: 0, max: 0 };
	}

	let minPrice = variants[0].price ?? 0;
	let maxPrice = variants[0].price ?? 0;

	for (const variant of variants) {
		if (variant.price !== undefined) {
			if (variant.price < minPrice) {
				minPrice = variant.price;
			}
			if (variant.price > maxPrice) {
				maxPrice = variant.price;
			}
		}
	}

	return { min: minPrice, max: maxPrice };
};
