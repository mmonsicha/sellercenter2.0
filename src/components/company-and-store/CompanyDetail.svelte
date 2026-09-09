<script lang="ts">
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';

	import ImageEditor from '$components/ImageEditor.svelte';
	import CompanyForm from '$components/form/CompanyForm.svelte';
	import AddressForm from '$components/form/AddressForm.svelte';
	import type { Address, Country } from '$lib/entities/address/address';
	import { type Company } from '$lib/entities/company/company';
	import {
		companyData,
		companyList,
		loadCompany,
		makeCompanyAddress,
		makeCompanyDetail,
		makeCompanyLogo
	} from '$stores/company/company';
	import { updateUserConfiguration } from '$stores/configuration';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import { currentStore } from '$stores/store/current-store';
	import { type ICompanyForm } from '$utils/form-validation/company-form';
	import { afterUpdate, getContext, onMount } from 'svelte';
	import { updateCompany } from '../../service/management-rest';
	import { cloneDeep } from 'lodash';

	export let company: Company;
	let companyName: string;
	let disabledSubmit: boolean = true;
	let formChangeTrigger: boolean = false;
	let isValidAddress: boolean = false;
	let isValidCompany: boolean = false;
	let validationError: Record<string, string> = {};
	let currentCountry: Country | undefined;
	let addressFormTouched: boolean = false;

	const toastStore = getContext<ToastStore>('toast');

	async function submitHandler() {
		disabledSubmit = true;

		try {
			await updateCompany($companyData);
			toastStore.addToast({
				message: 'บันทึกข้อมูลสำเร็จ ระบบได้ทำการบันทึกข้อมูลของคุณสำเร็จแล้ว',
				type: 'success',
				timeout: 5000
			});

			await loadCompany();

			const storeIds = company.stores.map((store) => store.id);
			if (!storeIds.includes($currentStore.id)) {
				updateUserConfiguration({
					selectedCompanyId: company.id,
					selectedStoreId: company.stores[0].id
				});
			} else {
				updateUserConfiguration({
					selectedCompanyId: company.id
				});
			}

			companyName = company.name;
			setUnsavedChanges(false);
		} catch (error) {
			toastStore.addToast({
				message: 'เกิดข้อผิดพลาดกรุณาลองใหม่อีกครั้ง',
				type: 'error',
				timeout: 5000
			});
		}
	}

	function validateForm(): boolean {
		return isValidAddress && isValidCompany;
	}

	const onChangeLogo = (c: string) => {
		makeCompanyLogo(c);
		formChangeTrigger = true;
	};

	const onChangeCompany = (c: ICompanyForm) => {
		makeCompanyDetail(c);
		formChangeTrigger = true;
	};

	$: if (addressFormTouched) {
		makeCompanyAddress($companyData.address);
		formChangeTrigger = true;
	}

	onMount(() => {
		if ($companyList.data && $companyList.data.length > 0) {
			let c = $companyList.data?.find((c) => c.id === $companyData.id);
			companyName = c?.name!;
			if (c) $companyData = cloneDeep(c);
		}
	});

	afterUpdate(async () => {
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

		if (formChangeTrigger) {
			setUnsavedChanges(true);
		}
	});
</script>

<div><ssk-text><span>{companyName}</span></ssk-text></div>
<div class="header">
	<ssk-text size="xl">ตั้งค่าบริษัท</ssk-text>
	<ssk-text size="lg" color="gray">ตั้งค่าข้อมูลของคุณ</ssk-text>
</div>
<ssk-divider size="xs" />
<div class="content">
	<ImageEditor
		testId="compony.setting"
		onChangeImg={onChangeLogo}
		title="อัปโหลดรูปบริษัทหรือกิจการ"
		AvatarName={$companyData.logo}
	/>

	<CompanyForm
		testId="company.setting"
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
		formName="company-setting"
	/>

	<ssk-button
		variant="solid"
		size="md"
		type="submit"
		themeColor="primary"
		width="full"
		disabled={disabledSubmit || !formChangeTrigger}
		on:click={async () => {
			await submitHandler();
		}}
	>
		<span>บันทึกข้อมูล</span>
	</ssk-button>
</div>

<style>
	.content {
		padding: 2rem;
	}

	ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}

	.header {
		margin: 1rem 0 2rem;
		display: grid;
		gap: 0.5rem;
	}
</style>
