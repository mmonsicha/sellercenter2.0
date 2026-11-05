<script lang="ts">
	/**
	 * Edits ONE contact field (email or phone) of the current buyer in place — tap the
	 * value, get a plain input right there, save, done. Before this, the only way to fix
	 * a typo'd email/phone was DrawerCustomerAddress's full "ลูกค้าและที่อยู่จัดส่ง" drawer,
	 * which opens the WHOLE customer record just to change one field.
	 *
	 * Customer Book v2 has no per-field update endpoint (see customer-book-v2-rest.ts) —
	 * every write is read-modify-write of the whole Customer, same as
	 * DrawerCustomerAddress's own saveAddress already does for the address array.
	 */
	import { getContext } from 'svelte';
	import { AxiosError } from 'axios';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import type { Customer } from '$lib/entities/customer/customer';
	import { currentCompany } from '$stores/company/current-company';
	import {
		getCustomerByIdWithAccess,
		updateCustomerWithAccess
	} from '$service/customer-book-v2-rest';

	export let kind: 'email' | 'phone';
	export let value: string | undefined = undefined;
	export let refId: string | undefined = undefined;
	// Local update only — the cart's own `buyer` (PartyInfo) also carries a copy of this
	// field, which must follow the newly-saved value even though it isn't the Customer
	// record itself.
	export let onSaved: (value: string) => void;
	export let placeholder: string = '';
	export let testIdPrefix: string = 'sales.contact.inline';

	const toastStore = getContext<ToastStore>('toast');

	let editing = false;
	let draft = '';
	let saving = false;
	let error = '';

	const STRICT_EMAIL = /^[a-zA-Z0-9](?!.*\.\.)[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	// Loose on purpose — this edits whatever a customer already gave at checkout, not a
	// fresh profile form, so it only catches the obviously-wrong case (letters, too short)
	// rather than enforcing one country's own phone format like customerAddressSchema does.
	const PHONE_DIGITS = /^[0-9]{9,10}$/;

	function validate(raw: string): string {
		const trimmed = raw.trim();
		if (!trimmed) return kind === 'email' ? 'กรุณากรอกอีเมล' : 'กรุณากรอกเบอร์โทร';
		if (kind === 'email' && !STRICT_EMAIL.test(trimmed)) return 'รูปแบบอีเมลไม่ถูกต้อง';
		if (kind === 'phone' && !PHONE_DIGITS.test(trimmed)) return 'รูปแบบเบอร์โทรไม่ถูกต้อง';
		return '';
	}

	function startEdit() {
		draft = value ?? '';
		error = '';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		error = '';
	}

	// `as HTMLInputElement` inline in markup breaks Svelte's template parser (consumed as
	// module script, not an expression) — same fix CartItem.svelte's own labelOf uses.
	function onInput(e: Event) {
		draft = (e.target as HTMLInputElement).value;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			save();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}

	async function save() {
		const trimmed = draft.trim();
		const validationError = validate(trimmed);
		if (validationError) {
			error = validationError;
			return;
		}
		if (trimmed === (value ?? '')) {
			editing = false;
			return;
		}
		if (!refId || !$currentCompany?.id) return;

		saving = true;
		const owner = `sellsuki.company:${$currentCompany.id}`;
		try {
			const customer: Customer = await getCustomerByIdWithAccess(refId, owner);
			customer[kind] = trimmed;
			await updateCustomerWithAccess(customer);
		} catch (err) {
			saving = false;
			toastStore.addToast({
				message:
					err instanceof AxiosError
						? 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
						: `เกิดข้อผิดพลาด: ${err}`,
				type: 'error',
				timeout: 3000,
				testId: `${testIdPrefix}.${kind}.toast.failed`
			});
			return;
		}

		saving = false;
		editing = false;
		onSaved(trimmed);
		toastStore.addToast({
			message: kind === 'email' ? 'แก้ไขอีเมลสำเร็จ' : 'แก้ไขเบอร์โทรสำเร็จ',
			type: 'success',
			timeout: 3000,
			testId: `${testIdPrefix}.${kind}.toast.success`
		});
	}
</script>

{#if editing}
	<div class="inline-edit" data-testid={`${testIdPrefix}.${kind}.editing`}>
		<ssk-input
			size="sm"
			type={kind === 'email' ? 'email' : 'tel'}
			value={draft}
			{placeholder}
			autoComplete="off"
			error={!!error}
			helperText={error}
			on:input={onInput}
			on:change={onInput}
			on:keydown={onKeydown}
			data-testid={`${testIdPrefix}.${kind}.input`}
		></ssk-input>
		<button
			type="button"
			class="inline-edit-btn save"
			aria-label="บันทึก"
			disabled={saving}
			on:click={save}
			data-testid={`${testIdPrefix}.${kind}.save`}
		>
			<ssk-icon name="outline-check" size="xs"></ssk-icon>
		</button>
		<button
			type="button"
			class="inline-edit-btn cancel"
			aria-label="ยกเลิก"
			disabled={saving}
			on:click={cancelEdit}
			data-testid={`${testIdPrefix}.${kind}.cancel`}
		>
			<ssk-icon name="outline-x-mark" size="xs"></ssk-icon>
		</button>
	</div>
{:else}
	<button
		type="button"
		class="inline-display"
		on:click={startEdit}
		disabled={!refId}
		data-testid={`${testIdPrefix}.${kind}.open`}
	>
		<span class="inline-display-value" class:empty={!value}>{value || placeholder}</span>
		{#if refId}
			<ssk-icon name="outline-pencil" size="xs" themeColor="stroke"></ssk-icon>
		{/if}
	</button>
{/if}

<style>
	.inline-edit {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
	}

	.inline-edit ssk-input {
		flex: 1 1 auto;
		min-width: 0;
	}

	.inline-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
	}

	.inline-edit-btn.save {
		background: var(--ssk-colors-primary-500);
		color: white;
	}

	.inline-edit-btn.cancel {
		background: var(--ssk-colors-gray-100);
		color: var(--ssk-colors-gray-600);
	}

	.inline-edit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inline-display {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0;
		background: none;
		border: 0;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.inline-display:disabled {
		cursor: default;
	}

	.inline-display-value {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ssk-colors-gray-800);
	}

	.inline-display-value.empty {
		color: var(--ssk-colors-gray-400);
	}
</style>
