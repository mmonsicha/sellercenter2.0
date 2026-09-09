<script lang="ts">
	import type { SaleProduct, SaleVariant } from '$lib/entities/sale/sale';
	import type { TCartOptions } from '$stores/cart';
	import { AddCartItem } from '$stores/cart/cart';
	import { cartItemInfo, setCartItemDefault, setCartItemInfo } from '$stores/cart/cart-item';
	import { setDefaultCustomerInput, setSelectedProduct } from '$stores/variant/variant';
	import {
		showAddVariantModal,
		toggleAddVariantModal
	} from '$stores/variant/variant-handler-modal';

	import { formatPriceWithBath } from '$utils/format-number';
	import { getImageUrl } from '$utils/image-url';
	import {
		combinedValues,
		getVariantImage,
		getVariantPrice,
		getVariantSku
	} from './variant/util.variant';

	export let product_info: SaleProduct;
	var variantPrice: number = 0;
	var variantImage: string;
	var variantSku: string;

	function getDefaultVariant(pInfo: SaleProduct): TCartOptions[] {
		var cartOpt: TCartOptions[] = [];
		if (pInfo.variant && pInfo.variant.length > 0) {
			const vComb: SaleVariant = pInfo.variant[0];
			if (vComb.variant_combination) {
				vComb.variant_combination.map((cb) => {
					cartOpt.push({
						key: cb.key ?? '',
						value: cb.value ?? ''
					});
				});
			}
		}
		return cartOpt;
	}

	function _onClickItem() {
		setCartItemDefault();
		setDefaultCustomerInput();
		if (product_info.variant && product_info.variant.length != 0) {
			setSelectedProduct(product_info);
			const combV: string = combinedValues(getDefaultVariant(product_info));
			variantPrice = getVariantPrice(combV, product_info.variant);
			variantImage = getVariantImage(combV, product_info.variant) ?? product_info.image;
			variantSku = getVariantSku(combV, product_info.variant) ?? product_info.code;

			setCartItemInfo({
				product_id: `${product_info.product_id}-${combV}`,
				code: variantSku,
				product_name: product_info.label,
				price: variantPrice,
				image: variantImage,
				options: getDefaultVariant(product_info),
				qty: 1
			});

			return toggleAddVariantModal($showAddVariantModal);
		}
		addProductToCart();
	}

	function addProductToCart() {
		setCartItemInfo({
			product_id: product_info.product_id,
			code: product_info.code,
			product_name: product_info.label,
			price: product_info.price.min,
			image: product_info.image,
			qty: 1
		});

		AddCartItem($cartItemInfo);
	}
</script>

<div class="card" on:click={_onClickItem}>
	<img src={getImageUrl(product_info.image)} alt={product_info.label} />
	<div class="card-content">
		<!-- Same 16px as the product's name in the cart row: the item reads identically in
		     the place you pick it and the place it lands. Price stays 16px too — the
		     hierarchy between them is carried by colour, as everywhere else in the app. -->
		<ssk-text size="md">{product_info.label}</ssk-text>
		<ssk-text color="primary"
			>{formatPriceWithBath(product_info.price.min, product_info.price.max)}</ssk-text
		>
	</div>
</div>

<style lang="css">
	.card {
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
	}

	img {
		width: 100%;
		height: 216px;
		object-fit: cover;
	}

	.card-content {
		display: grid;
		padding: 16px;
		gap: 0.5rem;
	}
</style>
