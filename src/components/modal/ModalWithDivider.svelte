<script lang="ts">
	import IconCircle from '../IconCircle.svelte';

	export let ShowModal: boolean;
	export let icon: string = '';
	export let iconColor: string = '';
	export let id: string = '';
	export let hPosition: string = 'center';
	export let typeFooter: 'horizontal' | 'vertical' = 'horizontal';
	export let toggleModal: () => void;
	export let modalWidth: string = '25vw';
	export let modalPaddingBody: string = '16px';
	export let bodySlotDisplay: string = 'flex';
	// Optional, default false → no change for existing callers (SlipReviewModal, etc.).
	export let hideDivider: boolean = false;
	export let hideCloseButton: boolean = false;

	let idModal: string = `${typeFooter === 'horizontal' ? 'modal-setting' : 'modal-setting-vertical'}${id ? '-' + id : ''}`;

	$: {
		if (ShowModal) addShowAttr();
		else removeShowAttr();
	}

	function addShowAttr() {
		document.querySelector(`#${idModal}`)?.setAttribute('show', '');
	}

	function removeShowAttr() {
		document.querySelector(`#${idModal}`)?.removeAttribute('show');
	}
</script>

<div class={`container ${typeFooter}`}>
	<ssk-modal
		id={idModal}
		close={toggleModal}
		{hideDivider}
		{hideCloseButton}
		style={`--modal-width: ${modalWidth}; --modal-padding-body:${modalPaddingBody}; --body-display: ${bodySlotDisplay}`}
	>
		<div class={`header-container ${hPosition}`} slot="header">
			{#if icon}
				<div class="icon">
					<IconCircle {iconColor} type="outline" iconName={icon} iconSize="2xl" />
				</div>
			{/if}
			<slot name="title" />
		</div>
		<slot name="body" />
		<slot name="footer" />
	</ssk-modal>
</div>

<style>
	.container {
		position: absolute;
	}

	.container > ssk-modal {
		--width: var(--modal-width);
		--body-justify-content: center;
		--padding-body: var(--modal-padding-body);
	}

	.footer {
		display: flex;
		flex-direction: column;
	}

	.icon {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.header-container {
		margin-top: 0.5rem;
		text-align: center;
	}

	.header-container.left {
		text-align: left;
	}

	.header-container.right {
		text-align: right;
	}
</style>
