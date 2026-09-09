<script lang="ts">
	import IconCircle from '$components/IconCircle.svelte';

	export let icon: string = '';
	export let iconColor: string = '';
	export let title: string = '';
	export let description: string = '';
	export let onClose: () => void;
	export let show: boolean = false;
</script>

<ssk-modal {show} on:close={onClose} width="400px">
	<div class="icon-container" slot="header">
		{#if icon}
			<IconCircle {iconColor} type="outline" iconName={icon} iconSize="xl" />
		{/if}
	</div>

	<div class="content" slot="body">
		<ssk-heading level="3" slot="body" fontWeight="medium">{title}</ssk-heading>
		<slot name="description">
			<ssk-text size="md" hidden={!description} slot="body">{description}</ssk-text>
		</slot>
	</div>
	<div slot="footer" class="footer">
		<slot name="footer-left" />
		<slot name="footer-right" />
	</div>
</ssk-modal>

<style>
	.icon-container {
		display: grid;
		place-items: center;
	}

	.content {
		display: flex;
		width: 100%;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 1rem;
	}

	.footer {
		display: grid;
		width: 100%;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
</style>
