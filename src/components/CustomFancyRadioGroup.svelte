<script context="module" lang="ts">
	export enum Orientation {
		HORIZONTAL = 'horizontal',
		VERTICAL = 'vertical'
	}
</script>

<script lang="ts">
	import type { ComponentType } from 'svelte';

	// Define a generic option type that supports both string labels and component labels
	type Option<T = string> = {
		value: T;
		disabled?: boolean;
		label: string | ComponentType;
		labelProps?: Record<string, any>; // Props to pass to the component if label is a component
	};

	// Props
	export let label: string;
	export let options: Option<string | ComponentType>[] = []; // Use `any` or a specific type like Option<number>[] externally
	export let value: any = '';
	export let optionsPerRow: number = 2;
	export let orientation: Orientation = Orientation.HORIZONTAL;
	export let onChange: (value: any) => void = () => {};
</script>

<div class="container">
	<span>{label}</span>
	<div
		class="options"
		style={`${orientation === Orientation.HORIZONTAL ? `grid-template-columns: repeat(${optionsPerRow}, 1fr);` : ''}`}
	>
		{#each options as option}
			<div
				class={`option ${option.value === value ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}`}
				on:click={() => !option.disabled && onChange(option.value)}
			>
				{#if typeof option.label === 'string'}
					<ssk-radio
						checked={option.value === value}
						label={option.label}
						disabled={option.disabled}
					/>
				{:else}
					<ssk-radio checked={option.value === value} disabled={option.disabled}>
						<div slot="label">
							<svelte:component this={option.label} {...option.labelProps || {}} />
						</div>
					</ssk-radio>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.options {
		display: grid;
		gap: 1rem;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 1rem;
		cursor: pointer;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.option.selected {
		border-color: var(--ssk-colors-primary-500);
	}

	.option.disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	ssk-radio {
		pointer-events: none;
	}
</style>
