<script lang="ts">
	export let label: string;
	export let icon: string;
</script>

<div class="icon-label">
	{#if icon}
		<ssk-image src={icon} width="24px"></ssk-image>
	{/if}
	<ssk-text size="md"><span>{@html label}</span></ssk-text>
</div>

<style>
	.icon-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
</style>
