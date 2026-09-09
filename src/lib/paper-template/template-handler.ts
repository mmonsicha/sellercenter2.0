import orderReceiptTemplate from '$lib/paper-template/order-receipt.json';
import { renderTemplatePDFs } from 'sellsuki-paper-template-renderer';

export async function previewOrderReceipt(order: any) {
	const pdfByte = await renderTemplatePDFs(orderReceiptTemplate as any, [order]);
	var url = window.URL.createObjectURL(
		new Blob([new Uint8Array(pdfByte)], { type: 'application/pdf' })
	);
	window.open(url, '_blank');
}

export function makeOrderReceiptData(
	order: any,
	email?: string,
	logo?: string,
	storeCode?: string
) {
	if (order.seller) {
		order.seller.email = email;
		order.seller.logo = logo;
		order.seller.storeCode = storeCode;
		order.seller.vatThreshold = 7; // fix vat 7%
	}

	if (order.deliveries && order.deliveries.length > 0) {
		order.shippingFee = order.deliveries.reduce((sum: number, d: any) => sum + d.shippingFee, 0);
	} else {
		order.shippingFee = 0;
	}

	order.totalItems = order.items.length;
	order.totalQty = order.items.reduce((sum: number, cItem: any) => sum + cItem.qty, 0);
	return order;
}
