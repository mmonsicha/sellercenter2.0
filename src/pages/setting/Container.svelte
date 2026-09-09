<script lang="ts">
	export let title: string = '';
</script>

<div class="container">
	<ssk-text size="xl">{title}</ssk-text>

	<span class="divider"></span>

	<slot />
</div>

<style lang="css">
	.container {
		display: flex;
		flex-direction: column;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		height: auto;
		width: 100%;
		padding: 32px;
		box-sizing: border-box;
		gap: 24px;
	}

	.divider {
		width: 100%;
		border-top: 1px solid var(--ssk-colors-gray-200);
	}
</style>
