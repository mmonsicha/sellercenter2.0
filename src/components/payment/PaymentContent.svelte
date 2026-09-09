<script lang="ts">
	import RadioGroup from '$components/RadioGroup.svelte';
	import type { Payment } from '$lib/entities/sale/sale';
	import { currentLanguage } from '$stores/i18n';
	import { updatePayment } from '$stores/payment';
	import { initPaymentForm, paymentFormSchema } from '$utils/form-validation/payment-form';
	import { formatPriceWithBath } from '$utils/format-number';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { createForm } from 'svelte-forms-lib';

	const i18nStore = getContext<I18nStore>('i18n');

	let cardOptions = [
		{
			id: 'credit-card',
			value: 'creditCard',
			label: 'patona-sellercenter-modal-payment-tab-card-radio-credit'
		},
		{
			id: 'debit-card',
			value: 'debitCard',
			label: 'patona-sellercenter-modal-payment-tab-card-radio-debit'
		}
	];

	export let info: Payment;
	export let tabIndex: number;
	let prevInfoType: string | undefined;
	let received = {
		phd: '',
		label: '',
		error: ''
	};
	let ref = {
		phd: '',
		label: '',
		error: ''
	};
	let note = {
		phd: '',
		label: '',
		error: ''
	};

	const { form, errors, handleChange, handleReset, updateInitialValues } = createForm({
		initialValues: initPaymentForm(info),
		validationSchema: paymentFormSchema,
		onSubmit: (values) => {
			// alert(JSON.stringify(values));
		}
	});

	$: if (info.type !== prevInfoType) {
		handleReset();
		updateInitialValues(initPaymentForm(info));
		prevInfoType = info.type;
	}

	function _onChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const fieldName = target.name;
		let value: number | string = target.value.trimStart();

		if (fieldName === 'received') {
			value = value.replace(/[^\d.]/g, '');
			const parts = value.split('.');
			if (parts.length > 2) {
				value = parts[0] + '.' + parts.slice(1).join('');
			}
			if (parts[1]) {
				value = parts[0] + '.' + parts[1].substring(0, 2);
			}
		}
		target.value = value as string;
		handleChange(e);

		if (typeof $form.received === 'string') {
			$form.received = isNaN(parseFloat($form.received)) ? undefined : parseFloat($form.received);
		}

		updatePayment($form);
		loadKeywords();
	}

	function _onChangeType(value: string) {
		updatePayment({
			type: value,
			ref: '',
			note: ''
		});
	}

	const loadKeywords = async () => {
		received.label = await i18nStore.get(
			'patona-sellercenter-modal-payment-tab-cash-title-amountreceived',
			$currentLanguage.code,
			'default'
		);
		received.phd = await i18nStore.get(
			'patona-sellercenter-modal-payment-tab-cash-placeholder-received',
			$currentLanguage.code,
			'default'
		);
		received.error = await i18nStore.get($errors.received, $currentLanguage.code, 'default');
		ref.label = await i18nStore.get(
			'patona-sellercenter-modal-payment-title-refcode',
			$currentLanguage.code,
			'default'
		);
		ref.phd = await i18nStore.get(
			'patona-sellercenter-modal-payment-placeholder-refcode',
			$currentLanguage.code,
			'default'
		);
		ref.error = await i18nStore.get($errors.ref, $currentLanguage.code, 'default');
		note.label = await i18nStore.get(
			'patona-sellercenter-modal-payment-title-note',
			$currentLanguage.code,
			'default'
		);
		note.phd = await i18nStore.get(
			'patona-sellercenter-modal-payment-placeholder-note',
			$currentLanguage.code,
			'default'
		);
		note.error = await i18nStore.get($errors.note, $currentLanguage.code, 'default');
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
		convertCardOptions();
	}

	async function fetchDataKeyword(keywordToTranslate: string): Promise<string> {
		let result = await i18nStore.get(keywordToTranslate, $currentLanguage.code, 'default');
		return result;
	}

	async function convertCardOptions() {
		const updatedCardOptions = await Promise.all(
			cardOptions.map(async (option) => {
				const translatedLabel = await fetchDataKeyword(option.label);
				return { ...option, label: translatedLabel };
			})
		);
		cardOptions = updatedCardOptions;
	}
</script>

<div class="payment-header">
	<ssk-text align="center">
		<ssk-i18n-translate
			key="patona-sellercenter-modal-payment-title-amountpaid"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-text>
	<ssk-text color="primary" size="5xl" align="center">
		{formatPriceWithBath(info.total)}
	</ssk-text>
	{#if tabIndex === 1 || tabIndex === 2 || tabIndex === 3}
		<ssk-text align="center" size="xl">
			<ssk-i18n-translate
				key="patona-sellercenter-modal-payment-title-awaitingpayment"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
	{/if}
</div>
{#if tabIndex === 1 || tabIndex === 2 || tabIndex === 3}
	<div class="payment-body">
		{#if tabIndex === 2}
			<RadioGroup
				label=""
				name="cards-dd"
				template={2}
				require={false}
				defaultValue={info.type}
				options={cardOptions}
				onChange={(v) => _onChangeType(v.value)}
			/>
		{/if}
		<ssk-input
			name="ref"
			label={ref.label}
			placeholder={ref.phd}
			value={$form.ref}
			helperText={!!$errors.ref ? ref.error : ''}
			error={!!$errors.ref}
			on:input={_onChange}
			on:change={_onChange}
		/>

		<ssk-textarea
			name="note"
			label={note.label}
			placeholder={note.phd}
			limit="255"
			size="md"
			value={$form.note}
			helperText={!!$errors.note ? note.error : ''}
			error={!!$errors.note}
			on:input={_onChange}
			on:change={_onChange}
		></ssk-textarea>
	</div>
{:else}
	<div class="payment-body">
		<ssk-input
			name="received"
			label={received.label}
			placeholder={received.phd}
			value={$form.received ?? 0}
			helperText={!!$errors.received ? received.error : ''}
			error={!!$errors.received}
			on:input={_onChange}
			on:change={_onChange}
			required
		/>
	</div>
	<div class="payment-footer">
		<ssk-text>
			<ssk-i18n-translate
				key="patona-sellercenter-modal-payment-tab-cash-summary-amountreceived"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<div class="right"><ssk-text>{formatPriceWithBath($form.received ?? 0)}</ssk-text></div>
		<ssk-text>
			<ssk-i18n-translate
				key="patona-sellercenter-modal-payment-tab-cash-summary-change"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-text>
		<div class="right"><ssk-text color="primary">{formatPriceWithBath(info.change)}</ssk-text></div>
	</div>
{/if}

<style lang="css">
	.payment-body {
		padding-top: 16px;
		gap: 16px;
		display: flex;
		flex-direction: column;
	}

	.payment-footer {
		margin-top: 16px;
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		color: var(--ssk-colors-gray-500);
		padding: 1rem;
		gap: 0.5rem;
		display: grid;
		grid-template-columns: auto auto;
	}

	.right {
		text-align: right;
	}

	ssk-textarea {
		--min-height: 4rem;
		--min-width: full;
		--resize: vertical;
		--background-color: white;
	}
</style>
