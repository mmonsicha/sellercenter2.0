<script lang="ts">
	// Camera scanner for the coupon tab — a customer shows their QR/barcode on their own
	// phone at the counter, the cashier taps "สแกน" instead of retyping it. Own component
	// (not inline in CartFooter) since the camera lifecycle (start/stop/permission/error)
	// is a self-contained concern CartFooter doesn't need to know about beyond one event.
	import { BrowserMultiFormatReader } from '@zxing/browser';
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	// Overlay only renders while open, so mount/destroy IS start/stop — no separate prop
	// needed to drive the camera.
	export let open: boolean = false;

	const dispatch = createEventDispatcher<{ decode: string; close: void }>();

	let videoEl: HTMLVideoElement;
	let reader: BrowserMultiFormatReader | undefined;
	let controls: { stop: () => void } | undefined;
	let error: string = '';
	let starting = true;

	async function startScanning() {
		error = '';
		starting = true;
		try {
			reader = new BrowserMultiFormatReader();
			// Rear camera preferred — that's the one a cashier points at a customer's phone.
			controls = await reader.decodeFromConstraints(
				{ video: { facingMode: 'environment' } },
				videoEl,
				(result, err) => {
					if (result) {
						const text = result.getText();
						stopScanning();
						dispatch('decode', text);
					}
					// NotFoundException fires on every frame with nothing decodable yet — not
					// an error worth surfacing, scanning just keeps going.
				}
			);
		} catch (e) {
			const name = (e as { name?: string })?.name;
			error =
				name === 'NotAllowedError' || name === 'PermissionDeniedError'
					? 'กรุณาอนุญาตให้ใช้กล้องเพื่อสแกนคูปอง'
					: name === 'NotFoundError' || name === 'OverconstrainedError'
						? 'ไม่พบกล้องบนอุปกรณ์นี้'
						: 'ไม่สามารถเปิดกล้องได้ ลองใหม่อีกครั้ง';
		} finally {
			starting = false;
		}
	}

	function stopScanning() {
		controls?.stop();
		controls = undefined;
	}

	$: if (open && videoEl) startScanning();
	$: if (!open) stopScanning();

	onDestroy(stopScanning);

	function close() {
		stopScanning();
		dispatch('close');
	}
</script>

{#if open}
	<div class="scanner-overlay" role="dialog" aria-modal="true" aria-label="สแกนคูปอง">
		<div class="scanner-box">
			<div class="scanner-header">
				<span>สแกน QR / บาร์โค้ดคูปอง</span>
				<button
					type="button"
					class="scanner-close"
					aria-label="ปิดกล้อง"
					on:click={close}
					data-testid="sales.cart.discount.scanner.close"
				>
					<ssk-icon name="outline-x-mark"></ssk-icon>
				</button>
			</div>
			<div class="scanner-video-wrap">
				<!-- svelte-ignore a11y-media-has-caption -->
				<video bind:this={videoEl} class="scanner-video" muted playsinline></video>
				{#if starting && !error}
					<div class="scanner-hint">กำลังเปิดกล้อง…</div>
				{/if}
			</div>
			{#if error}
				<span class="scanner-error" data-testid="sales.cart.discount.scanner.error">{error}</span>
			{:else}
				<span class="scanner-tip">เล็งกล้องไปที่ QR หรือบาร์โค้ดของลูกค้า</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scanner-overlay {
		position: absolute;
		inset: 0;
		background: rgba(17, 24, 39, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 20;
		padding: 1rem;
		box-sizing: border-box;
		border-radius: inherit;
	}

	.scanner-box {
		width: 100%;
		max-width: 22rem;
		background: #fff;
		border-radius: 12px;
		padding: 0.75rem;
		display: grid;
		gap: 0.5rem;
		box-sizing: border-box;
	}

	.scanner-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-800, #1f2937);
	}

	.scanner-close {
		display: inline-flex;
		border: none;
		background: none;
		padding: 0.25rem;
		cursor: pointer;
		color: var(--ssk-colors-gray-500);
	}

	.scanner-video-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
	}

	.scanner-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.scanner-hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-family: inherit;
		font-size: var(--ssk-font-size-sm);
	}

	.scanner-tip,
	.scanner-error {
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		text-align: center;
	}

	.scanner-tip {
		color: var(--ssk-colors-gray-500);
	}

	.scanner-error {
		color: var(--ssk-colors-secondary-500, #d90005);
	}

	@media (max-width: 360px) {
		.scanner-box {
			max-width: 100%;
		}
	}
</style>
