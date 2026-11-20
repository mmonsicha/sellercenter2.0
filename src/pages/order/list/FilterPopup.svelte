<script lang="ts">
	// OMS 2.0 filter popup (DES-2235): channel / payment status / fulfillment /
	// order status (per tab) / stock + date range. Replaces the legacy payment-method
	// and courier filters. Channel options come from data, never a hardcoded list.
	import { currentLanguage } from '$stores/i18n';
	import {
		isClearSearchFilter,
		oFilter,
		resetFilterOptions,
		setFilter,
		setIsClearSearchOrderFilter,
		countActiveFilters,
		type FilterGroup,
		type OrderFilterOptions
	} from '$stores/order/filter';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext, onMount } from 'svelte';
	import {
		ChannelGroup,
		FulfillmentType,
		Oms2OrderStatus,
		Oms2PaymentStatus,
		Oms2Tab,
		StockState,
		TAB_STATUSES,
		type Oms2Channel
	} from '$lib/entities/order/oms2-order-list';
	import { mockOms2Channels } from '$lib/mock/mock-oms2-orders';
	import { orderStatusKey, paymentStatusKey, stockKey } from './order-tab';

	export let disabled: boolean = true;
	export let tab: Oms2Tab;

	const i18nStore = getContext<I18nStore>('i18n');

	type Option = { value: string; labelKey?: string; label?: string };
	type Section = {
		group: FilterGroup;
		titleKey: string;
		options: Option[];
		subgroups?: { titleKey: string; options: Option[] }[];
	};

	// API bypassed: channel list from the mock source. Swap for the store-channels API later.
	const channels: Oms2Channel[] = mockOms2Channels();
	const CHANNEL_GROUP_KEY: Record<ChannelGroup, string> = {
		[ChannelGroup.Store]: 'oms.order.filter.channel_group.store',
		[ChannelGroup.Online]: 'oms.order.filter.channel_group.online',
		[ChannelGroup.Link]: 'oms.order.filter.channel_group.link'
	};

	const enumOptions = (values: string[], key: (v: string) => string): Option[] =>
		values.map((v) => ({ value: v, labelKey: key(v) }));

	// Order-status options only make sense where the tab holds more than one status.
	const statusOptionsFor = (t: Oms2Tab): Option[] => {
		const list = TAB_STATUSES[t] ?? Object.values(Oms2OrderStatus);
		return list.length > 1 ? enumOptions(list, (v) => orderStatusKey(v as Oms2OrderStatus)) : [];
	};

	$: sections = [
		{
			group: 'channels',
			titleKey: 'patona-sellercenter-myorder-table-header-saleschannel',
			options: [],
			subgroups: (Object.values(ChannelGroup) as ChannelGroup[])
				.map((g) => ({
					titleKey: CHANNEL_GROUP_KEY[g],
					options: channels
						.filter((c) => c.group === g)
						.map((c) => ({ value: c.id, label: c.name }))
				}))
				.filter((s) => s.options.length)
		},
		{
			group: 'paymentStatuses',
			titleKey: 'patona-sellercenter-myorder-title-paymentstatus',
			options: enumOptions(Object.values(Oms2PaymentStatus), (v) =>
				paymentStatusKey(v as Oms2PaymentStatus)
			)
		},
		{
			group: 'fulfillments',
			titleKey: 'oms.order.header.fulfillment',
			options: enumOptions(Object.values(FulfillmentType), (v) => `oms.order.fulfillment.${v}`)
		},
		{
			group: 'statuses',
			titleKey: 'patona-sellercenter-myorder-table-header-orderstatus',
			options: statusOptionsFor(tab)
		},
		{
			group: 'stocks',
			titleKey: 'oms.order.header.stock',
			options: enumOptions([StockState.Reserved, StockState.Partial, StockState.Deducted], (v) =>
				stockKey(v as StockState)
			)
		}
	].filter((s) => s.options.length || s.subgroups?.length) as Section[];

	// ssk-checkbox takes a plain string label, so resolve i18n keys up front.
	let labels: Record<string, string> = {};
	async function loadLabels(lang: string, secs: Section[]) {
		const keys = new Set<string>([
			'patona-sellercenter-myorder-title-daterange',
			'patona-sellercenter-myorder-placeholder-startdate',
			'patona-sellercenter-myorder-placeholder-enddate'
		]);
		for (const s of secs) {
			for (const o of [...s.options, ...(s.subgroups ?? []).flatMap((g) => g.options)])
				if (o.labelKey) keys.add(o.labelKey);
		}
		// One getAll() read instead of N parallel get()s — concurrent IDB gets came back
		// as raw keys in practice.
		// Shape differs by store version: nested {key:{lang}} or flat {"key-lang": value}.
		const all = ((await i18nStore.getAll()) ?? {}) as Record<string, unknown>;
		const pick = (k: string): string => {
			const nested = all[k] as Record<string, string> | undefined;
			const flat = (l: string) => all[`${k}-${l}`] as string | undefined;
			return nested?.[lang] ?? nested?.default ?? flat(lang) ?? flat('default') ?? k;
		};
		labels = Object.fromEntries([...keys].map((k) => [k, pick(k)] as const));
	}
	// Also re-resolve on open: keywords may still be loading when the page first mounts.
	$: if ($currentLanguage.code) loadLabels($currentLanguage.code, sections);
	$: if (!disabled) loadLabels($currentLanguage.code, sections);

	// Draft selection — committed to the store only on Apply.
	let draft: Record<FilterGroup, string[]> = emptyDraft();
	let dateFrom: Date | undefined;
	let dateTo: Date | undefined;

	function emptyDraft(): Record<FilterGroup, string[]> {
		return { channels: [], paymentStatuses: [], fulfillments: [], statuses: [], stocks: [] };
	}

	function syncFromStore() {
		draft = {
			channels: [...($oFilter.channels ?? [])],
			paymentStatuses: [...($oFilter.paymentStatuses ?? [])],
			fulfillments: [...($oFilter.fulfillments ?? [])],
			statuses: [...($oFilter.statuses ?? [])],
			stocks: [...($oFilter.stocks ?? [])]
		};
		dateFrom = $oFilter.createdDate ? new Date($oFilter.createdDate.start) : undefined;
		dateTo = $oFilter.createdDate ? new Date($oFilter.createdDate.end) : undefined;
	}

	// Re-sync whenever the popup opens or the committed filter changes (URL/back nav).
	$: if ($oFilter && disabled) syncFromStore();

	const toggle = (g: FilterGroup, v: string) => {
		const cur = draft[g];
		draft = { ...draft, [g]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
	};

	const isFuture = (date?: Date) => {
		if (!date) return false;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		return d > today;
	};
	const disabledDate = (date: Date) => isFuture(date);

	$: dateOrderError = !!(dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime());
	$: dateError = dateOrderError || isFuture(dateFrom) || isFuture(dateTo);

	$: draftOptions = {
		...draft,
		createdDate:
			dateFrom && dateTo ? { start: dateFrom.toISOString(), end: dateTo.toISOString() } : undefined
	} as OrderFilterOptions;
	$: draftCount = countActiveFilters(draftOptions);

	function handleDateValue(e: CustomEvent) {
		dateFrom = e.detail.valueFrom;
		dateTo = e.detail.valueTo;
	}

	function clearFilter() {
		draft = emptyDraft();
		dateFrom = undefined;
		dateTo = undefined;
		resetFilterOptions();
	}

	function applyFilter() {
		setFilter(draftOptions);
		disabled = true;
	}

	$: if ($isClearSearchFilter) {
		draft = emptyDraft();
		dateFrom = undefined;
		dateTo = undefined;
		setIsClearSearchOrderFilter(false);
	}

	function handleClickOutside(e: Event) {
		if (!(e.target as HTMLElement).closest('.filter')) disabled = true;
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	// `labels` is passed in explicitly: Svelte only re-renders a template call when one of
	// its arguments changes, so reading it from the closure left labels stuck on raw keys.
	const optLabel = (o: Option, l: Record<string, string>) =>
		o.label ?? (o.labelKey ? l[o.labelKey] ?? o.labelKey : o.value);
</script>

<div class={`popup ${disabled ? 'disabled' : ''}`} data-testid="orders.dropdown.popup-filter">
	<div class="title">
		<ssk-text size="xl" color="gray.800" fontweight="medium" data-testid="orders.filter.text.title">
			<ssk-i18n-translate
				key="patona-sellercenter-myorder-button-filter"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<ssk-icon
			name="solid-x-mark"
			color="gray.500"
			on:click={() => (disabled = true)}
			data-testid="orders.filter.button.close"
		/>
	</div>
	<div class="body">
		<ssk-range-date-picker
			color="gray"
			label={labels['patona-sellercenter-myorder-title-daterange'] ?? ''}
			placeholderFrom={labels['patona-sellercenter-myorder-placeholder-startdate'] ?? ''}
			placeholderTo={labels['patona-sellercenter-myorder-placeholder-enddate'] ?? ''}
			format="dd-MM-yyyy"
			on:change={handleDateValue}
			valueFrom={dateFrom}
			valueTo={dateTo}
			error={dateError}
			helperText={dateOrderError ? 'วันที่เริ่มต้นต้องอยู่ก่อนวันที่สิ้นสุด' : ''}
			themecolor="primary"
			alignCalendar="right"
			widthCalendar="500px"
			{disabledDate}
		></ssk-range-date-picker>
		<ssk-accordion mode="multiple" align="left" themeColor="white">
			{#each sections as s (s.group)}
				<ssk-accordion-item id={`filter-${s.group}`} open>
					<ssk-text slot="title" color="gray.800" fontweight="medium">
						<ssk-i18n-translate
							key={s.titleKey}
							lang={$currentLanguage.code}
							fallbackLang="default"
						/>
					</ssk-text>
					<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up"
					></ssk-icon>
					<ssk-icon slot="icon-close" size="sm" themeColor="black" name="solid-chevron-down"
					></ssk-icon>
					{#if s.subgroups}
						{#each s.subgroups as sg}
							<div class="section-title">
								<ssk-text color="gray.800">
									<ssk-i18n-translate
										key={sg.titleKey}
										lang={$currentLanguage.code}
										fallbackLang="default"
									/>
								</ssk-text>
							</div>
							<div class="item">
								{#each sg.options as o (o.value)}
									<ssk-checkbox
										label={optLabel(o, labels)}
										checked={draft[s.group].includes(o.value)}
										color="gray.800"
										testId={`orders.filter.checkbox.${s.group}.${o.value}`}
										on:change={() => toggle(s.group, o.value)}
									/>
								{/each}
							</div>
						{/each}
					{:else}
						<div class="item">
							{#each s.options as o (o.value)}
								<ssk-checkbox
									label={optLabel(o, labels)}
									checked={draft[s.group].includes(o.value)}
									color="gray.800"
									testId={`orders.filter.checkbox.${s.group}.${o.value}`}
									on:change={() => toggle(s.group, o.value)}
								/>
							{/each}
						</div>
					{/if}
				</ssk-accordion-item>
			{/each}
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
				{draftCount > 0 ? `(${draftCount})` : ''}
			</span>
		</ssk-button>
	</div>
</div>

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
		max-width: calc(100vw - 32px);
		max-height: 560px;
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
