<script lang="ts">
	export var value: number;
	export var min: number = 0;
	export var max: number = 999;
	export var disabledMinus: boolean = false;

	export var onChange: () => void;

	/** `horizontal` puts plus first, then the field, then minus — left to right. */
	export let layout: 'vertical' | 'horizontal' = 'vertical';
	/** At the lowest step the minus turns into a remove affordance instead of a no-op. */
	export let removeAtMin: boolean = false;
	export let onRemove: (() => void) | undefined = undefined;

	// One above the floor is the last decrement that would leave nothing behind, so that
	// is where the control offers removal rather than a dead button.
	$: atRemoveStep = removeAtMin && !!onRemove && value <= min + 1;

	function _onValueChange(e: Event) {
		var inputValue = (e.target as HTMLInputElement).value;
		const nValue = parseFloat(inputValue);

		if (!isNaN(nValue)) {
			const maxValue = Math.min(nValue, max);
			if (maxValue >= min && maxValue <= max) {
				value = maxValue;
			}

			if (value < min) value = min;
		} else {
			value = NaN;
		}
		(e.target as HTMLInputElement).value = `${value}`;
		onChange();
	}

	function _onPlus() {
		if (value < max) {
			value += 1;
		}
		onChange();
	}

	function _onMinus() {
		if (value > min) {
			value -= 1;
		}
		onChange();
	}

	function _onBlur() {
		if (isNaN(value)) {
			value = min;
		}
		onChange();
	}
</script>

<!-- class: directive, not an interpolated string: Svelte cannot prove a dynamic class
     name is used and prunes the matching CSS rule as dead. -->
<div
	class="quantity-number-input"
	class:horizontal={layout === 'horizontal'}
	on:click|stopPropagation={() => {}}
>
	<div class="quantity-arrow-plus" on:click={_onPlus}>
		<ssk-icon name="outline-plus" size="xs" />
	</div>
	<input
		class="quantity-num"
		type="number"
		{min}
		{max}
		{value}
		on:change={_onValueChange}
		on:input={_onValueChange}
		on:blur={_onBlur}
	/>
	<div
		class={`quantity-arrow-minus ${disabledMinus ? 'disabled' : ''}`}
		on:click={disabledMinus ? null : atRemoveStep ? onRemove : _onMinus}
	>
		{#if atRemoveStep}
			<ssk-icon name="outline-trash" color="rose-600" size="xs" />
		{:else}
			<ssk-icon name="outline-minus" size="xs" />
		{/if}
	</div>
</div>

<style>
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		margin: 0;
	}
	input[type='number'] {
		text-align: center;
	}

	input[type='number']:focus-within {
		border-color: var(--ssk-colors-primary-200);
		outline: 1px solid var(--ssk-colors-primary-50);
	}

	.quantity-number-input {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	/* Row layout: plus, value, minus. Costs one line instead of three, which is the
	   point — the cart rows get shorter and more of them fit. */
	.quantity-number-input.horizontal {
		flex-direction: row;
		align-items: center;
		gap: 0.25rem;
		width: auto;
	}

	.horizontal .quantity-arrow-plus,
	.horizontal .quantity-arrow-minus {
		padding-top: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 4px;
	}

	.horizontal .quantity-arrow-plus:hover,
	.horizontal .quantity-arrow-minus:hover {
		background-color: var(--ssk-colors-gray-100);
	}

	.horizontal .quantity-num {
		width: 2.25rem;
		padding: 0.25rem;
		font-size: 14px;
	}
	.quantity-arrow-minus,
	.quantity-arrow-plus {
		padding-top: 0.25rem;
		cursor: pointer;
		align-self: center;
	}
	.quantity-num {
		border: 1px solid var(--ssk-colors-gray-100);
		padding: 0.75rem 0.5rem;
		border-radius: 8px;
		font-size: 16px;
	}

	.quantity-arrow-minus.disabled {
		cursor: not-allowed;
	}

	.quantity-arrow-minus.disabled > ssk-icon {
		color: var(--ssk-colors-gray-400);
	}
</style>
