<script lang="ts">
	import { tick } from 'svelte';

	/**
	 * Radiogroup wrapper for a list of PickCards. Owns the keyboard contract in one
	 * place: arrows move the choice, and only the chosen card is in the tab order.
	 */
	export let label: string;
	export let count: number = 0;
	export let selectedIndex: number = -1;
	export let onMove: (index: number) => void;

	const onKeydown = async (e: KeyboardEvent) => {
		if (count < 2) return;
		const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
		const back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
		if (!forward && !back) return;
		e.preventDefault();

		const from = selectedIndex < 0 ? 0 : selectedIndex;
		const next = (from + (forward ? 1 : -1) + count) % count;
		onMove(next);

		const group = e.currentTarget as HTMLElement;
		await tick();
		group.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
	};
</script>

<div class="pick-list" role="radiogroup" tabindex="-1" aria-label={label} on:keydown={onKeydown}>
	<slot />
</div>

<style>
	.pick-list {
		display: grid;
		gap: 0.5rem;
	}
</style>
