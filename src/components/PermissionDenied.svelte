<script lang="ts">
</script>

<div class="container">
	<ssk-wave-icon
		iconname="solid-lock-closed"
		themecolor="gray"
		size="xl"
		iconcolor="gray.400"
		wavecolor="gray.200"
	>
		<div class="message">
			<ssk-text size="xl" fontweight="medium" color="gray.800">
				คุณไม่มีสิทธิ์ใช้งานในหน้านี้
			</ssk-text>
			<ssk-text size="md" color="gray.500">กรุณาตรวจสอบสิทธิ์ หรือ สถานะการล็อกอินของคุณ</ssk-text>
		</div>
	</ssk-wave-icon>
	<slot />
</div>

<style>
	.container {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.message {
		opacity: 100%;
		display: flex;
		flex-direction: column;
		text-align: center;
		gap: 8px;
	}
</style>
