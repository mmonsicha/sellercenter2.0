import { newAxiosClient } from '$lib/axios-client-v2';
import type {
	BulkConfigratuion,
	UserConfiguration,
	CompanyConfig,
	StoreConfig,
	NameServiceConfig
} from '$lib/entities/configuration/configuration';
import type { paths } from './management-gen';
import {
	configratuionEntityToEntity,
	requestToBulkModel,
	cfgToConfigurationReqEntityUser
} from './central-configuration-adapter';
const env = import.meta.env;

const base = env.VITE_MANAGEMENT_URL;

// No request dedup (singleRequestPerPath=false): user/company/store config loads
// hit the same /configuration path concurrently — dedup would abort all but the last.
const CentralConfigurationClient = newAxiosClient(base, undefined, false);

//get config
export const getConfig = async (
	service: keyof typeof NameServiceConfig,
	identity: string,
	location: string | undefined
) => {
	try {
		const config = await CentralConfigurationClient.get<
			paths['/configuration/{service}']['get']['responses'][200]['content']['application/json']
		>(`/configuration/${service}`, {
			params: {
				userId: identity,
				...(location && { location })
			}
		});

		return configratuionEntityToEntity(config.data);
	} catch (error) {
		console.error('Error fetching Configration:', error);
		return undefined;
	}
};

//get bulk config
export const getBulkConfigs = async (reqConfigs: BulkConfigratuion[]) => {
	try {
		const listReqConfigs = reqConfigs.map((inputItem) => {
			return requestToBulkModel(inputItem);
		});

		const configs = await CentralConfigurationClient.post<
			paths['/configuration/bulk']['post']['responses'][200]['content']['application/json']
		>(`/configuration/bulk`, listReqConfigs);

		return configs.data.map((cfg) => {
			return { service: cfg.service, ...configratuionEntityToEntity(cfg) };
		});
	} catch (error) {
		console.error('Error fetching Configrations:', error);
		return undefined;
	}
};

//create config
export const createConfig = async (
	service: keyof typeof NameServiceConfig,
	identity: string,
	location: string | undefined,
	cfg: UserConfiguration | CompanyConfig | StoreConfig
) => {
	const bodyConfig = cfgToConfigurationReqEntityUser({ data: cfg }, service);
	const resp = await CentralConfigurationClient.post<
		paths['/configuration/{service}']['post']['responses'][201]['content']['application/json']
	>(`/configuration/${service}`, bodyConfig, {
		params: {
			userId: identity,
			...(location && { location })
		}
	});
	return resp.data;
};

//update config
export const updateConfig = async (
	service: keyof typeof NameServiceConfig,
	identity: string,
	location: string | undefined,
	cfg: UserConfiguration | CompanyConfig | StoreConfig
) => {
	const bodyConfig = cfgToConfigurationReqEntityUser({ data: cfg }, service);
	const resp = await CentralConfigurationClient.put<
		paths['/configuration/{service}']['put']['responses'][200]['content']['application/json']
	>(`/configuration/${service}`, bodyConfig, {
		params: {
			userId: identity,
			...(location && { location })
		}
	});
	return resp.data;
};

//update store config (with permission check on the backend)
export const updateStoreConfig = async (
	service: keyof typeof NameServiceConfig,
	identity: string,
	location: string | undefined,
	cfg: UserConfiguration | CompanyConfig | StoreConfig
) => {
	const bodyConfig = cfgToConfigurationReqEntityUser({ data: cfg }, service);
	const resp = await CentralConfigurationClient.put<
		paths['/configuration/store/{service}']['put']['responses'][200]['content']['application/json']
	>(`/configuration/store/${service}`, bodyConfig, {
		params: {
			userId: identity,
			...(location && { location })
		}
	});
	return resp.data;
};

//delete config
export const deleteConfig = async (
	service: keyof typeof NameServiceConfig,
	location: string,
	userID: string
) => {
	const resp = await CentralConfigurationClient.delete<
		paths['/configuration/{service}']['delete']['responses'][200]['content']['application/json']
	>(`/configuration/${service}`, {
		params: {
			userId: userID,
			...(location && { location })
		}
	});
	return resp.data;
};
