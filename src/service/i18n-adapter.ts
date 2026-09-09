import type { KeywordDetail } from '$lib/entities/i18n/keyword';
import type { Language } from '$lib/entities/i18n/language';
import type { components } from './i18n-gen';

const toLowerCaseTranslations = (translations: {
	[lang: string]: string;
}): { [lang: string]: string } => {
	const result: { [lang: string]: string } = {};
	for (const lang in translations) {
		if (Object.prototype.hasOwnProperty.call(translations, lang)) {
			result[lang.toLowerCase()] = translations[lang];
		}
	}
	return result;
};

export const keywordToEntity = (
	k: components['schemas']['TagListKeywordResponse']
): KeywordDetail => {
	const result: KeywordDetail = {};

	for (const key in k) {
		if (Object.prototype.hasOwnProperty.call(k, key)) {
			result[key] = toLowerCaseTranslations(k[key]);
		}
	}

	return result;
};

export const languagesToEntity = (
	languages: components['schemas']['LanguagesResponse'][]
): Language[] => {
	return languages.map((l) => ({
		img: l.image_base64,
		name: l.country_name,
		code: l.language_code!.toLocaleLowerCase()
	}));
};
