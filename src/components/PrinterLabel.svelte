<script lang="ts">
	export let printerName: string;
	export let isDefault: boolean = false;
	export let disabled: boolean = false;
</script>

<div class="printer-label">
	<ssk-text>{printerName}</ssk-text>
	{#if isDefault}
		<ssk-badge variant="subtle" themeColor={disabled ? 'gray' : 'primary'}>เครื่องหลัก</ssk-badge>
	{/if}
</div>

<style>
	.printer-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
</style>
