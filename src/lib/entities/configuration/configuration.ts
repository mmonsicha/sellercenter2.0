export interface Configuration {
	data: Partial<UserConfiguration> | CompanyConfig | StoreConfig;
	version?: number;
}

export const NameServiceConfig = {
	patonaSellerCenterUser:
		import.meta.env.VITE_CONFIGURATION_USER_PATONA_SELLER_CENTER ?? 'patona-seller-center-user',
	sellsukiGlobalUser:
		import.meta.env.VITE_CONFIGURATION_USER_SELLSUKI_GLOBAL ?? 'sellsuki-global-user',
	patonaSellerCenterStore:
		import.meta.env.VITE_CONFIGURATION_STORE_PATONA_SELLER_CENTER ?? 'patona-seller-center-store',
	sellsukiGlobalCompany:
		import.meta.env.VITE_CONFIGURATION_COMPANY_SELLSUKI_GLOBAL ?? 'sellsuki-global-company'
} as const;

export enum PaymentMode {
	Sukipay = 'sukipay',
	Legacy = 'legacy'
}

export enum ConfigKind {
	User = 'user',
	Company = 'company',
	Store = 'store'
}

//User Configuration
export interface UserConfiguration {
	kind: ConfigKind.User;
	uiTheme: string;
	language: string;
	selectedCompanyId: string;
	selectedStoreId: string;
	defaultCurrency: string;
	notifications: Notifications;
}

export interface Notifications {
	newOrderEmail: boolean;
	lowStockWarningApp: boolean;
	systemUpdatesEmail: boolean;
}

//Company Configuration
export interface CompanyConfig {
	kind: ConfigKind.Company;
	paymentMode: PaymentMode;
}

export const newCompanyConfig = (): CompanyConfig => ({
	kind: ConfigKind.Company,
	paymentMode: PaymentMode.Sukipay
});

//Store Configuration
export interface StoreConfig {
	kind: ConfigKind.Store;
	timeoutSeconds: number;
}

export const newStoreConfig = (): StoreConfig => ({
	kind: ConfigKind.Store,
	timeoutSeconds: 0
});

//Req BulkGetConfig
export interface BulkConfigratuion {
	service: keyof typeof NameServiceConfig;
	userId?: string;
	location?: string;
}

export const newUserConfiguration = (): UserConfiguration => ({
	kind: ConfigKind.User,
	uiTheme: '',
	language: '',
	selectedCompanyId: '',
	selectedStoreId: '',
	defaultCurrency: '',
	notifications: {
		newOrderEmail: true,
		lowStockWarningApp: true,
		systemUpdatesEmail: true
	}
});
