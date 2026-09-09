<script lang="ts">
	import StatItem from './StatItem.svelte';
	let printTotal = 2420;
	let waitPrintingTotal = 2420;
	let customerTotal = 2420;
</script>

<div>
	<div class="title"><ssk-text size="lg">สถานะการดำเนินงานในร้านของคุณ</ssk-text></div>
	<div class="stat">
		<StatItem label="ปริ้นท์สำเร็จ" value={printTotal} iconName="outline-check-circle" />
		<StatItem label="คงค้างรอปริ้นท์" value={waitPrintingTotal} iconName="outline-printer" />
		<StatItem label="ลูกค้าในระบบ" value={customerTotal} iconName="outline-user-group" />
	</div>
</div>

<style lang="css">
	.stat {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
	}
	.title {
		text-align: center;
		padding-bottom: 2rem;
	}
</style>
