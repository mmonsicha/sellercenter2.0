<script lang="ts">
	import Container from '$components/CompanyStoreContainer.svelte';
	import { type Company } from '$lib/entities/company/company';
	import { companyData, createCompany, isFirstCompany, loadCompany } from '$stores/company/company';
	import { loadConsent } from '$stores/consent';
	import { getContext, onMount } from 'svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import { acceptTosConsent } from '../../service/management-rest';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { get } from 'svelte/store';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import { currentLanguage } from '$stores/i18n';

	const i18nStore = getContext<I18nStore>('i18n');
	const toastStore = getContext<ToastStore>('toast');

	let next: string;
	let title: string;
	let description: string;
	let accept: string;
	let toastSuccess: string;

	let cTitle: string;
	let cDetail: string;
	let isLoading: boolean = false;
	let companyDetail: Company;
	let existCompanyId: string;
	let firstCompany: boolean;

	const loadKeywords = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';

		title = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader',
			lang,
			fallback
		);
		description = await i18nStore.get(
			'patona-sellercenter-company-create-next-title-description',
			lang,
			fallback
		);
		next = await i18nStore.get(
			'patona-sellercenter-company-create-next-title-next',
			lang,
			fallback
		);
		accept = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader-next',
			lang,
			fallback
		);
		toastSuccess = await i18nStore.get(
			'patona-sellercenter-company-create-toast-successfully',
			lang,
			fallback
		);
	};

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	const location = useLocation();

	location.subscribe((l) => {
		let searchParams = new URLSearchParams(l.search);
		existCompanyId = searchParams.get('company_id') || '';
	});

	companyData.subscribe((v) => {
		companyDetail = v;
	});

	function backUrl() {
		history.back();
	}

	function seperateConsent(consent: string) {
		const htmlConsent = consent.replace(/\[/g, '<').replace(/\]/g, '>');
		cTitle = htmlConsent.match(/<header>(.*?)<\/header>/)?.[1]!!;
		cDetail = htmlConsent
			.replace(/<header>(.*?)<\/header>/, '')
			.replaceAll('<p>', '<p style="margin: 0;">'); // overide style from css browser default
	}

	async function submitConsent() {
		isLoading = true;
		let cId = existCompanyId;
		if (!cId) {
			cId = await createCompany(companyDetail!);
		}
		await acceptTosConsent(cId);

		await loadCompany();
		toastStore.addToast({
			message: toastSuccess,
			type: 'success',
			timeout: 5000,
			testId: 'company.new.toast.success'
		});
		navigate(`/store/new?company_id=${cId}`, { replace: true });
	}

	onMount(async () => {
		firstCompany = get(isFirstCompany);
		seperateConsent(await loadConsent());

		if (!existCompanyId && companyDetail.name == '') {
			navigate('/company/new');
		}
	});
</script>

<Container
	{next}
	{title}
	{description}
	img="/images/logos/company-icon.png"
	testId="company.new.terms.text.header"
>
	<div class="title">
		<ssk-text size="lg" data-testid="company.new.terms.text.header">{cTitle} </ssk-text>
	</div>
	<div class="body">
		<ssk-text color="gray">{@html cDetail}</ssk-text>
	</div>
	<ssk-button
		variant="solid"
		size="md"
		themeColor="primary"
		width="full"
		disabled={isLoading}
		on:click={submitConsent}
		data-testid="company.new.terms.button.accept"
	>
		<span>{accept}</span>
	</ssk-button>
	{#if !firstCompany}
		<ssk-button
			variant="outline"
			themeColor="button"
			size="md"
			width="full"
			on:click={backUrl}
			data-testid="company.new.terms.button.back"
		>
			<span class="first-company">
				<ssk-i18n-translate
					key={'patona-sellercenter-company-button-back'}
					lang={$currentLanguage.code}
					fallbackLang="default"
				></ssk-i18n-translate></span
			>
		</ssk-button>
	{/if}
</Container>

<style>
	.title {
		text-align: center;
	}

	.body {
		height: 25rem;
		overflow-y: scroll;
		background-color: var(--ssk-colors-background-100);
		border-radius: 8px;
		border: 1px solid var(--ssk-colors-gray-100);
		margin: 2rem 0;
		padding: 1rem;
		max-width: 90vh;
		justify-self: center;
	}

	ssk-button > span.first-company {
		color: black;
	}
</style>
