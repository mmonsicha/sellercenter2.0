<script lang="ts">
	type opts = {
		id?: string;
		value: string;
		label: string;
	};
	export var label: string;
	export var name: string;
	export var require: boolean;
	export var defaultValue: string;
	export var onChange: (selected: opts) => void;
	export var options: opts[] = [];
	export var template: number = 3;

	function _onValueChange(e: Event) {
		var selected: opts = {
			value: '',
			label: label
		};
		const selectedElm = document.querySelector(`input[name="${name}"]:checked`);
		if (selectedElm) {
			selected.value = (selectedElm as HTMLInputElement).value;
		}

		onChange(selected);
	}

	function _onDivClick(e: Event) {
		const input = (e.currentTarget as HTMLElement).querySelector(
			`input[name="${name}"]`
		) as HTMLInputElement;
		if (input && !input.checked) {
			input.checked = true;
			_onValueChange(e);
		}
	}
</script>

<div class="radio-wrapper">
	<ssk-text
		>{label}
		{#if require}
			<span>*</span>
		{/if}
	</ssk-text>
	<div class="items" style={`--template: ${template};`}>
		{#each options as opt}
			<div on:click={_onDivClick}>
				<input
					type="radio"
					id={opt.id}
					{name}
					value={opt.value}
					checked={defaultValue === opt.value}
					on:change={_onValueChange}
				/>
				<label for={name}>{opt.label}</label>
			</div>
		{/each}
	</div>
</div>

<style>
	ssk-text > span {
		color: red;
	}

	.radio-wrapper {
		display: flex;
		flex-direction: column;
	}

	.items {
		display: flex;
		padding: 0.5rem 0;
		gap: 0.75rem;
	}

	.items > div {
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		width: 100%;
		white-space: nowrap;
	}

	@supports (-webkit-appearance: none) or (-moz-appearance: none) {
		.radio-wrapper input[type='radio'] {
			--height: 18px;
			--width: 18px;
			--border-color: var(--ssk-colors-gray-100);

			-moz-appearance: none;
			appearance: none;
			height: var(--height);
			width: var(--width);
			outline: none;
			display: inline-block;
			position: relative;
			cursor: pointer;
			border: calc(0.1 * var(--width)) solid var(--border-color);
			border-radius: 50%;
			background-color: #fff;
			vertical-align: middle;
		}

		.radio-wrapper input[type='radio']:checked {
			--border-color: var(--ssk-colors-primary-500);
		}

		.radio-wrapper input[type='radio'] + label {
			display: inline-block;
			vertical-align: middle;
			cursor: pointer;
			margin-left: calc(0.2 * var(--font-size));
		}

		.radio-wrapper input[type='radio']:checked::before {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			height: calc(0.65 * var(--height));
			width: calc(0.65 * var(--width));
			background-color: var(--ssk-colors-primary-500);
			border-radius: 50%;
		}
	}
	.radio-wrapper * {
		box-sizing: inherit;
	}
	.radio-wrapper *:before,
	.radio-wrapper *:after {
		box-sizing: inherit;
	}
</style>
