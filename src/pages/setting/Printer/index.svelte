<script lang="ts">
	import BlankPage from '$components/BlankPage.svelte';
	import {
		pairNewDevice,
		printerConfig,
		savePrinterConfig,
		type PairedPrinter
	} from '$stores/thermal-printer';
	import { toast } from '$stores/toast';
	import { set } from 'lodash/fp';
	import PrinterItem from './PrinterItem.svelte';

	function toggleAutoPrint() {
		return savePrinterConfig({
			...$printerConfig,
			autoPrint: !$printerConfig.autoPrint
		});
	}

	function handleDeletePrinter(i: number) {
		return async () => {
			const printerName = $printerConfig.pairedPrinters[i]?.name;

			await savePrinterConfig({
				...$printerConfig,
				pairedPrinters: $printerConfig.pairedPrinters.filter((_, idx) => idx !== i)
			});

			$toast.addToast({
				title: `ลบเครื่องพิมพ์ "${printerName}" สำเร็จ`,
				timeout: 10000,
				type: 'success'
			});
		};
	}

	function handleUpdatePrinter(i: number) {
		return async (p: PairedPrinter) => {
			try {
				if (p.default) {
					await savePrinterConfig({
						...$printerConfig,
						pairedPrinters: $printerConfig.pairedPrinters.map((printer, idx) => {
							if (idx === i) {
								return { ...p, default: true };
							}
							return { ...printer, default: false };
						})
					});
				} else {
					await savePrinterConfig(set(`pairedPrinters[${i}]`, p, $printerConfig));
				}

				$toast.addToast({
					title: `บันทึกการตั้งค่าสำหรับ "${p.name}" สำเร็จ`,
					timeout: 10000,
					type: 'success'
				});
			} catch (error) {
				$toast.addToast({
					title: `บันทึกการตั้งค่าสำหรับ "${p.name}" ไม่สำเร็จ`,
					timeout: 10000,
					type: 'error'
				});
			}
		};
	}

	async function handlePairNewDevice() {
		try {
			const p = await pairNewDevice();
			$toast.addToast({
				title: `เชื่อมต่อเครื่องพิมพ์ "${p?.name}" สําเร็จ`,
				timeout: 10000,
				type: 'success'
			});
		} catch (error) {
			$toast.addToast({
				title: 'เชื่อมต่อเครื่องพิมพ์ ไม่สำเร็จ',
				timeout: 10000,
				type: 'error'
			});
		}
	}
</script>

<span class="title">
	<span class="text-title">เครื่องพิมพ์</span>
	<span class="auto-print">
		<ssk-toggle
			size="md"
			themeColor="sky"
			checked={$printerConfig.autoPrint}
			on:click={toggleAutoPrint}
		/>
		พิมพ์อัตโนมัติ
	</span>
</span>

<span class="divider"></span>

<div class="list-container">
	{#if $printerConfig.pairedPrinters.length === 0}
		<BlankPage description="ไม่พบเครื่องพิมพ์" height="auto" />
	{:else}
		{#each $printerConfig.pairedPrinters as printer, index}
			<PrinterItem
				{printer}
				onChange={handleUpdatePrinter(index)}
				onDelete={handleDeletePrinter(index)}
			/>
		{/each}
	{/if}
	<ssk-button width="auto" themeColor="sky" variant="outline" on:click={handlePairNewDevice}>
		<ssk-icon slot="prefix" name="solid-plus" />
		เพิ่มเครื่องพิมพ์
	</ssk-button>
</div>

<style>
	.title {
		display: flex;
		justify-content: space-between;
		width: 100%;
	}

	.text-title {
		font-weight: 400;
		font-size: 28px;
	}

	.divider {
		width: 100%;
		border-top: 1px solid var(--ssk-colors-gray-200);
	}

	.auto-print {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		font-size: 24px;
		line-height: 16px;
	}

	.list-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		padding: 24px;
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}
</style>
