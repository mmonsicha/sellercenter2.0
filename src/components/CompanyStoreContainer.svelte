<script lang="ts">
	import { currentLanguage } from '$stores/i18n';
	export let next: string;
	export let title: string;
	export let description: string;
	export let img: string;
	export let testId: string = '';
</script>

<main>
	<div class="cs-content">
		<div class="header">
			<ssk-image src={img}></ssk-image>
			<div class="header-text" data-testid={`${testId}`}>
				<ssk-text size="2xl">{title}</ssk-text>
				<ssk-text size="xl"><span>{description}</span></ssk-text>
				<ssk-text size="xl">
					<ssk-i18n-translate
						key={'patona-sellercenter-company-header-next'}
						lang={$currentLanguage.code}
						fallbackLang="default"
					></ssk-i18n-translate>
					<span>{next}</span>
				</ssk-text>
			</div>
		</div>
		<ssk-divider size="xs" margin="4xl" />
		<div class="body">
			<slot />
		</div>
	</div>
</main>

<style lang="css">
	main {
		box-sizing: border-box;
		overflow: auto;
		/* padding: 2rem; */
		margin: 0;
		display: grid;
		place-items: center;
		height: 100%;
		width: 100%;
	}

	ssk-text > span {
		color: #6b7280;
	}

	.cs-content {
		background-color: #fff;
		padding: 2.5rem;
		border-radius: 8px;
		min-width: 638px;
		width: fit-content;
		border: 1px solid var(--ssk-colors-gray-100);
	}

	.body {
		display: grid;
		gap: 1rem;
	}

	.header {
		display: flex;
		gap: 2rem;
	}
	.header-text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	ssk-image {
		width: 120px;
		height: 120px;
	}
</style>
