export type StringKey<T> = Exclude<
	{
		[K in keyof T]: T[K] extends string | undefined ? K : never;
	}[keyof T],
	undefined
>;

export type ObjectKeysOnly<T> = {
	[K in keyof T]: T[K] extends object | undefined
		? T[K] extends Function
			? never
			: T[K] extends any[]
				? never
				: K
		: never;
}[keyof T];
