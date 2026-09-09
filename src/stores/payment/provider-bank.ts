import { writable, get } from 'svelte/store';
import { listProviderBanks } from '$service/management-rest';

/**
 * Map of provider bank display names keyed by bank code.
 *
 * Sourced from management-backend's `GET /provider-banks` (reference data backed by
 * sellsuki-pay's `ProviderBankService`). We resolve the slip's bank name from its
 * `bank_code` here instead of carrying the name on the SukiPay Kafka event — that
 * event now sends only `bank_code`, so consumers look the name up on the management
 * side.
 *
 * NOTE: account number / account name are NOT kept here — those come from the event
 * (`receiving_account`) and are always current. Only the bank label lives in this map.
 */
export const providerBankNames = writable<Record<string, string>>({});

let inflight: Promise<void> | null = null;

export async function loadProviderBankNames(): Promise<void> {
	if (Object.keys(get(providerBankNames)).length > 0) return;
	if (inflight) return inflight;

	inflight = (async () => {
		try {
			const banks = await listProviderBanks();
			const map: Record<string, string> = {};
			for (const b of banks) {
				if (b.code && b.name) map[b.code] = b.name;
			}
			providerBankNames.set(map);
		} catch (err) {
			console.warn('[payment] load provider bank names failed:', err);
		} finally {
			inflight = null;
		}
	})();

	return inflight;
}

/** Force a re-fetch even if names are already cached (e.g. banks list changed). */
export async function refreshProviderBankNames(): Promise<void> {
	providerBankNames.set({});
	return loadProviderBankNames();
}

export function bankNameByCode(code?: string): string | undefined {
	if (!code) return undefined;
	return get(providerBankNames)[code];
}
