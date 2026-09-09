<script lang="ts">
	import CustomFancyRadioGroup, { Orientation } from '$components/CustomFancyRadioGroup.svelte';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import PrinterLabel from '$components/PrinterLabel.svelte';
	import {
		getAnotherOnlinePrinter,
		getDefaultOnlinePrinter,
		printerConfig,
		type PairedPrinter
	} from '$stores/thermal-printer';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { PAPER_WIDTHS } from 'sellsuki-paper-template-renderer';
	import { getContext } from 'svelte';
	import { activeModal, openModal, toggleActiveModal } from '$stores/sales/modals';
	import { selectedPrinter, setSelectedPrinter } from '$stores/sales/selected-printer';

	const toastStore = getContext<ToastStore>('toast');

	let isChanged: boolean = false;
	let show: boolean = false;

	$: defaultPrinter = $selectedPrinter || getDefaultOnlinePrinter(); // get selected printer > init value by default
	$: defaultPrinterTmp = defaultPrinter ? { ...defaultPrinter } : undefined;
	$: show = $activeModal === 'settings-printer';
	$: firstOnlinePrinter = getAnotherOnlinePrinter();

	$: {
		if (!defaultPrinterTmp) {
			defaultPrinterTmp = { ...firstOnlinePrinter } as PairedPrinter;
			isChanged = true;
		}
	}

	const toggleModal = () => {
		toggleActiveModal('settings-printer');
		if ($activeModal !== 'settings-printer') {
			if (defaultPrinterTmp) {
				openModal('payment-success');
			} else {
				openModal('simplified-payment-success-with-printer-detail');
			}
		}
	};

	type PaperWidth = keyof typeof PAPER_WIDTHS;
	const onPageSizeChange = (value: string) => {
		if (value !== defaultPrinterTmp?.pageSize) {
			isChanged = true;
			if (defaultPrinterTmp && value in PAPER_WIDTHS) {
				defaultPrinterTmp.pageSize = value as PaperWidth;
			}
		}
	};

	const onPrinterChange = (value: string) => {
		if (value !== defaultPrinterTmp?.name) {
			isChanged = true;
			if (defaultPrinterTmp) {
				defaultPrinterTmp.name = value;
			}
		}
	};

	const onCancel = () => {
		defaultPrinterTmp = defaultPrinter ? { ...defaultPrinter } : undefined;

		isChanged = false;
		toggleModal();
	};

	const onSaveDefaultPrinterConfig = () => {
		if (defaultPrinterTmp) {
			setSelectedPrinter(defaultPrinterTmp);
		}

		isChanged = false;
		toggleModal();

		toastStore.addToast({
			message: 'ตั้งค่าการพิมพ์เรียบร้อย',
			type: 'success',
			timeout: 3000,
			testId: 'sidenav.toast.success'
		});
	};

	const mapPrintersOptions = () => {
		return $printerConfig.pairedPrinters.map((printer) => ({
			disabled: !printer.online,
			value: printer.name,
			label: PrinterLabel,
			labelProps: {
				printerName: printer.name,
				isDefault: printer.default,
				disabled: !printer.online
			}
		}));
	};
</script>

<ModalWithDivider
	{toggleModal}
	id="settings-printer-detail"
	ShowModal={show}
	hPosition="left"
	modalWidth="40vw"
	modalPaddingBody="0px"
>
	<div slot="title">
		<ssk-text size="2xl">การตั้งค่าการพิมพ์</ssk-text>
		<ssk-text color="gray.500">เลือกเครื่องพิมพ์และขนาดกระดาษที่ต้องการ</ssk-text>
	</div>
	<div class="slot-body" slot="body">
		{#key $printerConfig.pairedPrinters}
			<div class="select-printer">
				<CustomFancyRadioGroup
					label="เลือกเครื่องพิมพ์"
					options={mapPrintersOptions()}
					orientation={Orientation.VERTICAL}
					value={defaultPrinterTmp?.name}
					onChange={onPrinterChange}
				/>
			</div>
		{/key}

		<div class="template-list">
			<CustomFancyRadioGroup
				label="ตัวเลือกการพิมพ์"
				options={[
					{
						value: '58mm',
						label: '58 MM'
					},
					{
						value: '80mm',
						label: '80 MM'
					}
				]}
				optionsPerRow={2}
				value={defaultPrinterTmp?.pageSize}
				onChange={onPageSizeChange}
			/>
		</div>
	</div>
	<div class="slot-footer" slot="footer">
		<ssk-button variant="outline" on:click={onCancel}>กลับ</ssk-button>
		<ssk-button variant="solid" disabled={!isChanged} on:click={onSaveDefaultPrinterConfig}>
			ตั้งค่า
		</ssk-button>
	</div>
</ModalWithDivider>

<style>
	.slot-body {
		display: grid;
		gap: 1rem;
		padding: 1.5rem;
		width: -webkit-fill-available;
	}

	.slot-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
