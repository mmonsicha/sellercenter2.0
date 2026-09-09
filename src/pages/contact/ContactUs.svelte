<script lang="ts">
	const env = import.meta.env;

	const lineUrl = env.VITE_LINE_URL;
</script>

<div class="qr-container">
	<ssk-text color="gray.800" class="title"><span>มีปัญหาติดต่อเรา</span></ssk-text>
	<div class="divider">
		<ssk-divider size="xs" />
	</div>
	<ssk-image src="/images/ui/line-qr.svg" width="90%"></ssk-image>
	<a href={lineUrl} target="_blank">
		<div class="line-button">
			<ssk-image src="/images/logos/line-icon.svg" width="24px"></ssk-image>
			<ssk-text class="text" color="gray.800">line official</ssk-text>
		</div>
	</a>
</div>

<style>
	ssk-text.title > span {
		font-size: 36px;
	}
	.qr-container {
		text-align: center;
		text-align: -webkit-center;
		width: 28%;
		background-color: #fff;
		padding: 3rem 2rem 2rem;
		border-radius: 8px;
		border: 1px solid var(--ssk-colors-gray-100);
	}

	.divider {
		padding: 1.5rem 0;
	}

	.line-button {
		cursor: pointer;
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		margin: 1.5rem 1.5rem 1rem;
		border-radius: 8px;
		border: 1px solid var(--ssk-colors-gray-100);
	}

	@media only screen and (max-width: 768px) {
		ssk-text.title > span {
			font-size: 24px;
		}

		.line-button {
			padding: 0.5rem;
		}

		.text {
			display: none;
		}
	}
</style>
