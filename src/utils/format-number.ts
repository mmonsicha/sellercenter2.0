const options = {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
};

export function formatPriceWithBath(pMin: number, pMax?: number): string {
	var sPrice: string = `฿${pMin.toLocaleString('en-US', options)}`;

	if (pMax && pMin !== pMax) {
		sPrice += `-${pMax.toLocaleString('en-US', options)}`;
	}
	return sPrice;
}

export function formatPrice(price: number): string {
	return price.toLocaleString('en-US', options);
}

export function formatAbbreviatedNumber(value: number): string {
	if (value >= 1000000) {
		return (value / 1000000).toFixed(1) + 'M';
	} else if (value >= 1000) {
		return (value / 1000).toFixed(1) + 'K';
	} else {
		return value.toString();
	}
}
