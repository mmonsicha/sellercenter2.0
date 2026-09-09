<script lang="ts">
	import CustomFancyRadioGroup from '$components/CustomFancyRadioGroup.svelte';
	import ConfirmModal from '$components/modal/ConfirmModal.svelte';
	import type { PairedPrinter } from '$stores/thermal-printer';
	import UsbIcon from './UsbIcon.svelte';

	export let printer: PairedPrinter;

	export let printerTmp: Partial<PairedPrinter> = {};

	export let onChange: (p: PairedPrinter) => void;
	export let onDelete: () => void;

	let currentAction: 'delete' | 'config' | null = null;

	const handleConfig = () => {
		currentAction = 'config';
		printerTmp = {
			pageSize: printer.pageSize,
			templateName: printer.templateName
		};
	};

	const actionHandler = (action: 'delete' | 'config' | null) => {
		return () => {
			currentAction = action;
		};
	};

	const handleModalSave = () => {
		currentAction = null;
		onChange({
			...printer,
			...printerTmp
		});
	};

	const handleModalDelete = () => {
		currentAction = null;
		onDelete();
	};
</script>

<ConfirmModal
	onClose={actionHandler(null)}
	show={currentAction == 'delete'}
	icon="outline-trash"
	iconColor="#ef4444"
	title="ลบเครื่องพิมพ์"
	description="คุณต้องการลบเครื่องพิมพ์ ใช่หรือไม่"
>
	<ssk-button
		width="full"
		slot="footer-left"
		variant="outline"
		themeColor="button"
		on:click={actionHandler(null)}
	>
		<ssk-text>ยกเลิก</ssk-text>
	</ssk-button>
	<ssk-button width="full" themeColor="error" slot="footer-right" on:click={handleModalDelete}>
		ลบ
	</ssk-button>
</ConfirmModal>

<ssk-modal
	show={currentAction == 'config'}
	width="641px"
	hideDivider={false}
	on:close={actionHandler(null)}
>
	<ssk-text size="xl" slot="header">ตั้งค่าเครื่องพิมพ์</ssk-text>

	<div class="modal-body" slot="body">
		<CustomFancyRadioGroup
			label="ไซส์ใบเสร็จ"
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
			value={printerTmp.pageSize}
			onChange={(value) => (printerTmp.pageSize = value)}
		/>

		<CustomFancyRadioGroup
			label="ตัวเลือกใบเสร็จ"
			options={[
				{
					value: 'order_reciept',
					label: 'ใบเสร็จแบบสลิป'
				},
				{
					value: 'order_tax_invoice',
					label: 'ใบกำกับภาษีอย่างย่อ'
				}
			]}
			optionsPerRow={2}
			value={printerTmp.templateName}
			onChange={(value) => (printerTmp.templateName = value)}
		/>
	</div>

	<div class="modal-footer" slot="footer">
		<ssk-button themeColor="gray" variant="outline" on:click={actionHandler(null)}>
			ปิด
		</ssk-button>
		<ssk-button on:click={handleModalSave}>บันทึก</ssk-button>
	</div>
</ssk-modal>

<span class="printer-item">
	<UsbIcon />

	<div class="printer-info">
		<span class="printer-name-container">
			<div class="printer-name">{printer.name}</div>
			<ssk-badge size="xs" themeColor={`${printer.online ? 'success' : 'error'}`} variant="subtle">
				{printer.online ? 'เชื่อมต่อแล้ว' : 'ไม่ได้เชื่อมต่อ'}
			</ssk-badge>
			<ssk-badge size="xs" themeColor="gray" variant="outline">{printer.pageSize}</ssk-badge>
		</span>
		<ssk-text size="xs" color="gray.500">เครื่องพิมพ์ USB</ssk-text>
	</div>

	<div class="printer-actions">
		<ssk-radio
			size="sm"
			checked={printer.default}
			on:change={() => onChange({ ...printer, default: true })}
			label="ตั้งเป็นเครื่องหลัก"
		></ssk-radio>
		<ssk-icon name="outline-cog-8-tooth" color="gray.600" on:click={handleConfig} />
		<ssk-icon name="outline-trash" color="gray.600" on:click={actionHandler('delete')} />
	</div>
</span>

<style>
	.printer-item {
		display: grid;
		width: 100%;
		box-sizing: border-box;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		background-color: #fff;
		padding: 16px;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.printer-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.printer-name-container {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.printer-name {
		font-weight: 500;
		font-size: 24px;
		line-height: 20px;
	}

	.printer-actions {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
	}

	.printer-actions ssk-icon {
		cursor: pointer;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 16px;
	}
</style>
