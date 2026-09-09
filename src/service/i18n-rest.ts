import { axiosClient } from '$lib/axios.client';
import type { KeywordDetail } from '$lib/entities/i18n/keyword';
import type { operations } from './i18n-gen';
import { keywordToEntity, languagesToEntity } from './i18n-adapter';

const env = import.meta.env;

const base = env.VITE_I18N_URL;

const i18nClient = new axiosClient(base);

export const listKeyword = async (tag: string): Promise<KeywordDetail | undefined> => {
	try {
		const resp = await i18nClient.get<
			operations['GetPublicKeywordsTag']['responses'][200]['content']['application/json']
		>(`/public/keywords/${tag}`);

		return keywordToEntity(resp);
	} catch (error: any) {
		console.error('Error fetching keywords:', error);

		return undefined;
	}
};

export const listLanguage = async () => {
	const resp =
		await i18nClient.get<
			operations['GetPublicLanguages']['responses'][200]['content']['application/json']
		>(`/public/languages`);

	return languagesToEntity(resp);
};
