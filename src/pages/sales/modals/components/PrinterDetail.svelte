<script lang="ts">
	import {
		getDefaultOnlinePrinter,
		printerConfig,
		refreshPairedPrintersStatus,
		type PairedPrinter
	} from '$stores/thermal-printer';
	import { openModal } from '$stores/sales/modals';
	import {
		getSelectedPrinter,
		selectedPrinter,
		setSelectedPrinter
	} from '$stores/sales/selected-printer';

	export let isChangedSetting: boolean = false;

	let primaryPrinter: PairedPrinter | undefined = getSelectedPrinter();

	$: primaryPrinter = $selectedPrinter;

	const openSettingsModal = async () => {
		$printerConfig.pairedPrinters = await refreshPairedPrintersStatus(
			$printerConfig.pairedPrinters
		);

		const defaultPrinter = getDefaultOnlinePrinter();
		if (!defaultPrinter && !$selectedPrinter) {
			setSelectedPrinter(undefined);
		}
		openModal('settings-printer');
	};

	const mapPageSize = (size: string): string => {
		switch (size) {
			case '80mm':
				return '80 MM';
			case '58mm':
				return '58 MM';
			default:
				return size;
		}
	};
</script>

<div class="printer-info">
	<div>
		<ssk-text color="gray.500">
			เครื่องพิมพ์: <span class={primaryPrinter?.name ? 'black' : 'red'}>
				{primaryPrinter?.name ?? 'ไม่ได้เชื่อมต่อ'}
			</span>
		</ssk-text>
	</div>
	<div>
		<ssk-text color="gray.500">
			ตัวเลือกการพิมพ์: <span class={primaryPrinter?.pageSize ? 'black' : 'red'}>
				{mapPageSize(primaryPrinter?.pageSize ?? 'ไม่ได้เชื่อมต่อ')}
			</span>
		</ssk-text>
	</div>
	{#if isChangedSetting}
		<div class="pointer" on:click={openSettingsModal}>
			<ssk-text color="primary.500">เปลี่ยนตัวเลือกการพิมพ์และเครื่องพิมพ์</ssk-text>
		</div>
	{/if}
</div>

<style>
	.printer-info {
		padding: 1rem 6rem;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		text-align: center;
		display: grid;
		gap: 0.5rem;
	}

	ssk-text > span.black {
		color: var(--ssk-colors-gray-800);
	}

	ssk-text > span.red {
		color: #e11d48;
	}

	.pointer {
		cursor: pointer;
	}
</style>
