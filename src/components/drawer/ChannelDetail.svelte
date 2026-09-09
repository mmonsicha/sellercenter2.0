<script lang="ts">
	import CustomFancyRadioGroup from '$components/CustomFancyRadioGroup.svelte';
	import IconLabel from '$components/IconLabel.svelte';
	import {
		paymentMethods,
		PaymentType,
		salesChannels,
		sameDayDeliveries,
		ShippingType,
		standardDeliveries,
		type Option
	} from '$lib/entities/order/order';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import { marketplaceValues } from '$utils/utils-order';

	export let isDirty: boolean = false;
	export let isPaidOrder: boolean = false;
	export let selectedChannel: string = 'unknown';
	export let selectedPayment: string = 'unknown';
	export let selectedProvider: string = 'unknown';
	export let shippingFee: string = '';
	export let shippingGroup: ShippingType = ShippingType.Standard;
	export let form: string = '';

	let tooltipItems: string[] = ['Standard (2-7 วันทำการ)', 'Same Day ส่งภายในวันเดียวกัน'];
	let filteredPaymentMethods: Option[] = [];
	let filteredDeliveries: Option[] = [];

	const renderOptions = (items: Option[]) =>
		items.map(({ value, label, icon }) => ({
			value,
			label: IconLabel,
			labelProps: { label, icon }
		}));

	function updateShippingType(type: ShippingType) {
		isDirty = true;
		shippingGroup = type;
		selectedProvider = 'unknown';
		setUnsavedChanges(true, form);
	}

	function updateShippingProvider(provider: string) {
		isDirty = true;
		selectedProvider = provider;
		setUnsavedChanges(true, form);
	}

	function updatedSaleChannel(saleOrigin: string) {
		isDirty = true;
		selectedChannel = saleOrigin;
		setUnsavedChanges(true, form);
	}

	function updatePayment(payment: string) {
		isDirty = true;
		selectedPayment = payment;
		setUnsavedChanges(true, form);
	}

	function handleShippingFee(event: Event) {
		isDirty = true;
		shippingFee = (event.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
		(event.target as HTMLInputElement).value = shippingFee;
		setUnsavedChanges(true, form);
	}

	function isMarketplaceChannel(channel: string): boolean {
		return marketplaceValues.includes(channel);
	}

	function getFilteredPaymentMethods(channel: string, methods: Option[]): Option[] {
		return isMarketplaceChannel(channel)
			? methods.filter((m) => m.value === channel)
			: methods.filter((m) =>
					['unknown', PaymentType.BankTransfer, PaymentType.Cod].includes(m.value)
				);
	}

	function getFilteredDeliveries(channel: string, type: ShippingType): Option[] {
		if (isMarketplaceChannel(channel)) {
			shippingGroup = ShippingType.Standard;
			return standardDeliveries.filter((d) => d.value === channel);
		}

		const base = type === ShippingType.Standard ? standardDeliveries : sameDayDeliveries;
		return base.filter((d) => !marketplaceValues.includes(d.value));
	}

	function validSelection<T extends Option>(list: T[], selected: string): string {
		return list.some((item) => item.value === selected) ? selected : list[0]?.value || '';
	}

	$: {
		filteredPaymentMethods = getFilteredPaymentMethods(selectedChannel, paymentMethods);
		selectedPayment = validSelection(filteredPaymentMethods, selectedPayment);

		filteredDeliveries = getFilteredDeliveries(selectedChannel, shippingGroup);
		selectedProvider = validSelection(filteredDeliveries, selectedProvider);
	}
</script>

<div class="container">
	{#if !isPaidOrder}
		<div class="section">
			<ssk-text size="md">ช่องทางการขาย<span class="required">*</span></ssk-text>
			<div class="grid">
				<CustomFancyRadioGroup
					label=""
					options={renderOptions(salesChannels)}
					optionsPerRow={2}
					value={selectedChannel}
					onChange={updatedSaleChannel}
				/>
			</div>
		</div>

		<div class="section">
			<ssk-text size="md">วิธีการชำระเงิน<span class="required">*</span></ssk-text>
			<div class="grid">
				<CustomFancyRadioGroup
					label=""
					options={renderOptions(filteredPaymentMethods)}
					optionsPerRow={2}
					value={selectedPayment}
					onChange={updatePayment}
				/>
			</div>
		</div>
	{/if}
	<div class="section">
		<div class="content">
			<ssk-text size="md">วิธีการจัดส่ง<span class="required">*</span></ssk-text>
			<ssk-tooltip
				size="sm"
				themeColor="white"
				placement="top"
				color="currentcolor"
				hideCloseButton={true}
			>
				<div class="tooltip" slot="content">
					{#each tooltipItems as item}
						<li>{item}</li>
					{/each}
				</div>
				<ssk-icon name="outline-information-circle" size="sm" color="gray" />
			</ssk-tooltip>
		</div>
		{#if !marketplaceValues.includes(selectedChannel)}
			<ssk-tab-header
				class="tabs"
				variant="button"
				size="sm"
				align="center"
				color="primary"
				buttonwidth="auto"
			>
				<ssk-tab-button
					variant="button"
					size="sm"
					align="center"
					buttonwidth="auto"
					width="100%"
					active={shippingGroup === ShippingType.Standard}
					on:click={() => updateShippingType(ShippingType.Standard)}
				>
					<div class="tab-text">Standard</div>
				</ssk-tab-button>
				<ssk-tab-button
					variant="button"
					size="sm"
					align="center"
					buttonwidth="auto"
					width="100%"
					active={shippingGroup === ShippingType.SameDay}
					on:click={() => updateShippingType(ShippingType.SameDay)}
				>
					<div class="tab-text">Same Day</div>
				</ssk-tab-button>
			</ssk-tab-header>
		{/if}

		<div class="grid">
			<CustomFancyRadioGroup
				label=""
				options={renderOptions(filteredDeliveries)}
				optionsPerRow={2}
				value={selectedProvider}
				onChange={updateShippingProvider}
			/>
			<ssk-input
				label="ค่าจัดส่ง"
				placeholder="ระบุค่าจัดส่ง"
				autoComplete="off"
				limit="255"
				value={shippingFee}
				disabled={isPaidOrder}
				on:input={handleShippingFee}
				on:change={handleShippingFee}
			/>
		</div>
	</div>
</div>

<style>
	.container {
		display: grid;
		gap: 1rem;
	}

	.section {
		padding: 0.75rem;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.required {
		color: red;
	}

	.content {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.tooltip {
		padding: 0 1rem;
		font-size: 18px;
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.5rem;
	}

	.tab-text {
		padding: 0.3rem;
	}
</style>
