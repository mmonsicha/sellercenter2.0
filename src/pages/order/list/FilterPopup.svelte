<script lang="ts">
	import { currentLanguage } from '$stores/i18n';
	import {
		isClearSearchFilter,
		oFilter,
		resetFilterOptions,
		setDefaultOrderFilter,
		setFilter,
		setIsClearSearchOrderFilter,
		setTotal
	} from '$stores/order/filter';
	import _ from 'lodash';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { beforeUpdate, getContext, onMount } from 'svelte';
	import {
		type FilterOption,
		groupedChannels,
		groupedCouriers,
		mappedChannels,
		mappedStatuses,
		type OrderStatus,
		toInitFilterOrder,
		toOrderFilter,
		Courier
	} from './filterHandler';

	export let disabled: boolean = true;
	export let oType: OrderStatus;

	const i18nStore = getContext<I18nStore>('i18n');
	let dateFrom: Date | undefined;
	let dateTo: Date | undefined;
	let dateError: boolean = false;
	let dateText: string = '';
	let filterOption: FilterOption;
	let datePicker = {
		label: '',
		phdFrom: '',
		phdTo: ''
	};
	let stateLabels: Record<string, string> = {};
	let channelLabels: Record<string, string> = {};

	const courierLabelMap: Record<string, string> = {
		[Courier.unknownStandard]: 'ไม่ระบุ',
		[Courier.unknownSameday]: 'ไม่ระบุ'
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}

	async function fetchDataKeyword(keywordToTranslate: string): Promise<string> {
		let result = await i18nStore.get(keywordToTranslate, $currentLanguage.code, 'default');

		return result;
	}

	async function convertKeyword(key: string, labelType: 'state' | 'channel') {
		const resultConvert = await fetchDataKeyword(key);
		if (labelType === 'state') {
			stateLabels = { ...stateLabels, [key]: resultConvert };
		} else if (labelType === 'channel') {
			channelLabels = { ...channelLabels, [key]: resultConvert };
		}
	}

	$: {
		if (filterOption?.paymentState) {
			filterOption.paymentState?.map(async (ps) => await convertKeyword(ps.state, 'state'));
		}

		if (filterOption?.paymentChannel) {
			filterOption.paymentChannel?.map(async (pc) => await convertKeyword(pc.channel, 'channel'));
		}
	}

	function handleDateValue(e: any) {
		const { valueFrom, valueTo } = e.detail;
		dateFrom = valueFrom;
		dateTo = valueTo;

		if (!dateFrom && !dateTo) {
			dateError = false;
		}
	}

	function toggleChannelChecked(chn: string, c: boolean) {
		filterOption.paymentChannel = filterOption.paymentChannel?.map((pChannel) => {
			if (pChannel.channel === chn) {
				pChannel.checked = !c;
			}

			return pChannel;
		});
	}

	function toggleSalesChecked(s: string, c: boolean) {
		filterOption.salesChannels = filterOption.salesChannels?.map((sChannel) => {
			if (sChannel.channel === s) {
				sChannel.checked = !c;
			}

			return sChannel;
		});
	}

	function toggleStateChecked(sts: string, c: boolean) {
		filterOption.paymentState = filterOption.paymentState?.map((pChannel) => {
			if (pChannel.state === sts) {
				pChannel.checked = !c;
			}

			return pChannel;
		});
	}

	function toggleCourierChecked(cr: string, c: boolean) {
		filterOption.couriers = filterOption.couriers?.map((courier) => {
			if (courier.name === cr) {
				courier.checked = !c;
			}

			return courier;
		});
	}

	function handleClickOutside(e: Event) {
		if (!(e.target as HTMLInputElement).closest('.filter')) {
			disabled = true;
		}
	}

	function clearFilter() {
		resetFilterOptions();
		filterOption = toInitFilterOrder(oType, $oFilter);

		dateFrom = undefined;
		dateTo = undefined;

		dateError = false;
		setDefaultOrderFilter();
	}

	function applyFilter() {
		resetFilterOptions();

		setTotal(filterOption.total);
		const orderFilter = toOrderFilter(filterOption, { from: dateFrom, to: dateTo });
		setFilter(orderFilter);

		disabled = !disabled;
	}

	$: {
		if ($isClearSearchFilter) {
			filterOption = toInitFilterOrder(oType, $oFilter);
			setIsClearSearchOrderFilter(false);
			dateError = false;
		}

		if (dateFrom && dateTo) {
			const f = dateFrom.getTime();
			const t = dateTo.getTime();
			if (f > t) {
				dateError = true;
			} else {
				dateError = false;
			}
		}

		if (dateError) {
			dateText = 'วันที่เริ่มต้นต้องอยู่ก่อนวันที่สิ้นสุด';
		}

		if (disabledDate(dateFrom!) || disabledDate(dateTo!)) {
			dateText = '';
			dateError = true;
		}
	}

	function disabledDate(date: Date): boolean {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const targetDate = new Date(date);
		targetDate.setHours(0, 0, 0, 0);

		return targetDate > today;
	}

	beforeUpdate(() => {
		if (filterOption) {
			const hasFilter = [
				!!(dateFrom && dateTo),
				!!filterOption.paymentChannel?.find((chn) => chn.checked),
				!!filterOption.salesChannels?.find((s) => s.checked),
				!!filterOption.paymentState?.find((sts) => sts.checked),
				!!filterOption.couriers?.find((c) => c.checked)
			];

			const count = _.countBy(hasFilter, (value) => value);
			filterOption.total = count['true'] ?? 0;
		}
	});

	$: {
		if ($oFilter) {
			filterOption = toInitFilterOrder(oType, $oFilter);
		}
		if ($oFilter.createdDate) {
			dateFrom = new Date($oFilter.createdDate.start);
			dateTo = new Date($oFilter.createdDate.end);
		}
	}

	onMount(() => {
		filterOption = toInitFilterOrder(oType, $oFilter);

		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	const loadKeywords = async () => {
		datePicker.label = await i18nStore.get(
			'patona-sellercenter-myorder-title-daterange',
			$currentLanguage.code,
			'default'
		);
		datePicker.phdFrom = await i18nStore.get(
			'patona-sellercenter-myorder-placeholder-startdate',
			$currentLanguage.code,
			'default'
		);
		datePicker.phdTo = await i18nStore.get(
			'patona-sellercenter-myorder-placeholder-enddate',
			$currentLanguage.code,
			'default'
		);
	};
</script>

{#if filterOption}
	<div class={`popup ${disabled ? 'disabled' : ''}`} data-testid="orders.dropdown.popup-filter">
		<div class="title">
			<ssk-text
				size="xl"
				color="gray.800"
				fontweight="medium"
				data-testid="orders.filter.text.title"
			>
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-button-filter"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-text>
			<ssk-icon
				name="solid-x-mark"
				color="gray.500"
				on:click={() => (disabled = !disabled)}
				data-testid="orders.filter.button.close"
			/>
		</div>
		<div class="body">
			{#if filterOption.createdDate}
				<ssk-range-date-picker
					color="gray"
					label={datePicker.label}
					placeholderFrom={datePicker.phdFrom}
					placeholderTo={datePicker.phdTo}
					format="dd-MM-yyyy"
					on:change={handleDateValue}
					valueFrom={dateFrom}
					valueTo={dateTo}
					error={dateError}
					helperText={dateText}
					themecolor="primary"
					alignCalendar="right"
					widthCalendar="500px"
					{disabledDate}
				></ssk-range-date-picker>
			{/if}
			<ssk-accordion mode="multiple" align="left" themeColor="white">
				{#if filterOption.paymentState}
					<ssk-accordion-item id="payment-state" open>
						<ssk-text slot="title" color="gray.800" fontweight="medium">
							<ssk-i18n-translate
								key="patona-sellercenter-myorder-title-paymentstatus"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
						<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up"
						></ssk-icon>
						<ssk-icon slot="icon-close" size="sm" themeColor="black" name="solid-chevron-down"
						></ssk-icon>
						<div class="item">
							{#each filterOption.paymentState as ps}
								<ssk-checkbox
									label={stateLabels[ps.state]}
									checked={ps.checked}
									color="gray.800"
									testId={`orders.filter.checkbox.payment.${mappedStatuses([ps.state])[0]}`}
									on:change={toggleStateChecked(ps.state, ps.checked)}
								/>
							{/each}
						</div>
					</ssk-accordion-item>
				{/if}
				{#if filterOption.salesChannels}
					<ssk-accordion-item id="sales" open>
						<ssk-text color="gray.800" slot="title" fontweight="medium"> ช่องทางการขาย </ssk-text>
						<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up"
						></ssk-icon>
						<ssk-icon slot="icon-close" size="sm" themeColor="black" name="solid-chevron-down"
						></ssk-icon>
						<div class="section-title">
							<ssk-text color="gray.800"> หน้าร้าน </ssk-text>
						</div>
						<div class="item">
							{#each filterOption.salesChannels.filter( (sc) => groupedChannels.storefront.includes(sc.channel) ) as sc}
								<ssk-checkbox
									label={sc.channel}
									checked={sc.checked}
									color="gray.800"
									data-testid={`orders.filter.checkbox.${sc.channel}`}
									on:change={toggleSalesChecked(sc.channel, sc.checked)}
								/>
							{/each}
						</div>
						<div class="section-title">
							<ssk-text color="gray.800"> ออนไลน์ </ssk-text>
						</div>
						<div class="item">
							{#each filterOption.salesChannels.filter( (sc) => groupedChannels.online.includes(sc.channel) ) as sc}
								<ssk-checkbox
									label={sc.channel}
									checked={sc.checked}
									color="gray.800"
									data-testid={`orders.filter.checkbox.${sc.channel}`}
									on:change={toggleSalesChecked(sc.channel, sc.checked)}
								/>
							{/each}
						</div>
					</ssk-accordion-item>
				{/if}
				{#if filterOption.paymentChannel}
					<ssk-accordion-item id="payment-channel" open>
						<ssk-text color="gray.800" slot="title" fontweight="medium">
							<ssk-i18n-translate
								key="patona-sellercenter-myorder-title-paymentmethod"
								lang={$currentLanguage.code}
								fallbackLang="default"
							/>
						</ssk-text>
						<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up"
						></ssk-icon>
						<ssk-icon slot="icon-close" size="sm" themeColor="black" name="solid-chevron-down"
						></ssk-icon>
						<div class="item">
							{#each filterOption.paymentChannel as pc}
								<ssk-checkbox
									label={channelLabels[pc.channel]}
									checked={pc.checked}
									color="gray.800"
									data-testid={`orders.filter.checkbox.${mappedChannels([pc.channel])[0]}`}
									on:change={toggleChannelChecked(pc.channel, pc.checked)}
								/>
							{/each}
						</div>
					</ssk-accordion-item>
				{/if}
				{#if filterOption.couriers}
					<ssk-accordion-item id="couriers" open>
						<ssk-text color="gray.800" slot="title" fontweight="medium"> บริษัทขนส่ง </ssk-text>
						<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up"
						></ssk-icon>
						<ssk-icon slot="icon-close" size="sm" themeColor="black" name="solid-chevron-down"
						></ssk-icon>
						<div class="section-title">
							<ssk-text color="gray.800"> Standard </ssk-text>
						</div>
						<div class="item">
							{#each filterOption.couriers.filter( (c) => groupedCouriers.standard.includes(c.name) ) as c}
								<ssk-checkbox
									label={courierLabelMap[c.name] ?? c.name}
									checked={c.checked}
									color="gray.800"
									data-testid={`orders.filter.checkbox.${c.name}`}
									on:change={toggleCourierChecked(c.name, c.checked)}
								/>
							{/each}
						</div>
						<div class="section-title">
							<ssk-text color="gray.800"> Same day </ssk-text>
						</div>
						<div class="item">
							{#each filterOption.couriers.filter( (c) => groupedCouriers.sameday.includes(c.name) ) as c}
								<ssk-checkbox
									label={courierLabelMap[c.name] ?? c.name}
									checked={c.checked}
									color="gray.800"
									data-testid={`orders.filter.checkbox.${c.name}`}
									on:change={toggleCourierChecked(c.name, c.checked)}
								/>
							{/each}
						</div>
					</ssk-accordion-item>
				{/if}
			</ssk-accordion>
		</div>
		<div class="footer">
			<ssk-button
				variant="solid-light"
				width="full"
				themeColor="gray"
				on:click={clearFilter}
				data-testid="orders.filter.button.clear"
			>
				<ssk-i18n-translate
					key="patona-sellercenter-myorder-button-clearall"
					lang={$currentLanguage.code}
					fallbackLang="default"
				/>
			</ssk-button>
			<ssk-button
				width="full"
				on:click={applyFilter}
				disabled={dateError}
				data-testid="orders.filter.button.apply"
			>
				<span>
					<ssk-i18n-translate
						key="patona-sellercenter-myorder-button-apply"
						lang={$currentLanguage.code}
						fallbackLang="default"
					/>
					{filterOption.total > 0 ? `(${filterOption.total})` : ''}
				</span>
			</ssk-button>
		</div>
	</div>
{/if}

<style>
	.popup {
		position: absolute;
		right: 0;
		background-color: white;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		margin-top: 4px;
		padding: 1rem;
		display: flex;
		gap: 1rem;
		width: 400px;
		max-height: 508px;
		flex-direction: column;
		z-index: 2;
	}

	.popup.disabled {
		display: none;
	}

	.title {
		display: flex;
		justify-content: space-between;
	}

	.body {
		overflow-y: auto;
		max-height: 500px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-title {
		margin: 0.5rem 0;
	}

	.item {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 1rem;
	}

	.footer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	ssk-icon {
		cursor: pointer;
	}

	ssk-range-date-picker {
		--width-calender: 600px;
	}
</style>
