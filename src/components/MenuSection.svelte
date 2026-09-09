<script lang="ts">
	import MenuItem from './MenuItem.svelte';
	let MenuItemDetail: any[] = [];
	let commingSoon: boolean = true;

	$: {
		MenuItemDetail = [
			{
				label: 'สร้างคำสั่งขาย',
				description: 'สร้างคำสั่งขายในร้านค้า',
				icon: 'outline-shopping-cart',
				color: '#F43F5E',
				path: '/sales',
				disabled: false
			},
			{
				label: 'รายการคำสั่งขาย',
				description: 'ดูประวัติรายการคำสั่งขายของฉัน',
				icon: 'outline-document-text',
				color: '#FB8C34',
				path: '/order',
				disabled: false
			},
			{
				label: 'สินค้าของฉัน',
				description: 'จัดการสินค้าในร้านค้า',
				icon: 'outline-shopping-bag',
				color: '#EAB308',
				path: '/product',
				disabled: false
			},
			{
				label: 'เพิ่มสินค้า',
				description: 'เพิ่มรายการสินค้าในร้านค้า',
				icon: 'outline-plus',
				color: '#22C55E',
				path: '/product/add',
				disabled: false
			},
			{
				label: 'พัสดุของฉัน',
				description: 'จัดการรายการพัสดุ',
				icon: 'outline-archive-box',
				color: '#3B82F6',
				path: '/parcels',
				disabled: commingSoon
			},
			{
				label: 'ปริ้นท์ใบปะหน้า',
				description: 'ปริ้นท์ใบแปะหน้าออเดอร์',
				icon: 'outline-printer',
				color: '#EC4899',
				path: '/template',
				disabled: commingSoon
			},
			{
				label: 'สมุดรายชื่อลูกค้า',
				description: 'จัดการรายชื่อลูกค้าในระบบ',
				icon: 'outline-book-open',
				color: '#06B6D4',
				path: '/customers',
				disabled: commingSoon
			},
			{
				label: 'แดชบอร์ด',
				description: 'ดูยอดขายทั้งหมดในแดชบอร์ด',
				icon: 'outline-chart-bar-square',
				color: '#6C84C5',
				path: '/',
				disabled: commingSoon
			},
			{
				label: 'แคตตาล็อกสินค้า',
				description: 'แคตตาล็อกสินค้าในสินค้าของฉัน',
				icon: 'outline-shopping-bag-cog',
				color: '#7E71C0',
				path: '/',
				disabled: commingSoon
			}
		];
	}
</script>

<div class="container">
	<ssk-text size="xl" color="gray.800">วันนี้ทำอะไรกันดี </ssk-text>
	<div class="description">
		<ssk-text size="md" color="gray">
			จัดการ ปรับปรุง ขายสินค้า ออนไลน์ ออฟไลน์ จบในที่เดียว
		</ssk-text>
	</div>
	<div class="menu">
		{#each MenuItemDetail as item}
			<MenuItem
				label={item.label}
				description={item.description}
				iconName={item.icon}
				disabled={item.disabled}
				path={item.path}
				--bg-color={item.color}
			/>
		{/each}
	</div>
</div>

<style lang="css">
	.description {
		padding: 0.5rem 0;
		margin-bottom: 1rem;
	}

	.menu {
		display: grid;
		grid-template-columns: auto auto auto;
		gap: 1rem;
	}

	@media only screen and (max-width: 600px) {
		.menu {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
	}
</style>
