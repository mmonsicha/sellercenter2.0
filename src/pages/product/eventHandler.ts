import { replyEventToIframe } from '$utils/event-handler';
import { navigate } from 'svelte-routing';

const idProduct = 'pis-product';
export type ReplyTopic = {
	topic: string;
	sender: string;
	payload: any;
};

export type Topic = {
	topic: string;
	sender: string;
	payload: Payload;
};

type Payload = {
	toast?: ToastInfo;
	modal?: ModalInfo;
	origin?: string;
	path?: string;
};

type ToastInfo = {
	message: string;
	type: 'success' | 'error' | 'info' | 'warning' | undefined;
	icon: {
		color: string;
	};
};

type ModalInfo = {
	message: string;
	warningText?: string;
	data: any; // whatever PIS needs to reply to
};

interface MapGeneralType<T> {
	[key: string]: T;
}

export type ModalStyle = {
	iconName: string;
	okButton: string;
	body: string;
	description?: string;
	cancleButton: string;
	color: {
		theme: string;
		code: string;
	};
};

export const mapModalTopicToSubmitAction: MapGeneralType<(data?: any) => void> = {
	'pis.product.cancel.add': () => navigate('/product'),
	'pis.product.cancel.edit': (data: any) => replyEventToIframe(data, idProduct),
	'pis.product.list.remove': (data: any) => replyEventToIframe(data, idProduct),
	'pis.product.variant': (data: any) => replyEventToIframe(data, idProduct),
	'pis.product.setting': (data: any) => replyEventToIframe(data, idProduct)
};

export const mapModalTopicToStyle = (topic: string, modalInfo: ModalStyle): ModalStyle => {
	switch (topic) {
		case 'pis.product.cancel.add':
		case 'pis.product.cancel.edit': {
			modalInfo.iconName = 'outline-exclamation-circle';
			modalInfo.okButton = 'ตกลง';
			modalInfo.color = {
				theme: 'primary',
				code: '#F97316'
			};
			return modalInfo;
		}

		default:
			modalInfo.okButton = 'ลบ';
			modalInfo.color = {
				theme: 'secondary',
				code: '#FF0006'
			};
			return modalInfo;
	}
};
