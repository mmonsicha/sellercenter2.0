<script lang="ts">
	import { i18nKW } from '$stores/i18n';
	import {
		cancelAction,
		clearAction,
		runCancelUnsavedAction,
		runUnsavedAction,
		unsavedAction,
		unsavedChanges
	} from '$stores/saved-changes';
	import Modal from './Modal.svelte';

	let unsavedSlot: string = '';

	$: {
		let found;
		// find unsavedAction[x] that have unsavedChanges[x] = true
		for (const key in $unsavedAction) {
			if ($unsavedChanges[key] && $unsavedAction[key]) {
				unsavedSlot = key;
				found = true;
				break;
			}
		}

		if (!found) {
			unsavedSlot = '';
		}
	}

	const toggleModal = () => {
		if (unsavedSlot) {
			clearAction(unsavedSlot);
		}
	};

	$: cancelUnsaveAction = () => {
		if (unsavedSlot) {
			if ($cancelAction[unsavedSlot]) {
				runCancelUnsavedAction(unsavedSlot);
			}
			clearAction(unsavedSlot);
		}
	};

	$: runAction = () => {
		if (unsavedSlot) {
			runUnsavedAction(unsavedSlot);
		}
	};

	$: unsavedTitle = $i18nKW['patona-sellercenter-customerbook-modal-unsaved-title'] ?? '';
	$: unsavedDescription = $i18nKW['patona-sellercenter-customerbook-modal-unsaved-body-warning'] ?? '';
	$: unsavedBody = $i18nKW['patona-sellercenter-customerbook-modal-unsaved-body-confirm'] ?? '';
</script>

<Modal
	id="unsaved"
	{toggleModal}
	ShowModal={!!unsavedSlot}
	title={unsavedTitle}
	body={`<center>${unsavedDescription}<br /> ${unsavedBody}</center>`}
>
	<ssk-button
		slot="modal-footer-left"
		variant="outline"
		themeColor="gray"
		width="full"
		on:click={cancelUnsaveAction}
	>
		<span>{$i18nKW['patona-sellercenter-customerbook-button-cancel'] ?? ''}</span>
	</ssk-button>
	<ssk-button width="full" slot="modal-footer-right" on:click={runAction}>
		{$i18nKW['patona-sellercenter-customerbook-button-leave'] ?? ''}
	</ssk-button>
</Modal>
