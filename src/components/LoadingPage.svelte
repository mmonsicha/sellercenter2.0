<script lang="ts">
	export let description: string = '';
	export let height: string = '60dvh';
</script>

<div class="content" style="height: {height};">
	<ssk-icon class="spinner" name="outline-spinner" size="3xl" />
	<ssk-text color="gray">{description}</ssk-text>
</div>

<style lang="css">
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.content ssk-text {
		margin-top: 1rem;
	}
</style>
