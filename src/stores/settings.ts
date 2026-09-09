import type { Settings } from '$lib/entities/address/address';
import { get, writable } from 'svelte/store';
import { countriesList } from './country';

export type CountrySettings = {
	code: string;
	settings?: {
		phoneCode?: string;
	} & Settings;
};
export const settingsFormat = writable<CountrySettings[]>();
export const isUpdatedSettings = writable<boolean>(false);
export const setting = writable<CountrySettings>({
	code: ''
});

export async function loadSettings() {
	const cts = get(countriesList);
	const settings: CountrySettings[] = [];
	if (cts.data) {
		cts.data.map((c) => {
			settings.push({
				code: c.iso,
				settings: { ...c.settings, phoneCode: c.phoneCode }
			});
		});
	}

	settingsFormat.set(settings);
}

export async function setSettingFormatWithIso(iso?: string) {
	const settings = get(settingsFormat);
	const sIso = settings?.find((s) => s.code === iso);

	if (sIso) {
		await setting.set(sIso);
		await isUpdatedSettings.set(false);
	}
}
