import type { GeoNames, GeoNamesAddressMapper } from '$lib/entities/address/address';
import { type Address as AddressEntity } from '$lib/entities/address/address';
import Dexie from 'dexie';
import { uniqBy } from 'lodash';
import { listGeoNames } from '../../service/management-rest';

const DB_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const TABLE_NAME = 'geo';
const TABLE_PREFIX = 'geo-names';
const STORAGE_SUFFIX = {
	lastFetch: (code: string) => `${TABLE_PREFIX}-${code}-lastFetch`,
	languages: (code: string) => `${TABLE_PREFIX}-${code}-languages`
};

export const addressMapperNames: (keyof GeoNamesAddressMapper)[] = [
	'administrative_name_level_1',
	'administrative_name_level_2',
	'administrative_name_level_3',
	'locality_name_level_1',
	'locality_name_level_2',
	'locality_name_level_3'
];

export const countryMapperNames: Partial<Record<keyof AddressEntity, keyof GeoNamesAddressMapper>> =
	{
		administrativeAreaLevel1: 'administrative_name_level_1',
		administrativeAreaLevel2: 'administrative_name_level_2',
		administrativeAreaLevel3: 'administrative_name_level_3',
		localityAreaLevel1: 'locality_name_level_1',
		localityAreaLevel2: 'locality_name_level_2',
		localityAreaLevel3: 'locality_name_level_3'
	};

export type GeoNamesRow = { id?: number; language: string } & GeoNames;
export type SearchResult = { geoNames: GeoNamesRow[]; total: number };

type GeoNamesInstance = {
	db?: Dexie;
	promise: Promise<void>;
};

const geoNamesInstances = new Map<string, GeoNamesInstance>();

function createDexie(countryCode: string, languages: string[]): Dexie {
	const db = new Dexie(`${TABLE_PREFIX}-${countryCode}`);
	const indices = ['postalCode'];

	for (const lang of languages) {
		for (const key of addressMapperNames) {
			indices.push(`addressMapper.${key}.${lang}`);
		}
	}

	db.version(1).stores({
		[TABLE_NAME]: `++id,${indices.join(',')}`
	});

	return db;
}

export function listDistinctLanguages(data: GeoNames[]): string[] {
	const languages = new Set<string>();
	for (const geo of data) {
		const mapper = geo.addressMapper;
		if (!mapper) continue;
		for (const key of addressMapperNames) {
			const names = mapper[key] as Record<string, string> | undefined;
			if (names) Object.keys(names).forEach((lang) => languages.add(lang));
		}
	}
	return [...languages];
}

export function loadGeoNames(countryCode: string): Promise<void> {
	const existing = geoNamesInstances.get(countryCode);
	if (existing && existing?.db === undefined) {
		return existing.promise;
	}

	let resolveFn: () => void = () => {};
	const promise = new Promise<void>((resolve) => (resolveFn = resolve));

	geoNamesInstances.set(countryCode, {
		promise
	});

	(async () => {
		const now = Date.now();
		const lastFetch = localStorage.getItem(STORAGE_SUFFIX.lastFetch(countryCode));
		const languagesRaw = localStorage.getItem(STORAGE_SUFFIX.languages(countryCode));

		if (lastFetch && now - Number(lastFetch) < DB_CACHE_TTL && languagesRaw) {
			const languages: string[] = JSON.parse(languagesRaw);
			const db = createDexie(countryCode, languages);
			geoNamesInstances.set(countryCode, {
				db,
				promise: Promise.resolve()
			});
			resolveFn();
			return;
		}

		const { data } = await listGeoNames(countryCode, 0, 696969);
		if (!data?.length) {
			resolveFn();
			return;
		}

		const languages = listDistinctLanguages(data);
		const db = createDexie(countryCode, languages);
		await db.table(TABLE_NAME).clear();
		await db.table(TABLE_NAME).bulkAdd(data);

		localStorage.setItem(STORAGE_SUFFIX.lastFetch(countryCode), now.toString());
		localStorage.setItem(STORAGE_SUFFIX.languages(countryCode), JSON.stringify(languages));

		geoNamesInstances.set(countryCode, {
			db,
			promise: Promise.resolve()
		});

		resolveFn();
	})();

	return promise;
}

export async function searchGeoNames(
	countryCode: string,
	field: keyof AddressEntity,
	search: string,
	softLimit = 100
): Promise<SearchResult> {
	await loadGeoNames(countryCode);
	const instance = geoNamesInstances.get(countryCode);
	if (!instance?.db) {
		return { geoNames: [], total: 0 };
	}

	const db = instance.db;
	const langRaw = localStorage.getItem(STORAGE_SUFFIX.languages(countryCode));
	const languages: string[] = Array.isArray(langRaw) ? langRaw : JSON.parse(langRaw ?? '[]');

	let results: GeoNamesRow[] = [];

	if (field === 'postalCode') {
		results = await db
			.table(TABLE_NAME)
			.where('postalCode')
			.startsWithIgnoreCase(search)
			.limit(softLimit)
			.offset(0)
			.sortBy('postalCode');
	} else {
		const dbField = countryMapperNames[field];
		if (!dbField) return { geoNames: [], total: 0 };

		const langResults = await Promise.all(
			languages.map(async (lang) => {
				const fieldPath = `addressMapper.${dbField}.${lang}`;
				const partial = await db
					.table(TABLE_NAME)
					.where(fieldPath)
					.startsWithIgnoreCase(search)
					.limit(softLimit)
					.offset(0)
					.toArray();
				return partial.map((entry) => ({ ...entry, language: lang }) as GeoNamesRow);
			})
		);
		results = uniqBy(langResults.flat(), 'id');
	}

	return {
		geoNames: results,
		total: results.length
	};
}
