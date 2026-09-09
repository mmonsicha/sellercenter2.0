<script lang="ts">
	import Container from '$components/CompanyStoreContainer.svelte';
	import AddressForm from '$components/form/AddressForm.svelte';
	import CompanyForm from '$components/form/CompanyForm.svelte';
	import ImageEditor from '$components/ImageEditor.svelte';
	import type { Country } from '$lib/entities/address/address';
	import { newCompany } from '$lib/entities/company/company';
	import {
		companyData,
		isFirstCompany,
		makeCompanyAddress,
		makeCompanyDetail,
		makeCompanyLogo
	} from '$stores/company/company';
	import { isPrefillStoreData } from '$stores/store/store';
	import type { ICompanyForm } from '$utils/form-validation/company-form';
	import { getItem, localStorageKey } from '$utils/local-storage';
	import { beforeUpdate } from 'svelte';
	import { navigate } from 'svelte-routing';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { currentLanguage } from '$stores/i18n';
	import { getContext } from 'svelte';

	const i18nStore = getContext<I18nStore>('i18n');

	let next: string;
	let title: string;
	let description: string;
	let titleImage: string;

	let disabledSubmit: boolean = true;
	let isLoading: boolean = false;
	let firstCompany: boolean;
	let isValidAddress: boolean = false;
	let isValidCompany: boolean = false;
	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let addressFormTouched: boolean = false;

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		title = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader',
			lang,
			fallback
		);
		next = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader-next',
			lang,
			fallback
		);
		description = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader-address',
			lang,
			fallback
		);
		titleImage = await i18nStore.get(
			'patona-sellercenter-company-create-input-icon-company',
			lang,
			fallback
		);
	}

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	async function submitHandler() {
		$isPrefillStoreData = true;
		return navigate('/company/tos');
	}

	function backUrl() {
		const back_url = getItem(localStorageKey.PATH_BACK_URL)?.value;
		companyData.set(newCompany());
		navigate(back_url);
	}

	function validateForm(): boolean {
		return isValidAddress && isValidCompany;
	}

	isFirstCompany.subscribe((s) => {
		firstCompany = s;
	});

	const onChangeLogo = (c: string) => {
		makeCompanyLogo(c);
	};

	const onChangeCompany = (c: ICompanyForm) => {
		makeCompanyDetail(c);
	};

	// Update address when form is touched
	$: if (addressFormTouched) {
		makeCompanyAddress($companyData.address);
	}

	beforeUpdate(async () => {
		if (
			// check require field in initial state
			$companyData.name &&
			$companyData.phone &&
			$companyData.address.country?.iso &&
			$companyData.address.postalCode &&
			$companyData.address.street &&
			// check form invalid
			validateForm()
		) {
			disabledSubmit = false;
		} else {
			disabledSubmit = true;
		}
	});
</script>

<Container
	{next}
	{title}
	{description}
	img="/images/logos/company-icon.png"
	testId="company.new.text.header"
>
	<ImageEditor
		testId="company.new"
		onChangeImg={onChangeLogo}
		title={titleImage}
		AvatarName={$companyData.logo}
	/>
	<CompanyForm
		testId="company.new"
		bind:isValidCompany
		company={$companyData}
		onChange={onChangeCompany}
	/>
	<AddressForm
		bind:address={$companyData.address}
		bind:validationError
		bind:currentCountry
		bind:formTouched={addressFormTouched}
		bind:isValid={isValidAddress}
		formName="company-new"
	/>
	<ssk-button
		data-testid="company.new.button.next"
		variant="solid"
		size="md"
		type="submit"
		themeColor="primary"
		width="full"
		disabled={disabledSubmit || isLoading}
		on:click={submitHandler}
	>
		<span>
			<ssk-i18n-translate
				key={'patona-sellercenter-company-button-next'}
				lang={$currentLanguage.code}
				fallbackLang="default"
			></ssk-i18n-translate></span
		>
	</ssk-button>

	{#if !firstCompany}
		<ssk-button
			data-testid="company.new.button.cancel"
			variant="outline"
			themeColor="button"
			size="md"
			width="full"
			on:click={backUrl}
		>
			<span class="first-company">
				<ssk-i18n-translate
					key={'patona-sellercenter-company-button-cancel'}
					lang={$currentLanguage.code}
					fallbackLang="default"
				></ssk-i18n-translate></span
			>
		</ssk-button>
	{/if}
</Container>

<style lang="css">
	ssk-button > span.first-company {
		color: black;
	}
</style>
