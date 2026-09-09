export type UsbPriner = {
	name: string;
	vendorId?: number;
	productId?: number;
	configurationValue?: number;
	interfaceNumber?: number;
	endpointNumber?: number;
};

export const supportedPrinter: UsbPriner[] = [
	// 1fc9:2016 NXP Semiconductors Printer-80
	// {
	// 	name: 'EasyPrint ES-8803WA',
	// 	vendorId: 0x1fc9,
	// 	productId: 0x2016,
	// 	configurationValue: 1,
	// 	interfaceNumber: 0,
	// 	endpointNumber: 2
	// }
	// Remove this on production
	{
		name: 'All devices'
	}
];
