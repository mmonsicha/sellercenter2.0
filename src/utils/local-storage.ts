type LocalStorage = {
	value: any;
	expiry?: number;
};

const now = new Date();

export const localStorageKey = {
	PATH_BACK_URL: 'back_url',
	DELETED_BRANCH_ID_STORAGE_KEY: 'deleted_id',
	CART: 'cart_local_store'
};

export const setItem = (key: string, value: any) => {
	localStorage.setItem(key, JSON.stringify({ value }));
};

export const setItemWithExpiry = (key: string, value: any, ttl: number) => {
	localStorage.setItem(key, JSON.stringify({ value, expiry: now.getTime() + ttl }));
};

export const getItem = (key: string): LocalStorage | null => {
	const itemStr = localStorage.getItem(key);
	// if the item doesn't exist, return null
	if (!itemStr) {
		return null;
	}
	const item: LocalStorage = JSON.parse(itemStr);

	// compare the expiry time of the item with the current time
	if (item.expiry && now.getTime() > item.expiry) {
		// If the item is expired, delete the item from storage
		removeItem(key);
		return null;
	}
	return item;
};

export const removeItem = (key: string) => {
	localStorage.removeItem(key);
};

export const clearExpiryItem = () => {
	let key: keyof typeof localStorageKey;
	for (key in localStorageKey) {
		const currentKey = localStorageKey[key];
		const itemStr = localStorage.getItem(currentKey);
		if (itemStr) {
			const item: LocalStorage = JSON.parse(itemStr);
			if (item.expiry && now.getTime() > item.expiry) {
				removeItem(currentKey);
			}
		}
	}
};
