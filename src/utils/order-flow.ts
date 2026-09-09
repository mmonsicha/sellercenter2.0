import { FullfilmentType, OrderFlow } from '$lib/entities/order/order';

interface ResolveOrderFlowArgs {
	isSukipay: boolean;
	isOnline: boolean;
	fullfilmentType: FullfilmentType;
	hasBuyer: boolean;
	isDeliveryLater: boolean;
}

export function resolveOrderFlow(args: ResolveOrderFlowArgs): OrderFlow {
	if (args.isSukipay) {
		if (args.isOnline) {
			return OrderFlow.POS_ONLINE_SUKIPAY_V1;
		}
		switch (args.fullfilmentType) {
			case FullfilmentType.PickupImmediate:
				return OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_INSTANT_V1;
			case FullfilmentType.PickupLater:
				return OrderFlow.POS_OFFLINE_SUKIPAY_PICKUP_LATER_V1;
			case FullfilmentType.ShopDelivery:
				return OrderFlow.POS_OFFLINE_SUKIPAY_DELIVER_FROM_STORE_V1;
		}
	}

	return args.hasBuyer && args.isDeliveryLater
		? OrderFlow.POS_OFFLINE_DELIVERY_LATER
		: OrderFlow.POS_OFFLINE;
}
