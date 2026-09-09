<script lang="ts">
	import AddressForm from '$components/form/AddressForm.svelte';
	import StoreForm from '$components/form/StoreForm.svelte';
	import Modal from '$components/modal/Modal.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import type { Country } from '$lib/entities/address/address';
	import type { Company } from '$lib/entities/company/company';
	import { type Store } from '$lib/entities/store/store';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { companyData, getCompanyDetailById, loadCompany } from '$stores/company/company';
	import { configurationStore, updateUserConfiguration } from '$stores/configuration';
	import { setAction, setUnsavedChanges } from '$stores/saved-changes';
	import { setSettingFormatWithIso } from '$stores/settings';
	import { currentStore, updateDataCurrentStore } from '$stores/store/current-store';
	import type { IStoreForm } from '$utils/form-validation/store-form';
	import { getItem, localStorageKey, setItem } from '$utils/local-storage';
	import { checkPermissionsEach } from '$utils/permission';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { afterUpdate, getContext, onMount } from 'svelte';
	import { navigate } from 'svelte-routing';
	import { deleteStore, updateStore } from '../../../service/management-rest';
	import { cloneDeep } from 'lodash';

	export let company: Company;

	let disabledSubmit: boolean = true;
	let expandedIndex: number = initExpanded();
	let showModalTrash: boolean = false;
	let showModalNotice: boolean = false;
	let storeDetails: Store[] = [];
	let formChangeTrigger: boolean = false;
	let branchId: string = '';
	let isOnlyOneStore: boolean;
	let isValidAddresses: boolean[] = [];
	let isValidStores: boolean[] = [];
	let validationErrors: Record<string, string>[] = [];
	let currentCountries: (Country | undefined)[] = [];
	let addressFormTouched: boolean[] = [];
	let canCreate = false;
	let isForbidden = false;
	let loadPermissionPromise: Promise<void> | null = null;
	let lastPermissionCompanyId: string | null = null;
	let permissionCheckInFlight: Promise<void> | null = null;

	const toastStore = getContext<ToastStore>('toast');

	function initializeFormState() {
		validationErrors = storeDetails.map(() => ({}));
		currentCountries = storeDetails.map(() => undefined);
		addressFormTouched = storeDetails.map(() => false);
		isValidAddresses = storeDetails.map(() => true);
		isValidStores = storeDetails.map(() => true);
	}

	function updateExpandedIndex() {
		const store = $currentStore;
		const index = storeDetails.findIndex((s) => s.id === store?.id);
		expandedIndex = index >= 0 ? index : storeDetails.length > 0 ? 0 : -1;
	}

	function setDeletedBranchId(id: string) {
		branchId = id;
	}

	function getAccordionItemId(branch: Store, index: number) {
		return branch.id ? `store-${branch.id}` : `store-${index}`;
	}

	function handleAccordionChange(e: CustomEvent<{ openItems: string[] }>) {
		const openId = e.detail?.openItems?.[0];
		if (!openId) {
			return;
		}

		const index = storeDetails.findIndex((branch, i) => getAccordionItemId(branch, i) === openId);
		expandedIndex = index;
	}

	function initExpanded(): number {
		let currStoreId: string;
		let index: number = 0;

		currentStore.subscribe((s) => {
			if (s?.id) {
				currStoreId = s.id;
			}
		});

		companyData.subscribe((c) => {
			if (c.stores && c.stores.length > 0) {
				index = c.stores.findIndex((s) => s.id === currStoreId);
			}
		});

		return index;
	}

	function toggleModalTrash() {
		showModalTrash = !showModalTrash;
	}

	function toggleModalNotice() {
		showModalNotice = !showModalNotice;
	}

	async function removeStore() {
		try {
			await deleteStore(branchId);
			await loadCompany();
			const cm = await getCompanyDetailById(company?.id!);
			if (cm) {
				company = cm;
			}

			setItem(localStorageKey.DELETED_BRANCH_ID_STORAGE_KEY, branchId);

			if (branchId === $configurationStore?.data?.user?.selectedStoreId) {
				updateUserConfiguration({
					selectedStoreId: company.stores[0]?.id
				});
			}

			toastStore.addToast({
				message: 'ระบบได้ทำการนำสาขาของคุณออกแล้ว',
				type: 'success',
				timeout: 5000
			});
			branchId = '';
		} catch (error) {
			toastStore.addToast({
				message: 'เกิดข้อผิดพลาดกรุณาลองใหม่อีกครั้ง',
				type: 'error',
				timeout: 5000
			});
		} finally {
			showModalTrash = false;
		}
	}

	async function submitHandler() {
		disabledSubmit = true;
		try {
			await Promise.all(storeDetails.map(async (s) => updateStore(s)));
			toastStore.addToast({
				message: 'บันทึกข้อมูลสำเร็จ ระบบได้ทำการบันทึกข้อมูลของคุณสำเร็จแล้ว',
				type: 'success',
				timeout: 5000
			});

			await loadCompany();
			updateDataCurrentStore();

			updateUserConfiguration({
				selectedCompanyId: company.id
			});

			setUnsavedChanges(false);

			company.stores = [...storeDetails];
		} catch (error: any) {
			// not found store or was deleted
			if (error.response.data.error === 'pg: no rows in result set') {
				showModalNotice = true;
			} else {
				toastStore.addToast({
					message: 'เกิดข้อผิดพลาดกรุณาลองใหม่อีกครั้ง',
					type: 'error',
					timeout: 5000
				});
			}
		}
	}

	const onChangeStore = (c: IStoreForm, index: number) => {
		storeDetails[index] = {
			...storeDetails[index],
			name: c.name,
			code: c.code,
			isSystemCode: c.isSystemCode as boolean,
			phone: c.phone,
			phone2: c.phone2
		};

		formChangeTrigger = true;
	};

	// Update store details when address forms are touched
	$: {
		for (let i = 0; i < addressFormTouched.length; i++) {
			if (addressFormTouched[i]) {
				formChangeTrigger = true;
			}
		}
	}

	const validateIsValidForm = (): boolean => {
		return isValidAddresses.concat(isValidStores).every((v) => v);
	};

	function newStore() {
		let path = `/store/new?company_id=${company.id}`;
		if (!company.tosId) path = `/company/tos?company_id=${company.id}`;

		setItem(localStorageKey.PATH_BACK_URL, '/settings');
		setAction(() => navigate(path));
	}

	function handlerNoticeCloseModal() {
		toggleModalNotice();
		window.location.reload();
	}

	async function checkStoreUpdatePermissions(stores: Store[]) {
		const storesWithId = stores.filter((store) => Boolean(store.id));
		const permissionResults = await Promise.all(
			storesWithId.map((store) =>
				checkPermissionsEach(ScopePermissions.patonaStore, store.id as string, [
					EntityPermission.STOREUPDATE
				])
			)
		);

		const storePermissionMap = permissionResults.reduce<Record<string, boolean>>(
			(acc, result, index) => {
				const storeId = storesWithId[index]?.id;
				if (storeId) {
					acc[storeId] = Boolean(result[EntityPermission.STOREUPDATE]);
				}
				return acc;
			},
			{}
		);

		storeDetails = cloneDeep(
			storesWithId.filter((store) => storePermissionMap[store.id as string])
		);
		isForbidden = storeDetails.length === 0;
		initializeFormState();
		updateExpandedIndex();
	}

	async function checkPermission(companyId: string) {
		await waitForDialogPermissionReady(companyId);
		try {
			const data = await checkPermissionsEach(ScopePermissions.sellsukiCompany, companyId, [
				EntityPermission.STORECREATE,
				EntityPermission.SELLSUKISTOREUPDATE
			]);
			if (companyId !== lastPermissionCompanyId) {
				return;
			}
			canCreate = data[EntityPermission.STORECREATE];
			isForbidden = false;
			if (!data[EntityPermission.SELLSUKISTOREUPDATE]) {
				await checkStoreUpdatePermissions(company.stores);
				return;
			}
		} catch (error) {
			if (companyId !== lastPermissionCompanyId) {
				return;
			}
			canCreate = false;
			isForbidden = true;
			console.error('Error checking permissions:', error);
			return;
		}

		if (companyId !== lastPermissionCompanyId) {
			return;
		}
		storeDetails = cloneDeep(company.stores);
		initializeFormState();
		updateExpandedIndex();
	}

	onMount(() => {
		storeDetails = cloneDeep(company.stores);
		initializeFormState();
		updateExpandedIndex();
	});

	$: if (company?.id) {
		if (lastPermissionCompanyId !== company.id) {
			lastPermissionCompanyId = company.id;
			permissionCheckInFlight = checkPermission(company.id).finally(() => {
				if (lastPermissionCompanyId === company.id) {
					permissionCheckInFlight = null;
				}
			});
		}
		loadPermissionPromise = permissionCheckInFlight;
	} else {
		canCreate = false;
		isForbidden = false;
		loadPermissionPromise = null;
		permissionCheckInFlight = null;
	}

	afterUpdate(() => {
		isOnlyOneStore = storeDetails.length == 1;
		if (expandedIndex != -1 && !formChangeTrigger) {
			// set only first time store form rendering
			setSettingFormatWithIso(storeDetails[expandedIndex].address.country?.iso);
		}

		if (
			storeDetails.every(
				(store) =>
					store.name &&
					store.phone &&
					store.address.country?.iso &&
					store.address.postalCode &&
					store.address.street
			) &&
			validateIsValidForm()
		) {
			disabledSubmit = false;
		} else {
			disabledSubmit = true;
		}

		if (formChangeTrigger) {
			setUnsavedChanges(true);
		}
	});

	function checkDeletedStore() {
		const deletedBranchId = getItem(localStorageKey.DELETED_BRANCH_ID_STORAGE_KEY)?.value;
		const isDeletedBranchExist = storeDetails.some((branch) => branch.id === deletedBranchId);

		if (isDeletedBranchExist) {
			showModalNotice = true;
		}
	}
