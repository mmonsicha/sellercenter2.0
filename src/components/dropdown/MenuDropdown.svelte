<script lang="ts">
	import { onMount } from 'svelte';

	export let testId: string | undefined = undefined;
	export let enableOptionHover = false;

	let isOpen = false;
	let container: HTMLDivElement | null = null;

	function toggle(event: MouseEvent) {
		event.stopPropagation();
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}

	onMount(() => {
		const handleDocumentClick = (event: MouseEvent) => {
			if (!isOpen) return;
			const target = event.target as Node;
			if (container && !container.contains(target)) {
				close();
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				close();
			}
		};

		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('click', handleDocumentClick);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div class="dropdown" class:with-option-hover={enableOptionHover} bind:this={container}>
	<button class="dropdown-trigger" on:click={toggle} type="button" data-testid={testId}>
		<slot name="trigger" />
	</button>
	{#if isOpen}
		<div class="dropdown-menu">
			<slot name="menu" {close} />
		</div>
	{/if}
</div>

<style lang="css">
	.dropdown {
		position: relative;
	}

	.dropdown-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		padding: 0;
		cursor: pointer;
		color: var(--ssk-colors-gray-600);
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		right: 0;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		padding: 0.7em 0.25em;
		min-width: 130px;
		max-height: 344px;
		z-index: 10;
	}

	:global(.menu-dropdown-options-container) {
		display: grid;
		gap: 1rem;
		z-index: 1;
	}

	:global(.menu-dropdown-option) {
		padding: 0 1rem;
		cursor: pointer;
	}

	:global(.menu-dropdown-option.disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.dropdown.with-option-hover .menu-dropdown-option:hover) {
		background: var(--ssk-colors-gray-50);
		border-radius: 8px;
	}
</style>
