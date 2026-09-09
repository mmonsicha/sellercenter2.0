<script lang="ts">
	import { navigate } from 'svelte-routing';
	import { setAction } from '$stores/saved-changes';

	const goToHome = () => {
		setAction(() => navigate('/'));
	};

	const goBack = () => {
		if (window.history.length > 1) {
			setAction(() => window.history.back());
			return;
		}

		goToHome();
	};
</script>

<div class="container">
	<ssk-icon size="4xl" name="outline-exclamation-circle" color="primary" />
	<ssk-text size="2xl">ไม่พบหน้าที่คุณต้องการ</ssk-text>
	<div class="actions">
		<ssk-button variant="outline" themecolor="gray" on:click={goBack}>
			<ssk-icon slot="prefix" name="outline-arrow-left" />
			ย้อนกลับ
		</ssk-button>
		<ssk-button variant="solid" themecolor="primary" on:click={goToHome}>
			<ssk-icon slot="prefix" name="outline-home" />
			กลับสู่หน้าหลัก
		</ssk-button>
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 8px;
		background-color: var(--ssk-colors-white-50);
		border: 1px solid var(--ssk-colors-gray-200);
		gap: 16px;
	}

	.actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 8px;
	}
</style>
