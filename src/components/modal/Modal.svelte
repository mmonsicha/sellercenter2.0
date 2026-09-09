<script lang="ts">
	import IconCircle from '../IconCircle.svelte';

	export let ShowModal: boolean;
	export let icon: string = '';
	export let iconColor: string = '';
	export let id: string = '';
	export let title: string;
	export let description: string = '';
	export let hPosition: string = 'center';
	export let body: string = '';
	export let typeFooter: 'horizontal' | 'vertical' = 'horizontal';
	export let hideCloseButton: boolean = false;
	// Optional, default false → no change for existing callers. Mirrors ModalWithDivider
	// so a caller can render a clean confirm screen without the body/footer divider.
	export let hideDivider: boolean = false;
	// Optional width override for a single modal. Default keeps the shared 25vw, so
	// existing callers are unchanged; a caller whose body needs a floor (fields that
	// must not overflow on a 1024px screen) can pass e.g. "min(24rem, 92vw)".
	export let width: string = '';
	export let toggleModal: () => void;

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

<div class={`container ${typeFooter}`} style={width ? `--modal-width: ${width}` : undefined}>
	<ssk-modal id={idModal} close={toggleModal} {hideCloseButton} {hideDivider}>
		<div class={`header-container ${hPosition}`} slot="header">
			{#if icon}
				<div class="icon">
					<IconCircle {iconColor} type="outline" iconName={icon} iconSize="2xl" />
				</div>
			{/if}
			<ssk-text size="xl">{title}</ssk-text>
			{#if description}
				<ssk-text size="sm">{description}</ssk-text>
			{/if}
		</div>
		{#if body}
			<div slot="body"><ssk-text size="md">{@html body}</ssk-text></div>
		{:else if $$slots.body}
			<slot name="body" />
		{/if}
		<div class="width-full" slot="footer"><slot name="modal-footer-left" /></div>
		<div class="width-full" slot="footer"><slot name="modal-footer-right" /></div>
	</ssk-modal>
</div>

<style>
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

	.width-full {
		width: 100%;
	}

	.container {
		position: absolute;
	}

	.container > ssk-modal {
		--width: var(--modal-width, 25vw);
		--header-justify-content: center;
		--body-justify-content: center;
	}

	.container.horizontal > ssk-modal {
		--footer-justify-content: center;
		--footer-display: flex;
	}

	.container.vertical > ssk-modal {
		--border-color: white;
		--footer-justify-content: normal;
		--footer-display: grid;
	}
</style>
