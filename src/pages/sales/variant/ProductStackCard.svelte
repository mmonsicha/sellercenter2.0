<script lang="ts">
	import CustomInputNumber from '$components/CustomInputNumber.svelte';
	import { updateCartQuantityInfo } from '$stores/cart/cart-item';
	import { setIsUpdate, showEditVariantModal } from '$stores/variant/variant-handler-modal';
	import { getImageUrl } from '$utils/image-url';
	import { onMount } from 'svelte';

	export var price: string;
	export var img: string = '/images/products/default-product-image.png';
	export var product_name: string;
	export var qty: number = 1;

	function _onUpdateItemQty() {
		if ($showEditVariantModal) setIsUpdate(true);
		updateCartQuantityInfo(qty);
	}
</script>

<div class="grid-container">
	<div class="image">
		<img src={getImageUrl(img)} alt={img} />
	</div>
	<div class="detail">
		<div class="name"><ssk-text>{product_name}</ssk-text></div>
		<div class="price"><ssk-text color="primary">{price}</ssk-text></div>
	</div>
	<div class="qty">
		<CustomInputNumber
			bind:value={qty}
			onChange={() => _onUpdateItemQty()}
			min={1}
			disabledMinus={qty <= 1}
		/>
	</div>
</div>

<style>
	.grid-container {
		display: grid;
		grid-template-columns: auto 1fr auto;
		border: 1px solid var(--ssk-colors-gray-100);
		background-color: var(--ssk-colors-gray-50);
		border-radius: 8px;
		justify-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
		padding: 0.5rem 1rem;
	}
	.grid-container > div {
		align-content: center;
	}

	.detail {
		justify-self: left;
	}

	img {
		object-fit: cover;
		border-radius: 4px;
		width: 56px;
		height: 56px;
		object-fit: cover;
	}

	.qty {
		width: 2.8rem;
	}
</style>
