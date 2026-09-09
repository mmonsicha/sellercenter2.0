<script lang="ts">
	import Container from '$components/CompanyStoreContainer.svelte';
	import AddressForm from '$components/form/AddressForm.svelte';
	import StoreForm from '$components/form/StoreForm.svelte';
	import type { Country } from '$lib/entities/address/address';
	import { newCompany, type Company } from '$lib/entities/company/company';
	import { newStore, type Store } from '$lib/entities/store/store';
	import {
		companyData,
		getCompanyDetailById,
		isFirstCompany,
		loadCompany
	} from '$stores/company/company';
	import { configurationStore, updateUserConfiguration } from '$stores/configuration';
	import { currentLanguage } from '$stores/i18n';
	import {
		createStore,
		isPrefillStoreData,
		makeStoreAddress,
		makeStoreDetail,
		setPrefillStoreData,
		storeData
	} from '$stores/store/store';
	import type { IStoreForm } from '$utils/form-validation/store-form';
	import { getItem, localStorageKey } from '$utils/local-storage';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { beforeUpdate, getContext, onDestroy, onMount } from 'svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import { get } from 'svelte/store';

	const i18nStore = getContext<I18nStore>('i18n');
	const toastStore = getContext<ToastStore>('toast');
	const location = useLocation();

	let next: string;
	let title: string;
	let description: string;

	let toastSuccess: string;
	let toastError: string;

	let textButtonSubmit: string;
	let textButtonCancel: string;

	let companyId: string;
	let disabledSubmit: boolean = true;
	let isLoading: boolean = false;
	let storeDetail: Store;
	let selectedCompany: Company | undefined;
	let firstCompany: boolean;
	let isValidAddress: boolean = false;
	let isValidStore: boolean = false;
	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let addressFormTouched: boolean = false;

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		title = await i18nStore.get(
			'patona-sellercenter-store-create-title-storeheader',
			lang,
			fallback
		);
		next = await i18nStore.get(
			'patona-sellercenter-store-create-title-storeheader-next',
			lang,
			fallback
		);
		description = await i18nStore.get(
			'patona-sellercenter-store-create-title-storeheader-address',
			lang,
			fallback
		);
		toastSuccess = await i18nStore.get(
			'patona-sellercenter-store-create-toast-successfully',
			lang,
			fallback
		);
		toastError = await i18nStore.get(
			'patona-sellercenter-store-create-toast-tryagain',
			lang,
			fallback
		);
		textButtonSubmit = await i18nStore.get(
			'patona-sellercenter-store-create-button-start',
			lang,
			fallback
		);
		textButtonCancel = await i18nStore.get(
			'patona-sellercenter-store-create-button-cancel',
			lang,
			fallback
		);
	}

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	location.subscribe((l) => {
		let searchParams = new URLSearchParams(l.search);
		companyId = searchParams.get('company_id') || $configurationStore.data?.user?.selectedCompanyId;
	});

	function backUrl() {
		const back_url = getItem(localStorageKey.PATH_BACK_URL)?.value;
		companyData.set(newCompany());
		navigate(back_url);
	}

	async function submitHandler() {
		storeData.subscribe((v) => {
			storeDetail = v;
		});

		try {
			isLoading = true;
			const storeId = await createStore(companyId, storeDetail!);
			isLoading = false;
			await loadCompany();

			// set current company and store
			updateUserConfiguration({
				selectedCompanyId: companyId,
				selectedStoreId: storeId
			});

			toastStore.addToast({
				message: toastSuccess,
				type: 'success',
				timeout: 5000,
				testId: 'store.new.toast.success'
			});

			companyData.set(newCompany());
			return navigate('/');
		} catch (error) {
			toastStore.addToast({
				message: toastError,
				type: 'error',
				timeout: 5000
			});
			isLoading = false;
		}
	}

	function validateForm(): boolean {
		return isValidAddress && isValidStore;
	}

	onMount(async () => {
		firstCompany = get(isFirstCompany);
	});

	$: {
		if ($isPrefillStoreData) {
			selectedCompany = getCompanyDetailById(companyId);

			if (selectedCompany) {
				$storeData.phone = selectedCompany.phone;
				$storeData.phone2 = selectedCompany.phone2;
				$storeData.address = selectedCompany.address;
			}
		}
	}

	// Update address when form is touched
	$: if (addressFormTouched) {
		makeStoreAddress($storeData.address);
	}

	const onChangeStore = (c: IStoreForm) => {
		makeStoreDetail(c);
	};

	onDestroy(() => {
		storeData.set(newStore());
		setPrefillStoreData(false);
	});

	beforeUpdate(async () => {
		if (
			// check require field in initial state
			$storeData.name &&
			$storeData.phone &&
			$storeData.address.country?.iso &&
			$storeData.address.postalCode &&
			$storeData.address.street &&
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
	img="/images/logos/store-icon.png"
	testId="store.new.input.identifier"
>
	<!-- Svelte นะไม่ใช่ React onChange onChange onChange onChange onChange onChange -->
	<StoreForm bind:isValidStore store={$storeData} onChange={onChangeStore} testId="store.new" />
	<AddressForm
		bind:address={$storeData.address}
		bind:validationError
		bind:currentCountry
		bind:formTouched={addressFormTouched}
		bind:isValid={isValidAddress}
		formName=""
	/>
	<div class="footer">
		<ssk-button
			data-testid="store.new.button.start"
			variant="solid"
			size="md"
			type="submit"
			themeColor="primary"
			width="full"
			gap="1rem"
			disabled={disabledSubmit || isLoading}
			on:click={submitHandler}
		>
			<span>{textButtonSubmit}</span>
		</ssk-button>

		{#if !firstCompany}
			<ssk-button
				data-testid="store.new.button.cancel"
				variant="outline"
				themeColor="button"
				size="md"
				width="full"
				on:click={backUrl}
			>
				<span class="first-company">{textButtonCancel}</span>
			</ssk-button>
		{/if}
	</div>
</Container>

<style>
	.footer {
		display: grid;
		gap: 1rem;
	}

	ssk-button > span.first-company {
		color: black;
	}
</style>
