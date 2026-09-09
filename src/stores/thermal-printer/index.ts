import {
	convertPdfToEscpos,
	generateCutCommand,
	listConnectedDevices,
	openDevice,
	PAPER_WIDTHS,
	renderTemplatePDFs,
	requestDevice
} from 'sellsuki-paper-template-renderer';
import { get, writable } from 'svelte/store';
import { supportedPrinter, type UsbPriner } from './printers';
import { templateMap } from './template';

const LOCALSTORAGE_KEY = 'thermal-printer-config';

export type PairedPrinter = {
	name: string;
	serial?: string;
	productId?: number;
	vendorId?: number;
	default: boolean;
	printerInfo?: UsbPriner;
	pageSize: keyof typeof PAPER_WIDTHS;
	templateName: keyof typeof templateMap;
	online: boolean;
};

export type PrinterConfig = {
	autoPrint: boolean;
	pairedPrinters: PairedPrinter[];
};

export const printerConfig = writable<PrinterConfig>({
	autoPrint: false,
	pairedPrinters: []
});

export const getDefaultOnlinePrinter = () => {
	const pCfg = get(printerConfig);
	return pCfg.pairedPrinters.find((p) => p.default && p.online);
};

export const getAnotherOnlinePrinter = () => {
	const pCfg = get(printerConfig);
	return pCfg.pairedPrinters.find((p) => !p.default && p.online);
};

export const matchDevice = (printers: PairedPrinter, device: USBDevice) => {
	return (
		printers.serial === device.serialNumber &&
		printers.productId === device.productId &&
		printers.vendorId === device.vendorId
	);
};

export const loadPrinterConfig = async () => {
	try {
		const printerConfigStr = localStorage.getItem(LOCALSTORAGE_KEY);
		if (printerConfigStr) {
			let pc: PrinterConfig = JSON.parse(printerConfigStr);

			printerConfig.set({
				...pc,
				pairedPrinters: await refreshPairedPrintersStatus(pc.pairedPrinters)
			});
		} else {
			savePrinterConfig({
				autoPrint: false,
				pairedPrinters: []
			});
		}
	} catch (error) {}
};

export const pairNewDevice = async () => {
	const device = await requestDevice(supportedPrinter);
	// user cancelled
	if (!device) return;

	// paired printer, do nothing
	const pp = get(printerConfig).pairedPrinters.find((p) => matchDevice(p, device));
	if (pp) return pp;

	let pc = get(printerConfig);

	const printerInfo = supportedPrinter.find(
		(p) => p.vendorId === device.vendorId && p.productId === device.productId
	);
	const printerName = device.productName ?? printerInfo?.name ?? 'Unknown printer';

	const printer: PairedPrinter = {
		name: printerName,
		serial: device.serialNumber,
		productId: device.productId,
		vendorId: device.vendorId,
		default: false,
		printerInfo: printerInfo,
		pageSize: '58mm',
		templateName: 'order_reciept',
		online: true
	};

	savePrinterConfig({
		...pc,
		pairedPrinters: await refreshPairedPrintersStatus([...pc.pairedPrinters, printer])
	});

	return printer;
};

export const refreshPairedPrintersStatus = async (
	pairedPrinters: PairedPrinter[]
): Promise<PairedPrinter[]> => {
	const devices = await listConnectedDevices();
	return pairedPrinters.map((printer) => ({
		...printer,
		online: !!devices.find((d) => matchDevice(printer, d))
	}));
};

export const savePrinterConfig = (pc: PrinterConfig) => {
	let defaultSet = false;
	pc.pairedPrinters = pc.pairedPrinters.map((printer) => {
		if (printer.default && !defaultSet) {
			defaultSet = true;
			return { ...printer, default: true };
		}
		return { ...printer, default: false };
	});

	if (!defaultSet && pc.pairedPrinters[0]) {
		pc.pairedPrinters[0].default = true;
	}

	localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(pc));
	printerConfig.set(pc);
};

export const getDeviceFromPrinter = (printer: PairedPrinter) => {
	return supportedPrinter.find(
		(p) => p.vendorId === printer.vendorId && p.productId === printer.productId
	);
};

export const thermalPrinterPrint = async <T>(printer: PairedPrinter, data: T) => {
	try {
		const template = templateMap[printer.templateName][printer.pageSize];
		if (!template) {
			throw new Error('Template not found');
		}

		const devices = await listConnectedDevices();
		const device = devices.find((d) => matchDevice(printer, d));
		if (!device) {
			throw new Error('Device not found');
		}

		const pdf = await renderTemplatePDFs(template, data);
		const escpos = await convertPdfToEscpos(pdf, PAPER_WIDTHS[printer.pageSize], 1.0, true);

		const { endpointNumber, interfaceNumber } = await openDevice(
			device,
			printer.printerInfo?.configurationValue,
			printer.printerInfo?.interfaceNumber
		);
		console.log({ endpointNumber, interfaceNumber });
		const epn = printer.printerInfo?.endpointNumber ?? endpointNumber;

		for (const cmd of escpos) {
			await device.transferOut(epn, cmd);
		}

		await device.transferOut(epn, generateCutCommand(5));
		console.log('Printed');
		await device.close();
	} catch (error) {
		console.log(error);
	}
};
