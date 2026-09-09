<script lang="ts">
	import { isMember } from '$stores/profile';
	import { navigateToLogin } from '$utils/navigate';
	import { navigate } from 'svelte-routing';
	export let label: string;
	export let description: string;
	export let iconName: string;
	export let disabled: Boolean;
	export let path: string;

	function handleOnClick(path: string) {
		const targetUrl = `${window.location.origin}${path}`;
		if (!$isMember) {
			navigateToLogin(targetUrl);
		} else {
			navigate(path);
		}
	}
</script>

{#if disabled}
	<div class="container disabled">
		<ssk-tooltip
			size="sm"
			hidden={!disabled}
			themeColor="white"
			areaPosition="120%"
			placement="top"
			color="currentcolor"
			hideCloseButton={true}
		>
			<div class="tooltip-content" slot="content">
				<ssk-text size="sm"> เร็วๆนี้ </ssk-text>
			</div>
			<div class="sub-container disabled">
				<div class="icon">
					<div class="box transfer"></div>
					<div class="box overlay">
						<ssk-icon name={iconName} color="gray.400" />
					</div>
				</div>
				<div class="text">
					<ssk-text color="gray">{label}</ssk-text>
					<ssk-text color="gray.400" size="sm">{description}</ssk-text>
				</div>
				<div class="lock"><ssk-icon name="solid-lock-closed" /></div>
			</div>
		</ssk-tooltip>
	</div>
{:else}
	<div class="container" on:click={() => handleOnClick(path)}>
		<div class="sub-container">
			<div class="icon">
				<div class="box transfer"></div>
				<div class="box overlay">
					<ssk-icon name={iconName} color="white" />
				</div>
			</div>
			<div class="text">
				<ssk-text color="gray.800">{label}</ssk-text>
				<ssk-text color="gray" size="sm">{description}</ssk-text>
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		border: 1px solid var(--ssk-colors-gray-100);
		background-color: var(--ssk-colors-gray-50);
		border-radius: 8px;
		padding: 0 1.5rem;
		cursor: pointer;
	}

	.sub-container {
		display: grid;
		margin: 1rem 0;
		padding: 1rem 0;

		grid-template-columns: 1fr 3fr;
	}

	.container.disabled {
		cursor: not-allowed;
	}

	.sub-container.disabled {
		--bg-color: var(--ssk-colors-gray-400);
		grid-template-columns: 1fr 3fr auto;
	}

	.tooltip-content {
		width: max-content;
	}

	.lock {
		grid-column-start: 3;
		grid-row-start: 1;
		grid-row-end: 3;
		color: var(--bg-color);
	}

	.icon {
		grid-column-start: 1;
		grid-row-start: 1;
		grid-row-end: 3;
	}

	.box {
		width: 3rem;
		height: 3rem;
		border-radius: 8px;
		background: var(--bg-color);
	}
	.overlay {
		margin: -2.5rem 0;
		background-color: rgba(255, 255, 255, 0.5);
		backdrop-filter: blur(10px);
		border: 1px solid var(--ssk-colors-gray-100);
		text-align: center;
	}
	.transfer {
		transform: rotate(15deg);
		margin: -8px 11px;
	}

	ssk-icon {
		position: relative;
		top: 25%;
	}

	@media only screen and (max-width: 950px) {
		.sub-container {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			align-items: center;
		}
		.icon {
			height: 3rem;
		}
		.text {
			text-align: center;
		}
	}
</style>
