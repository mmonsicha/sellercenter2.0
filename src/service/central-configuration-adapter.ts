import type {
	BulkConfigratuion,
	Notifications,
	Configuration
} from '$lib/entities/configuration/configuration';
import type { components } from './management-gen';
type definitions = components['schemas'];
import {
	NameServiceConfig,
	PaymentMode,
	ConfigKind
} from '$lib/entities/configuration/configuration';

export function configratuionEntityToEntity(
	config: definitions['configurationResponse']
): Configuration | undefined {
	if (config.service === NameServiceConfig.patonaSellerCenterStore) {
		return {
			data: {
				kind: ConfigKind.Store,
				timeoutSeconds: (config.data?.['timeout_seconds'] ??
					config.data?.['timeoutSeconds'] ??
					0) as number
			},
			version: config.version as number
		};
	} else if (config.service === NameServiceConfig.patonaSellerCenterUser) {
		const notifications = config.data?.['notifications'] as Notifications;
		return {
			data: {
				kind: ConfigKind.User,
				uiTheme: config.data['uiTheme'] as string,
				selectedStoreId: config.data['selectedStoreId'] as string,
				defaultCurrency: config.data['defaultCurrency'] as string,
				notifications: {
					newOrderEmail: notifications.newOrderEmail,
					lowStockWarningApp: notifications.lowStockWarningApp,
					systemUpdatesEmail: notifications.systemUpdatesEmail
				}
			},
			version: config.version as number
		};
	} else if (config.service === NameServiceConfig.sellsukiGlobalUser) {
		return {
			data: {
				kind: ConfigKind.User,
				language: config.data['language'] as string,
				selectedCompanyId: config.data['selectedCompanyId'] as string
			},
			version: config.version as number
		};
	} else if (config.service === NameServiceConfig.sellsukiGlobalCompany) {
		const raw = (config.data?.['payment_mode'] ?? config.data?.['paymentMode']) as
			| string
			| undefined;
		const paymentMode = raw === PaymentMode.Legacy ? PaymentMode.Legacy : PaymentMode.Sukipay;
		return {
			data: {
				kind: ConfigKind.Company,
				paymentMode
			},
			version: config.version as number
		};
	} else {
		return undefined;
	}
}

export function cfgToConfigurationReqEntityUser(
	cfg: Configuration,
	service?: keyof typeof NameServiceConfig
): definitions['configurationRequest'] | undefined {
	if (cfg.data.kind === ConfigKind.User) {
		const {
			uiTheme,
			language,
			selectedCompanyId,
			selectedStoreId,
			defaultCurrency,
			notifications
		} = cfg.data;

		if (service === NameServiceConfig.patonaSellerCenterUser) {
			return {
				data: {
					...(uiTheme !== undefined && { uiTheme }),
					...(selectedStoreId !== undefined && { selectedStoreId }),
					...(defaultCurrency !== undefined && { defaultCurrency }),
					...(notifications !== undefined && { notifications })
				}
			};
		}

		if (service === NameServiceConfig.sellsukiGlobalUser) {
			return {
				data: {
					...(language !== undefined && { language }),
					...(selectedCompanyId !== undefined && { selectedCompanyId })
				}
			};
		}

		const data = {
			...(uiTheme !== undefined && { uiTheme }),
			...(language !== undefined && { language }),
			...(selectedCompanyId !== undefined && { selectedCompanyId }),
			...(selectedStoreId !== undefined && { selectedStoreId }),
			...(defaultCurrency !== undefined && { defaultCurrency }),
			...(notifications !== undefined && { notifications })
		};
		return { data: data };
	} else if (cfg.data.kind === ConfigKind.Company) {
		const { paymentMode } = cfg.data;
		return { data: { payment_mode: paymentMode } };
	} else if (cfg.data.kind === ConfigKind.Store) {
		const { timeoutSeconds } = cfg.data;
		return { data: { timeout_seconds: timeoutSeconds } };
	} else {
		return undefined;
	}
}

export function requestToBulkModel(
	req: BulkConfigratuion
): definitions['bulkConfigurationRequest'] {
	return {
		service: req.service,
		location: req.location,
		userId: req.userId
	};
}
