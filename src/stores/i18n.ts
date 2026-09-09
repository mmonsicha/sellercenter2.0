import type { KeywordDetail } from '$lib/entities/i18n/keyword';
import type { Language } from '$lib/entities/i18n/language';
import type { I18nStore } from '@sellsuki-org/sellsuki-components';
import { derived, get, writable } from 'svelte/store';
import { listKeyword, listLanguage } from '../service/i18n-rest';
import { configurationStore } from './configuration';

function getDefaultLanguage(): Language {
	return { code: 'th' };
}

export const isLoadedI18n = writable<boolean>(false);
export const currentLanguage = writable<Language>(getDefaultLanguage());
export const languages = writable<Language[]>([]);

export const allKeywords = writable<KeywordDetail>({});

// reactive keyword map for the current language — rebuilds whenever keywords load
// or the language changes. Falls back to the key itself when a translation is missing.
export const i18nKW = derived(
	[currentLanguage, allKeywords],
	([$currentLanguage, $allKeywords]) =>
		Object.fromEntries(
			Object.entries($allKeywords).map(([key, value]) => [
				key,
				value[$currentLanguage.code] ?? key
			])
		)
);

export function setCurrentLanguage(language: Language): void {
	let lang = get(languages);
	const matchedLang = lang.find((lang) => lang.code === language.code);
	if (matchedLang) {
		language = matchedLang;
	}
	currentLanguage.set(language);
}

export async function loadAndSetKeywords(i18nStore: I18nStore, tag: string): Promise<void> {
	isLoadedI18n.set(false);
	try {
		const keys = await listKeyword(tag);
		if (keys) {
			allKeywords.set(keys);
			await i18nStore.bulkSet(keys);
		}
	} catch (error) {
		console.error('An error occurred in keyword handling.:', error);
	} finally {
		isLoadedI18n.set(true);
	}
}

export async function loadLanguages(): Promise<void> {
	try {
		const resLang = await listLanguage();
		languages.set(resLang);
	} catch (error) {
		console.error('An error occurred while loading languages:', error);
	}
}

const selectedLanguage = derived(configurationStore, ($configurationStore) => {
	if ($configurationStore.data?.user?.language !== get(currentLanguage)?.code) {
		return $configurationStore.data?.user?.language;
	}
});

selectedLanguage.subscribe((selectLanguage) => {
	if (selectLanguage) {
		setCurrentLanguage({ code: selectLanguage });
	}
});

