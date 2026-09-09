export const getStringParam = (params: URLSearchParams, key: string, fallback = ''): string => {
	const value = params.get(key);
	return value !== null ? value : fallback;
};

export const getNumberParam = (params: URLSearchParams, key: string, fallback = 0): number => {
	const value = params.get(key);
	if (value === null) {
		return fallback;
	}

	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

export const getDelimitedParam = (
	params: URLSearchParams,
	key: string,
	separator = ',',
	{ decode = false, emptyAsUndefined = true }: { decode?: boolean; emptyAsUndefined?: boolean } = {}
): string[] | undefined => {
	const value = params.get(key);

	if (!value) {
		return emptyAsUndefined ? undefined : [];
	}

	const source = decode ? decodeURIComponent(value) : value;
	const result = source.split(separator).filter(Boolean);

	if (result.length === 0 && emptyAsUndefined) {
		return undefined;
	}

	return result;
};

type QueryDescriptor<T> = {
	key?: string;
	parser: (params: URLSearchParams, key: string, fallback: T) => T;
	fallback: T;
};

type DescriptorResult<T extends Record<string, QueryDescriptor<any>>> = {
	[K in keyof T]: ReturnType<T[K]['parser']>;
};

type StringOptions<T extends string> = {
	key?: string;
	fallback?: T;
	emptyAsFallback?: boolean;
};

export function stringQuery(): QueryDescriptor<string>;
export function stringQuery<T extends string>(options: StringOptions<T>): QueryDescriptor<T>;
export function stringQuery<T extends string>(options: StringOptions<T> = {}) {
	const fallback = (options?.fallback ?? '') as T;
	const emptyAsFallback = options?.emptyAsFallback ?? false;

	return {
		key: options?.key,
		parser: (params: URLSearchParams, key: string, fb: T) => {
			const value = getStringParam(params, key, fb as string) as T;
			if (emptyAsFallback && value.length === 0) {
				return fb;
			}
			return value;
		},
		fallback
	};
}

type NumberOptions<T extends number> = {
	key?: string;
	fallback?: T;
};

export function numberQuery(): QueryDescriptor<number>;
export function numberQuery<T extends number>(options: NumberOptions<T>): QueryDescriptor<T>;
export function numberQuery<T extends number>(options: NumberOptions<T> = {}) {
	const fallback = (options?.fallback ?? 0) as T;

	return {
		key: options?.key,
		parser: (params: URLSearchParams, key: string, fb: T) =>
			getNumberParam(params, key, fb) as unknown as T,
		fallback
	};
}

type DelimitedOptions<T extends string[] | undefined> = {
	key?: string;
	fallback?: T;
	separator?: string;
	decode?: boolean;
	emptyAsUndefined?: boolean;
};

export function delimitedQuery(): QueryDescriptor<string[] | undefined>;
export function delimitedQuery<T extends string[] | undefined>(
	options: DelimitedOptions<T>
): QueryDescriptor<T>;
export function delimitedQuery<T extends string[] | undefined>(
	options: DelimitedOptions<T> = {}
) {
	const { separator, decode, emptyAsUndefined } = options;
	const fallback = options.fallback ?? (undefined as T);

	return {
		key: options.key,
		parser: (params: URLSearchParams, key: string, fb: T) =>
			(getDelimitedParam(params, key, separator, {
				decode,
				emptyAsUndefined
			}) as T) ?? fb,
		fallback
	};
}

export const getVarFromQuery = <T extends Record<string, QueryDescriptor<any>>>(
	params: URLSearchParams,
	descriptors: T
): DescriptorResult<T> => {
	const entries = Object.entries(descriptors) as Array<[keyof T, T[keyof T]]>;
	const result = {} as DescriptorResult<T>;

	for (const [name, descriptor] of entries) {
		const queryKey = descriptor.key ?? (name as string);
		result[name] = descriptor.parser(params, queryKey, descriptor.fallback);
	}

	return result;
};
