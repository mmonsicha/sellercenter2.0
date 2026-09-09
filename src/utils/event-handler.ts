export const replyEventToIframe = (data: any, id: string) => {
	const iframe = document.getElementById(id) as HTMLIFrameElement;
	if (iframe) {
		iframe.contentWindow?.postMessage(JSON.stringify(data), '*');
	}
};

export const receiveEvent = (
	event: MessageEvent,
	originalUrl: string,
	setReceivedData: (data: any) => void
) => {
	if (event.origin === originalUrl) {
		try {
			const topic = JSON.parse(event.data);
			setReceivedData(topic);
		} catch (error) {}
	}
};
