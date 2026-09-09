<script lang="ts">
	import { profileInfo, isMember } from '../stores/profile';
	import MenuSection from '$components/MenuSection.svelte';
	import type { Profile } from '$lib/entities/identity/profile';
	const env = import.meta.env;

	const lineUrl = env.VITE_LINE_URL;
	function getFullName(userInfo: Profile): string {
		const fullname = userInfo ? userInfo.firstName + ' ' + userInfo.lastName : '';
		return fullname;
	}
</script>

<div class="container">
	<div class="welcome-header">
		<ssk-text size="2xl" color="gray.800">
			ยินดีต้อนรับเข้าสู่ Patona
			{#if $isMember && $profileInfo.data}
				, <span>คุณ {getFullName($profileInfo.data)}</span>
			{/if}
		</ssk-text>
	</div>
	<div class="content">
		<img src="/images/ui/banner.png" />
		<div class="body">
			<MenuSection />
		</div>
		<ssk-divider size="xs" />

		<div class="footer">
			<ssk-text size="sm" color="gray">
				มีปัญหาด้านการใช้งาน <a href={lineUrl} target="_blank">ติดต่อเราเลย</a>
			</ssk-text>
		</div>
	</div>
</div>

<style lang="css">
	ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}
	.content {
		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
	}

	.body {
		padding: 2rem;
		min-height: 640px;
	}

	.footer {
		padding: 1rem 0;
		text-align: center;
	}

	img {
		width: 100%;
		border-top-right-radius: 8px;
		border-top-left-radius: 8px;
	}

	.welcome-header {
		padding-bottom: 2rem;
	}
</style>
