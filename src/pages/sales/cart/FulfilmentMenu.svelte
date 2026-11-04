<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let options: {
		value: string;
		label: string;
		hint: string;
		icon: string;
		disabled?: boolean;
	}[] = [];
	export let selectedValue: string | undefined = undefined;
	export let activeIndex = -1;
	export let position: 'absolute' | 'fixed' = 'absolute';
	export let positionStyle = '';
	export let menuTestId: string | undefined = undefined;
	export let optionTestIdPrefix = '';

	const dispatch = createEventDispatcher<{ select: string }>();

	function selectOption(value: string, disabled = false) {
		if (!disabled) dispatch('select', value);
	}
</script>

<ul
	class="fulfilment-menu"
	class:fixed={position === 'fixed'}
	role="listbox"
	style={positionStyle}
	data-testid={menuTestId}
	on:keydown
>
	{#each options as option, index (option.value)}
		<li
			role="option"
			aria-selected={option.value === selectedValue}
			aria-disabled={option.disabled ?? false}
			class:active={index === activeIndex}
			data-testid={optionTestIdPrefix ? `${optionTestIdPrefix}.${option.value}` : undefined}
			on:click={() => selectOption(option.value, option.disabled)}
		>
			<ssk-icon name={option.icon} size="xs"></ssk-icon>
			<span class="option-text">
				<span class="option-label">{option.label}</span>
				<span class="option-hint">{option.hint}</span>
			</span>
			{#if option.value === selectedValue}
				<ssk-icon name="outline-check" size="xs"></ssk-icon>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.fulfilment-menu {
		position: absolute;
		z-index: 1000;
		margin: 0;
		padding: 0.25rem;
		list-style: none;
		background: white;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		max-height: 16rem;
		overflow-y: auto;
	}

	.fulfilment-menu.fixed {
		position: fixed;
	}

	.fulfilment-menu li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 6px;
		cursor: pointer;
	}

	.fulfilment-menu li:hover,
	.fulfilment-menu li.active {
		background: var(--ssk-colors-gray-50);
	}

	.fulfilment-menu li[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.option-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.option-label {
		font-size: var(--ssk-font-size-sm);
		font-weight: 600;
		color: var(--ssk-colors-gray-800);
	}

	.option-hint {
		font-size: var(--ssk-font-size-xs);
		color: var(--ssk-colors-gray-500);
	}
</style>