</script>

{#if company?.id}
	{#await loadPermissionPromise}
		<LoadingPage description="กำลังโหลดข้อมูล..." />
	{:then}
		{#if isForbidden}
			<PermissionDenied />
		{:else}
			<div on:mouseenter={checkDeletedStore} on:mouseleave={checkDeletedStore}>
				<div class="content">
					<Modal
						toggleModal={toggleModalTrash}
						id="trash"
						icon="outline-trash"
						iconColor="#ef4444"
						ShowModal={showModalTrash}
						title="นำสาขาออก"
						body="<center>การนำสาขาออกจะลบการแสดงผลสาขาของคุณ<br>แต่ข้อมูลบางส่วนจะยังถูกเก็บไว้ในระบบ</center>"
						typeFooter="vertical"
					>
						<ssk-button
							width="full"
							themeColor="red"
							slot="modal-footer-left"
							on:click={removeStore}
						>
							นำสาขาออก
						</ssk-button>
						<ssk-button
							width="full"
							slot="modal-footer-right"
							variant="outline"
							themeColor="button"
							on:click={toggleModalTrash}
						>
							<span>ยกเลิก</span>
						</ssk-button>
					</Modal>

					<Modal
						id="notice"
						toggleModal={handlerNoticeCloseModal}
						ShowModal={showModalNotice}
						title="สาขาถูกนำออกแล้ว"
						body="<center>สาขาที่คุณใช้งานอยู่ได้ถูกนำออกแล้ว<br/>ไม่สามารถใช้งานได้อีกต่อไป</center>"
						typeFooter="vertical"
					>
						<ssk-button
							width="full"
							themeColor="primary"
							slot="modal-footer-left"
							on:click={handlerNoticeCloseModal}
						>
							ตกลง
						</ssk-button>
					</Modal>

					<div class="accordion-container">
						<ssk-accordion mode="single" align="left" on:change={handleAccordionChange}>
							{#each storeDetails as branch, i}
								<ssk-accordion-item id={getAccordionItemId(branch, i)} open={expandedIndex === i}>
									<div slot="title" class="accordion-title">
										<ssk-text fontweight="medium" color="gray.800">
											{company.stores.find((store) => store.id === branch.id)?.name ?? branch.name}
										</ssk-text>
									</div>
									<ssk-icon slot="icon-open" size="sm" themeColor="black" name="solid-chevron-up">
									</ssk-icon>
									<ssk-icon
										slot="icon-close"
										size="sm"
										themeColor="black"
										name="solid-chevron-down"
									>
									</ssk-icon>
									{#if expandedIndex === i}
										<div class="">
											<StoreForm
												testId="store-form"
												store={branch}
												bind:isValidStore={isValidStores[i]}
												onChange={(c) => onChangeStore(c, i)}
												hidePrefill={true}
											/>
											<AddressForm
												bind:address={storeDetails[i].address}
												bind:validationError={validationErrors[i]}
												bind:currentCountry={currentCountries[i]}
												bind:formTouched={addressFormTouched[i]}
												bind:isValid={isValidAddresses[i]}
												formName={`store-detail-${i}`}
											/>
											<div class="button-content">
												{#if isOnlyOneStore}
													<ssk-tooltip
														size="sm"
														themeColor="white"
														placement="right"
														areaPosition="76%"
														color="currentcolor"
														hideCloseButton={true}
														label="จำเป็นต้องมีมากกว่า 1 สาขา"
													>
														<ssk-button
															variant="outline"
															themeColor="red"
															disabled={isOnlyOneStore}
															width="1/2"
														>
															นำสาขาออก
														</ssk-button>
													</ssk-tooltip>
												{:else}
													<ssk-button
														variant="outline"
														themeColor="red"
														width="1/2"
														on:click={() => {
															setDeletedBranchId(branch.id ? branch.id : '');
															toggleModalTrash();
														}}
													>
														นำสาขาออก
													</ssk-button>
												{/if}
											</div>
										</div>
									{/if}
								</ssk-accordion-item>
								<ssk-divider size="xs" margin="2xl" />
							{/each}
							<div class="footer">
								{#if !canCreate}
									<ssk-tooltip
										size="xs"
										themeColor="black"
										hideCloseButton={true}
										placement="bottom"
									>
										<span slot="content" class="tooltip-content">
											<ssk-text size="xs" color="white"> จำกัดสิทธิ์การเข้าถึง </ssk-text>
										</span>
										<ssk-button
											variant="outline"
											themeColor="sky"
											width="full"
											disabled={!canCreate}
											on:click={newStore}
										>
											<ssk-icon slot="prefix" name="solid-plus" size="" />
											เพิ่มสาขาใหม่
										</ssk-button>
									</ssk-tooltip>
								{:else}
									<ssk-button
										variant="outline"
										themeColor="sky"
										width="full"
										disabled={!canCreate}
										on:click={newStore}
									>
										<ssk-icon slot="prefix" name="solid-plus" size="" />
										เพิ่มสาขาใหม่
									</ssk-button>
								{/if}
							</div>
						</ssk-accordion>
					</div>
					<ssk-button
						variant="solid"
						size="md"
						type="submit"
						themeColor="primary"
						width="full"
						disabled={disabledSubmit || !formChangeTrigger}
						on:click={submitHandler}
					>
						<span>บันทึกข้อมูล</span>
					</ssk-button>
				</div>
			</div>
		{/if}
	{/await}
{/if}

<style>
	.footer {
		padding-top: 0.5rem;
	}

	.button-content {
		text-align: center;
	}

	ssk-button {
		text-align: -webkit-center;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.accordion-title {
		display: flex;
		justify-content: space-between;
		cursor: pointer;
	}

	.accordion-container {
		padding: 1.5rem;
		background-color: var(--ssk-colors-gray-50);
		border-radius: 8px;
		border: 1px solid var(--ssk-colors-gray-100);
	}

	ssk-accordion-item {
		--background-color: var(--ssk-colors-gray-50);
	}
</style>
