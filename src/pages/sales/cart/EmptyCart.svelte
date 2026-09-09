<script lang="ts">
	import { currentLanguage } from '$stores/i18n';
</script>

<div>
	<ssk-text size="xl" color="gray" style="white-space: pre-wrap">
		<ssk-i18n-translate
			key="patona-sellercenter-sales-title-cartfound"
			lang={$currentLanguage.code}
			fallbackLang="default"
		/>
	</ssk-text>
</div>

<style>
	div {
		background-color: var(--ssk-colors-gray-50);
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		color: var(--ssk-colors-gray-500);
		height: 100%;
		text-align: center;
		align-content: center;
	}
</style>
