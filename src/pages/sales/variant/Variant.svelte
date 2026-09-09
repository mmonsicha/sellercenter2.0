<script lang="ts">
	import type { SaleCustomerInput, SaleVariant } from '$lib/entities/sale/sale';
	import RadioGroup from '$components/RadioGroup.svelte';
	import {
		seperateVariantCombination,
		generateRadioOptions,
		type opts,
		getVariantPrice,
		combinedValues,
		getVariantImage,
		type tVrtCmb
	} from './util.variant';
	import {
		updateCartIdInfo,
		updateCartImage,
		updateCartInput,
		updateCartOptionInfo,
		updateCartPriceInfo
	} from '$stores/cart/cart-item';
	import type { TCartItem, TCartOptions } from '$stores/cart';
	import {
		cInputValue,
		selectedProductInfo,
		setCustomerInput,
		variantValue
	} from '$stores/variant/variant';
	import {
		showAddVariantModal,
		showEditVariantModal,
		setIsUpdate
	} from '$stores/variant/variant-handler-modal';
	import { afterUpdate } from 'svelte';

	export let variant: SaleVariant[];
	export let customerInput: SaleCustomerInput[] = [];
	export let price: number;
	export let productInfo: TCartItem;

	var showModalCondition: boolean = false;
	var defaultVariant: TCartOptions[] = [];
	var defaultCustomerInput: TCartOptions[] = [];
	var variantOption: tVrtCmb[] = [];

	function _onChangeVariant(selected: opts) {
		if ($showEditVariantModal) setIsUpdate(true);
		const cartOpt = _changeOptions(selected, defaultVariant);
		const combV = combinedValues(cartOpt);
		const id = productInfo.product_id.split('-')[0];
		const image = getVariantImage(combV, variant) ?? $selectedProductInfo.image;
		price = getVariantPrice(combV, variant);

		updateCartIdInfo(`${id}-${combV}`);
		updateCartPriceInfo(price);
		updateCartOptionInfo(cartOpt);
		updateCartImage(image);
	}

	function _changeOptions(target: opts, opts?: TCartOptions[]): TCartOptions[] {
		const ff = opts;
		if (ff) {
			return ff.map((o) => {
				if (o.key == target.label) {
					o.value = target.value;
				}
				return o;
			});
		}
		return [];
	}

	function _setCustomerInputValue(key: string, e: Event) {
		if ($showEditVariantModal) setIsUpdate(true);

		const inputElm = e.target as HTMLInputElement;
		const newValue = $cInputValue.map((cIp) => {
			if (cIp.key === key) {
				cIp.value = inputElm.value;
				inputElm.value = cIp.value;
			}
			return cIp;
		});
		setCustomerInput(newValue);
		updateCartInput($cInputValue);
	}

	function handleCustomerInput(key: string) {
		function onInputEvent(event: Event) {
			_setCustomerInputValue(key, event);
		}
		return onInputEvent;
	}

	function _clearCustomerInput() {
		const cIpValue: TCartOptions[] = [];
		// set key customer input with default value
		customerInput.map((cIp) => {
			cIpValue.push({ key: cIp.label, value: '' });
		});
		setCustomerInput(cIpValue);
	}

	afterUpdate(() => {
		showModalCondition = $showAddVariantModal == true || $showEditVariantModal == true;
		if (variant && variant.length > 0 && showModalCondition) {
			variantOption = seperateVariantCombination(variant);
		}

		if (variant && customerInput.length > 0 && $cInputValue.length == 0) {
			_clearCustomerInput();
		}

		defaultVariant = $showAddVariantModal ? productInfo.options ?? [] : $variantValue;
		defaultCustomerInput = productInfo.input ?? [];
	});
</script>

{#key $selectedProductInfo}
	<div class="options">
		{#each variantOption as variant, idx}
			<RadioGroup
				name={`vrt-${idx}`}
				label={variant.key}
				require
				defaultValue={defaultVariant[idx]?.value || variant.value[0]}
				options={generateRadioOptions(variant)}
				onChange={(s) => _onChangeVariant(s)}
			/>
		{/each}
	</div>
	<div class="customer-input">
		{#each customerInput as cInput, idx}
			<ssk-input
				testId={`sales.modal.varient.input.customer-input.${idx}`}
				type={cInput.type}
				label={cInput.label}
				required={cInput.required}
				showLimit={cInput.isLimit}
				limit={cInput.limit}
				value={defaultCustomerInput[idx]?.value}
				on:input={handleCustomerInput(cInput.label)}
				on:change={handleCustomerInput(cInput.label)}
			/>
		{/each}
	</div>
{/key}

<style>
	.options {
		width: 100%;
	}

	.customer-input {
		width: 100%;
	}
</style>
