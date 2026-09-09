<script lang="ts">
	import CustomInputNumber from '$components/CustomInputNumber.svelte';
	import Modal from '$components/modal/Modal.svelte';
	import type { TCartItem } from '$stores/cart';
	import { GetExistingCart, RemoveCartItem, UpdateCartItemQty } from '$stores/cart/cart';
	import { setCartItemInfo, setCurrentCartId } from '$stores/cart/cart-item';
	import { setSelectedProduct, setVariantValue } from '$stores/variant/variant';
	import {
		showEditVariantModal,
		toggleEditVariantModal
	} from '$stores/variant/variant-handler-modal';
	import { formatPriceWithBath } from '$utils/format-number';
	import { getImageUrl } from '$utils/image-url';
	import type { I18nStore, ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { toSaleProduct } from './util.cart';
	import { currentLanguage } from '$stores/i18n';

	export var items: TCartItem[];
	export let order: boolean = false;
	var showRemoveModal: boolean = false;
	var showZeroQtyModal: boolean = false;
	var removeItem: TCartItem = items[0];

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	let titleRemove = '';

	function handleTrashButton(item: TCartItem) {
		removeItem = item;
		showRemoveModal = true;
	}

	function toggleRemoveModal() {
		showRemoveModal = !showRemoveModal;
	}

	function toggleZeroQtyModal() {
		showZeroQtyModal = !showZeroQtyModal;
	}

	function _onRemoveOK() {
		showRemoveModal = false;
		RemoveCartItem(removeItem.product_id);
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	async function _onClickCart(item: TCartItem, idx: number) {
		setVariantValue([]);

		if (!!item.options) {
			const existingCart = GetExistingCart()[idx];
			const productInCart = await toSaleProduct(item);

			if (productInCart) {
				setCurrentCartId(item.product_id);
				setSelectedProduct(productInCart);
				setCartItemInfo(item);
				setVariantValue(existingCart.options ?? []);
				toggleEditVariantModal($showEditVariantModal);
			}
		}
	}

	function _onZeroQtyOK() {
		showZeroQtyModal = false;
		RemoveCartItem(removeItem.product_id);
		toastStore.addToast({
			message: 'นำสินค้าออกสำเร็จ',
			type: 'success',
			timeout: 5000
		});
	}

	function _onUpdateItemQty(item: TCartItem) {
		if (item.qty === 0) {
			removeItem = item;
			showZeroQtyModal = true;
		}
		UpdateCartItemQty(item.product_id, item.qty);
	}

	const loadKeywords = async () => {
		titleRemove = await i18nStore.get(
			'patona-sellercenter-sales-modal-remove-title-remove',
			$currentLanguage.code,
			'default'
		);
	};

	$: if ($currentLanguage.code) {
		loadKeywords();
	}
</script>

<Modal
	toggleModal={toggleRemoveModal}
	id="trash"
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showRemoveModal}
	title={titleRemove}
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			showRemoveModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onRemoveOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-remove"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

<Modal
	toggleModal={async () => {
		UpdateCartItemQty(removeItem.product_id, 1);
		toggleZeroQtyModal();
	}}
	id="zero-qty"
	icon="outline-exclamation-circle"
	iconColor="#d97706"
	ShowModal={showZeroQtyModal}
	title={titleRemove}
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={async () => {
			UpdateCartItemQty(removeItem.product_id, 1);
			showZeroQtyModal = false;
		}}
	>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-cancel"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={_onZeroQtyOK}>
		<ssk-i18n-translate
			key="patona-sellercenter-sales-modal-remove-button-remove"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-button>
</Modal>

{#each items as item, idx}
	{#if order}
		<div class="grid-container order">
			<div class="image">
				<img src={getImageUrl(item.image)} alt={item.product_name} />
			</div>
			<div class="detail">
				<div class="name"><ssk-text>{item.product_name}</ssk-text></div>
				{#if item.options}
					<div class="option">
						{#each item.options as option}
							<ssk-text size="xs">{option.key}: <span>{option.value}</span></ssk-text>
						{/each}
					</div>
				{/if}

				<div class="price">
					<ssk-text color="primary">{formatPriceWithBath(item.price)}</ssk-text>
				</div>
			</div>
			<div class="qty-order">
				<ssk-text>{item.qty}</ssk-text>
			</div>
		</div>
	{:else}
		<div class="grid-container" on:click={() => _onClickCart(item, idx)}>
			<!-- The standalone trash column is gone: at qty 1 the minus below turns into the
			     trash, so removal lives in one place instead of two, and the row keeps the
			     width for the product name. -->
			<div class="image">
				<img src={getImageUrl(item.image)} alt={item.product_name} />
			</div>
			<div class="detail">
				<div class="name"><ssk-text>{item.product_name}</ssk-text></div>
				{#if item.options}
					<div class="option">
						{#each item.options as option}
							<span class="overflow-ellipsis"
								>{option.key}: <span class="gray">{option.value}</span></span
							>
						{/each}
					</div>
				{/if}
				{#if item.input}
					<div class="input">
						{#each item.input as inp}
							{#if inp.value && inp.value.length + inp.key.length > 60}
								<ssk-tooltip
									size="sm"
									color="currentcolor"
									hideCloseButton={true}
									themeColor="white"
									placement="top"
									areaPosition="50%"
								>
									<div class="tooltip-content" slot="content">
										<ssk-text size="xs">{inp.value}</ssk-text>
									</div>
									<span class="overflow-ellipsis">
										{inp.key}:
										<span class="gray">{inp.value}</span>
									</span>
								</ssk-tooltip>
							{:else}
								<span class="overflow-ellipsis">
									{inp.key}:
									<span class="gray">{inp.value}</span>
								</span>
							{/if}
						{/each}
					</div>
				{/if}
				<div class="price">
					<ssk-text color="primary">{formatPriceWithBath(item.price)}</ssk-text>
				</div>
			</div>
			<div class="qty">
				<CustomInputNumber
					bind:value={item.qty}
					layout="horizontal"
					removeAtMin
					onRemove={() => handleTrashButton(item)}
					onChange={() => _onUpdateItemQty(item)}
				/>
			</div>
		</div>
	{/if}
{/each}

<style>
	img {
		object-fit: cover;
		border-radius: 4px;
		width: 56px;
		height: 56px;
	}

	.detail {
		justify-self: left;
	}

	.qty {
		/* Row of [+][value][−/trash]; wide enough that the three never wrap. */
		width: auto;
	}

	.qty-order {
		width: 1rem;
	}

	.grid-container {
		cursor: pointer;
		display: grid;
		/* image | detail | qty — the trash column was folded into the qty control. */
		grid-template-columns: auto 1fr auto;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		justify-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
		padding: 0.5rem 1rem;
	}

	.grid-container.order {
		grid-template-columns: auto 1fr auto;
	}
	.grid-container:first-child {
		margin-top: 0.5rem;
	}
	.grid-container:last-child {
		margin-bottom: 0;
	}

	.grid-container > div {
		align-content: center;
	}

	.option {
		display: flex;
		width: 13rem;
		gap: 0.4rem;
	}

	.option > .overflow-ellipsis {
		width: fit-content;
	}

	.overflow-ellipsis {
		display: block;
		width: 13rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		font-size: 18px;
	}

	span.gray {
		color: var(--ssk-colors-gray-500);
	}

	.tooltip-content {
		max-width: 14rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
