<script lang="ts">
	import IconCircle from './IconCircle.svelte';

	function numberFormat(number: number): string {
		const nbf = new Intl.NumberFormat('en-US');
		return nbf.format(number);
	}
	export let label: string;
	export let value: number;
	export let iconName: string;
</script>

<div class="container">
	<div><ssk-text color="gray">{label}</ssk-text></div>
	<div class="icon">
		<IconCircle {iconName} iconColor="#f97315" fixedCircleSize="3rem" />
	</div>

	<div><ssk-text size="3xl">{numberFormat(value)}</ssk-text></div>
</div>

<style lang="css">
	.container {
		display: grid;
		width: 100%;
		grid-template-columns: auto auto;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		padding: 1rem;
	}

	.icon {
		grid-column-start: 2;
		grid-row-start: 1;
		grid-row-end: 3;

		margin-block: auto;
		display: flex;
		justify-content: flex-end;
	}
</style>
