import { writable, get } from 'svelte/store';
import {
	type UserConfiguration,
	type Configuration,
	type CompanyConfig,
	type StoreConfig,
	newUserConfiguration,
	newCompanyConfig,
	newStoreConfig,
	NameServiceConfig,
	ConfigKind
} from '$lib/entities/configuration/configuration';
import {
	createConfig,
	getBulkConfigs,
	getConfig,
	updateConfig,
	updateStoreConfig
} from '../service/central-configuration-rest';
import { set } from 'lodash';
import { profileInfo } from './profile';

interface ConfigurationData {
	user: UserConfiguration;
	companies: CompanyCollection;
	stores: StoreCollection;
}

interface CompanyCollection {
	[companyId: string]: CompanyConfig;
}
interface StoreCollection {
	[storeId: string]: StoreConfig;
}

interface ConfigurationState {
	loading: boolean;
	data: ConfigurationData;
}

export const configurationStore = writable<ConfigurationState>({
	loading: false,
	data: {
		user: newUserConfiguration(),
		companies: {},
		stores: {}
	}
});

export async function loadConfiguration() {
	configurationStore.update((c) => {
		return { ...c, loading: true };
	});

	const userID = get(profileInfo).data?.id!;
	const getConfigs = await getBulkConfigs([
		{
			service: NameServiceConfig.patonaSellerCenterUser,
			userId: userID,
			location: undefined
		},
		{
			service: NameServiceConfig.sellsukiGlobalUser,
			userId: userID,
			location: undefined
		}
	]);

	const patonaSellerCenterUserConfig = getConfigs?.find(
		(cfg) => cfg.service === NameServiceConfig.patonaSellerCenterUser
	);
	const sellsukiGlobalUserConfig = getConfigs?.find(
		(cfg) => cfg.service === NameServiceConfig.sellsukiGlobalUser
	);

	//create config
	if (patonaSellerCenterUserConfig?.version === 0) {
		await createConfig(
			NameServiceConfig.patonaSellerCenterUser,
			userID,
			undefined,
			patonaSellerCenterUserConfig.data as UserConfiguration
		);
	}
	if (sellsukiGlobalUserConfig?.version === 0) {
		await createConfig(
			NameServiceConfig.sellsukiGlobalUser,
			userID,
			undefined,
			sellsukiGlobalUserConfig.data as UserConfiguration
		);
	}

	//merge config
	const userConfig = {
		...patonaSellerCenterUserConfig?.data,
		...sellsukiGlobalUserConfig?.data
	};

	configurationStore.update((c) => {
		return {
			loading: false,
			data: {
				user: userConfig as UserConfiguration,
				companies: {},
				stores: {}
			}
		};
	});
}

const delaySendToServer = 500;
let updateTimer: ReturnType<typeof setTimeout>;

export async function updateUserConfiguration(uCfg: Partial<UserConfiguration>) {
	const profile = get(profileInfo);
	configurationStore.update((c) => {
		return set(c, 'data.user', { ...c.data.user, ...uCfg });
	});

	if (updateTimer) {
		clearTimeout(updateTimer);
	}

	updateTimer = setTimeout(async () => {
		const storeData = get(configurationStore);
		await updateConfig(
			NameServiceConfig.patonaSellerCenterUser,
			profile.data?.id!,
			undefined,
			storeData.data.user
		);
		await updateConfig(
			NameServiceConfig.sellsukiGlobalUser,
			profile.data?.id!,
			undefined,
			storeData.data.user
		);
	}, delaySendToServer);
}

export async function loadCompanyConfiguration(companyId: string) {
	if (!companyId) return;
	const userId = get(profileInfo).data?.id;
	if (!userId) return;

	try {
		const configs = await getBulkConfigs([
			{
				service: NameServiceConfig.sellsukiGlobalCompany,
				userId: '',
				location: companyId
			}
		]);

		const resp = configs?.find((c) => c.service === NameServiceConfig.sellsukiGlobalCompany);

		let companyData: CompanyConfig;
		if (resp?.version === 0) {
			companyData = newCompanyConfig();
			await createConfig(NameServiceConfig.sellsukiGlobalCompany, '', companyId, companyData);
		} else if (resp?.data?.kind === ConfigKind.Company) {
			companyData = resp.data as CompanyConfig;
		} else {
			companyData = newCompanyConfig();
		}

		configurationStore.update((c) => ({
			...c,
			data: {
				...c.data,
				companies: { ...c.data.companies, [companyId]: companyData }
			}
		}));
	} catch (err) {
		console.error('Error loading company configuration:', err);
		configurationStore.update((c) => ({
			...c,
			data: {
				...c.data,
				companies: { ...c.data.companies, [companyId]: newCompanyConfig() }
			}
		}));
	}
}

export async function loadStoreConfiguration(storeId: string) {
	if (!storeId) return;
	const userId = get(profileInfo).data?.id;
	if (!userId) return;

	try {
		const configs = await getBulkConfigs([
			{
				service: NameServiceConfig.patonaSellerCenterStore,
				userId: '',
				location: storeId
			}
		]);

		const resp = configs?.find((c) => c.service === NameServiceConfig.patonaSellerCenterStore);

		let storeData: StoreConfig;
		if (resp?.version === 0) {
			storeData = newStoreConfig();
			await createConfig(NameServiceConfig.patonaSellerCenterStore, '', storeId, storeData);
		} else if (resp?.data?.kind === ConfigKind.Store) {
			storeData = resp.data as StoreConfig;
		} else {
			storeData = newStoreConfig();
		}

		configurationStore.update((c) => ({
			...c,
			data: {
				...c.data,
				stores: { ...c.data.stores, [storeId]: storeData }
			}
		}));
	} catch (err) {
		console.error('Error loading store configuration:', err);
		configurationStore.update((c) => ({
			...c,
			data: {
				...c.data,
				stores: { ...c.data.stores, [storeId]: newStoreConfig() }
			}
		}));
	}
}

export async function updateStoreConfiguration(storeId: string, cfg: Partial<StoreConfig>) {
	const current = get(configurationStore).data.stores[storeId] ?? newStoreConfig();
	const next: StoreConfig = { ...current, ...cfg, kind: ConfigKind.Store };

	await updateStoreConfig(NameServiceConfig.patonaSellerCenterStore, '', storeId, next);

	configurationStore.update((c) => ({
		...c,
		data: {
			...c.data,
			stores: { ...c.data.stores, [storeId]: next }
		}
	}));
}
