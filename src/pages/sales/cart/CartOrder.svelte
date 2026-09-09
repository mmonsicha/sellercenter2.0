<script lang="ts">
	import { cartListInfo, GetExistingCart } from '$stores/cart/cart';
	import { onMount } from 'svelte';
	import CartItem from './CartItem.svelte';
	import type { TCartItem } from '$stores/cart';
	import { currentLanguage } from '$stores/i18n';
	export let orderId: string = '';
	var cartList: TCartItem[];
	cartListInfo.subscribe((c) => {
		cartList = c.data;
	});

	onMount(GetExistingCart);
</script>

<ssk-text size="2xl">
	<ssk-i18n-translate
		key="patona-sellercenter-sales-title-order"
		lang={$currentLanguage.code}
		fallbackLang="default"
	/>
	<span>#{orderId}</span>
</ssk-text>
<ssk-divider size="xs" margin="xl" />
<div class="cart-order">
	<CartItem items={cartList} order={true} />
</div>

<style>
	ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}

	.cart-order {
		height: 80%;
		overflow-y: auto;
	}
</style>
