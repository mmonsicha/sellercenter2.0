<script lang="ts">
	import IconCircle from '$components/IconCircle.svelte';
	import { receiveEvent } from '$utils/event-handler';
	import { getItem, localStorageKey } from '$utils/local-storage';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import { navigate } from 'svelte-routing';
	import {
		mapModalTopicToStyle,
		mapModalTopicToSubmitAction,
		type ModalStyle,
		type ReplyTopic,
		type Topic
	} from './eventHandler';
	import { configurationStore } from '$stores/configuration';

	export let iframePath: string;
	export let iframeTitle: string;

	const env = import.meta.env;
	let receivedData: Topic;

	let showModal: boolean = false;
	let setting: boolean = false;

	// icon style
	let modalStyle: ModalStyle = {
		iconName: 'outline-trash',
		body: '',
		description: '',
		okButton: 'ลบ',
		cancleButton: 'ยกเลิก',
		color: {
			theme: 'secondary',
			code: '#FF0006'
		}
	};

	const originUrl: string = window.location.origin;
	const toastStore = getContext<ToastStore>('toast');

	function handleSubmitButton(topic: string, data: any) {
		showModal = false;

		if (topic === 'pis.product.cancel.edit' || data) {
			const replyData: ReplyTopic = {
				topic: '',
				sender: 'sellercenter.product',
				payload: {
					data
				}
			};

			if (topic === 'pis.product.variant') {
				replyData.topic = 'sellercenter.product.variant.reply';
			}
			if (topic === 'pis.product.setting') {
				replyData.topic = 'sellercenter.product.setting.reply';
			}
			if (topic === 'pis.product.list.remove') {
				replyData.topic = 'sellercenter.product.list.remove.reply';
			}
			if (topic === 'pis.product.cancel.edit') {
				replyData.topic = 'sellercenter.product.redirect';
				replyData.payload = {
					origin: env.VITE_PIS_IFRAME,
					path: `/${iframePath}`
				};
			}

			return mapModalTopicToSubmitAction[topic](replyData);
		}

		return mapModalTopicToSubmitAction[topic];
	}
	function setShowModalAtt(show: boolean) {
		if (show) {
			document.querySelector('ssk-modal')?.setAttribute('show', '');
		} else {
			document.querySelector('ssk-modal')?.removeAttribute('show');
		}
	}

	function getValueLocalStorage(key: string): string {
		return getItem(key)?.value;
	}

	function setReceivedData(data: Topic) {
		receivedData = data;
	}

	$: {
		// handle redirect event
		if (
			receivedData?.topic === 'pis.product.redirect' &&
			receivedData?.payload.origin === originUrl
		) {
			const { path } = receivedData.payload;
			navigate(path || '');
		}

		// handle toast event
		if (receivedData?.payload.toast) {
			const toastInfo = receivedData.payload.toast;
			const type = toastInfo.type;
			toastStore.addToast({
				message: toastInfo.message,
				type,
				timeout: 3000
			});
		}

		// handle modal event
		if (receivedData?.payload.modal && !setting) {
			modalStyle = mapModalTopicToStyle(receivedData.topic, modalStyle);
			setting = true;
			showModal = true;
			modalStyle.body = receivedData?.payload.modal.message;
			modalStyle.description = receivedData?.payload.modal.warningText;
		} else {
			setting = false;
		}

		setShowModalAtt(showModal);
	}

	const companyId = $configurationStore.data?.user?.selectedCompanyId;
	const storeId = $configurationStore.data?.user?.selectedStoreId;

	const pisUrl = new URL(`${env.VITE_PIS_IFRAME}/${iframePath}`);
	pisUrl.searchParams.append('ref_id', `sellsuki.company:${companyId}`);
	pisUrl.searchParams.append('store_id', storeId);
	pisUrl.searchParams.append('page_add_product', `${originUrl}/product/add`);
	pisUrl.searchParams.append('page_my_product', `${originUrl}/product`);
	pisUrl.searchParams.append('app_name', 'patona');
</script>

<svelte:window on:message={(e) => receiveEvent(e, env.VITE_PIS_IFRAME, setReceivedData)} />

<ssk-modal hideCloseButton>
	<div slot="body">
		<div class="content">
			<IconCircle
				iconName={modalStyle.iconName}
				iconColor="#fff"
				fixedCircleSize="2.5rem"
				fixedBgColor={modalStyle.color.code}
			/>
			{modalStyle.body}
			<span>{modalStyle.description ? modalStyle.description : ''}</span>
		</div>
		<div class="footer">
			<ssk-button
				width="full"
				variant="outline"
				themeColor="gray"
				color="red"
				on:click={() => {
					showModal = false;
				}}
			>
				{modalStyle.cancleButton}
			</ssk-button>
			<ssk-button
				width="full"
				themeColor={modalStyle.color.theme}
				on:click={handleSubmitButton(receivedData.topic, receivedData.payload.modal?.data)}
			>
				{modalStyle.okButton}
			</ssk-button>
		</div>
	</div>
</ssk-modal>

<iframe
	id="pis-product"
	width="100%"
	height="100%"
	src={pisUrl.toString()}
	frameborder="0"
	allowfullscreen
	title={iframeTitle}
	style="box-sizing: border-box;"
>
</iframe>

<style>
	.content {
		display: grid;
		justify-items: center;
		text-align: center;
		white-space: pre-line;
		gap: 1rem;
	}

	.footer {
		display: grid;
		grid-template-columns: 10rem 10rem;
		justify-content: center;
		gap: 1rem;
	}

	span {
		color: var(--ssk-colors-secondary-500);
		font-size: 20px;
		padding-bottom: 1rem;
	}

	ssk-modal {
		--width: 30vw;
		--border-color: white;
		--header-justify-content: center;
		--body-justify-content: center;
		--footer-display: flex;
		--footer-justify-content: space-between;
		--background-color-footer: white;
	}
</style>
