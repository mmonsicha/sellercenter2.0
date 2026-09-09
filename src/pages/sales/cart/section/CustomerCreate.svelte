<script lang="ts">
	import CustomerForm from '$components/form/CustomerForm.svelte';
	import type { Customer } from '$lib/entities/customer/customer';
	import { generateEmptyCustomer } from '$lib/entities/customer/generator';
	import { customerSchema } from '$lib/entities/customer/validator';
	import { currentCompany } from '$stores/company/current-company';
	import { countriesList } from '$stores/country';
	import { setUnsavedChanges } from '$stores/saved-changes';
	import { yupValidationErrorToRecord } from '$utils/yup';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { AxiosError } from 'axios';
	import { createCustomer, getCustomer } from '../../../../service/customer-book-v2-rest';

	const toastStore = getContext<ToastStore>('toast');

	export let onClickSelectCustomer: (c: Customer) => void;
	export let disabledSubmit: boolean = true;
	export let shouldSubmit: boolean = false;
	export let shouldreset: boolean = false;

	let customer: Customer = generateEmptyCustomer();
	$: customer.owner = `sellsuki.company:${$currentCompany?.id}`;
	$: currentCountry = $countriesList.data?.find((c) => c.iso === customer.countryCode);
	let isDuplicate: boolean = false;
	let validationError: Record<string, string> = {};
	let formTouched: boolean = false;

	$: disabledSubmit = (() => {
		if (!customer || !$currentCompany?.id) return true;
		try {
			customerSchema(currentCountry).validateSync(customer);
			return false;
		} catch {
			return true;
		}
	})();

	$: if (isDuplicate && formTouched) {
		isDuplicate = false;
	}

	$: if (shouldSubmit) {
		handleSubmit();
		shouldSubmit = false;
	}

	$: if (shouldreset) {
		resetCustomerState();
		shouldreset = false;
	}

	const resetCustomerState = () => {
		customer = generateEmptyCustomer();
		validationError = {};
		isDuplicate = false;
		setUnsavedChanges(false);
	};

	function duplicateSelectCustomer() {
		onClickSelectCustomer(customer);
		resetCustomerState();
	}

	const getCustomerDuplicate = async () => {
		if (!$currentCompany) return;

		try {
			const result = await getCustomer(
				`sellsuki.company:${$currentCompany.id}`,
				customer.firstName!,
				customer.lastName!,
				customer.phone!,
				customer.countryCode
			);

			if (result) {
				customer = result;
			}
		} catch (e) {
			console.error('Error fetching customer:', e);
		}
	};

	const handleSubmit = async () => {
		try {
			customerSchema(currentCountry).validateSync(customer, { abortEarly: false });
		} catch (error) {
			validationError = yupValidationErrorToRecord(error);
			toastStore.addToast({
				message: `${validationError}`,
				type: 'error',
				timeout: 3000
			});
			return;
		}

		try {
			const id = await createCustomer(customer);
			customer.id = id;

			toastStore.addToast({
				message: 'เพิ่มลูกค้าใหม่และนำไปใช้สำเร็จ',
				type: 'success',
				timeout: 3000,
				testId: 'customer.toast.success'
			});

			onClickSelectCustomer(customer);
			resetCustomerState();
		} catch (error) {
			if (error instanceof AxiosError) {
				const err = error.response?.data?.error ?? '';
				if (err.includes('duplicate')) {
					isDuplicate = true;
					formTouched = false;
					await getCustomerDuplicate();
				} else {
					toastStore.addToast({
						message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
						type: 'error',
						timeout: 3000,
						testId: 'customer.toast.failed'
					});
				}
			} else {
				toastStore.addToast({
					message: `${error}`,
					title: 'เกิดข้อผิดพลาด',
					type: 'error',
					timeout: 3000,
					testId: 'customer.toast.failed'
				});
			}

			return;
		}
	};
</script>

{#if isDuplicate}
	<div class="alert">
		<ssk-alert
			type="error"
			message="ไม่สามารถเพิ่มลูกค้าใหม่ได้เนื่องจากข้อมูลซ้ำกับที่มีอยู่"
			topic="มีรายชื่อลูกค้านี้อยู่แล้ว"
			hideclosebutton
		>
			<ssk-icon name="outline-exclamation-circle" slot="icon-slot" color="#E11D48" />
			<ssk-text color="sky.600" slot="ok-button-slot" on:click={duplicateSelectCustomer}>
				เลือกลูกค้าคนนี้
			</ssk-text>
		</ssk-alert>
	</div>
{/if}
<div class="form-create-container">
	<ssk-text size="xl">ข้อมูลพื้นฐาน</ssk-text>

	<span class="divider"></span>
	<CustomerForm bind:customer bind:validationError bind:currentCountry bind:formTouched />
</div>

<style>
	ssk-alert > ssk-text {
		cursor: pointer;
		padding-left: 0.75rem;
	}

	.alert {
		margin-bottom: 1rem;
	}

	.form-create-container {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
		height: auto;
		width: 100%;
		padding: 32px;
		box-sizing: border-box;
		gap: 24px;
	}

	.divider {
		width: 100%;
		border-top: 1px solid var(--ssk-colors-gray-200);
	}
</style>
