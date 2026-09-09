import type { SaleVariant } from '$lib/entities/sale/sale';
import type { TCartOptions } from '$stores/cart';

export type tVrtCmb = {
	key: string;
	value: string[];
};

export type opts = {
	id?: string;
	value: string;
	label: string;
};

export function seperateVariantCombination(variant: SaleVariant[]): tVrtCmb[] {
	const newData: tVrtCmb[] = [];

	// Iterate through each variant combination
	variant.forEach((product) => {
		product.variant_combination?.forEach((v) => {
			const existingKey = newData.find((item) => item.key === v.key);

			if (v.value && v.key) {
				if (existingKey) {
					// Create a Set to check for duplicates in the existing value array
					const uniqueValues = new Set(existingKey.value);
					if (!uniqueValues.has(v.value)) {
						uniqueValues.add(v.value);
						existingKey.value = Array.from(uniqueValues); // Convert Set back to array
					}
				} else {
					newData.push({ key: v.key, value: [v.value] });
				}
			}
		});
	});
	return newData;
}

export function generateRadioOptions(vrt: tVrtCmb): opts[] {
	return vrt.value.map((v, idx) => ({
		id: `${idx}`,
		label: v,
		value: v
	}));
}

export function getVariantPrice(vName: string, variant: SaleVariant[]): number {
	const result = variant.find((v) => v.name === vName);
	if (result) return result.price;
	return 0;
}

export function getVariantImage(vName: string, variant: SaleVariant[]): string | undefined {
	const result = variant.find((v) => v.name === vName);
	return result?.image ? result.image : undefined;
}

export function getVariantSku(vName: string, variant: SaleVariant[]): string | undefined {
	const result = variant.find((v) => v.name === vName);
	return result?.sku ? result.sku : undefined;
}

export function combinedValues(c: TCartOptions[]): string {
	const combinedValues = c.reduce((acc, current) => {
		return acc ? `${acc}/${current.value}` : current.value;
	}, '');

	return combinedValues;
}
