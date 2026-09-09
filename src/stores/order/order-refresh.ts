import { get, writable } from 'svelte/store';
import { storeGetOrder } from '$service/management-rest';
import { toPaymentTransaction } from '$service/payment-adapter';
import type { PaymentTransaction } from '$lib/entities/payment/payment-transaction';

/** Refresh callback of the currently-mounted order page (list or detail). */
const refresher = writable<(() => Promise<void> | void) | null>(null);

export function setOrderRefresher(fn: (() => Promise<void> | void) | null) {
	refresher.set(fn);
}

/** Deregister only if `fn` is still the active one — during route swaps the new
 *  page registers before the old page's onDestroy runs. */
export function clearOrderRefresher(fn: () => Promise<void> | void) {
	refresher.update((current) => (current === fn ? null : current));
}

/** Refresh the mounted order page in place (called by slip/payment modals after a mutation). */
export async function refreshOrders(): Promise<void> {
	const fn = get(refresher);
	if (fn) {
		try {
			await fn();
		} catch (err) {
			console.warn('[order-refresh] refresh failed:', err);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll OMS until `settled` returns true for the order's payment projection, or until
 * timeout. Payment attributes update asynchronously via Kafka, so a re-fetch right
 * after a slip mutation may still show the pre-mutation state. On timeout the last
 * fetched transaction is returned — the mutation already succeeded server-side.
 */
export async function waitForPaymentProjection(
	storeId: string,
	orderId: string,
	settled: (txn: PaymentTransaction | undefined) => boolean,
	opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<PaymentTransaction | undefined> {
	const intervalMs = opts?.intervalMs ?? 2000;
	const timeoutMs = opts?.timeoutMs ?? 15000;
	const startedAt = Date.now();

	let lastTxn: PaymentTransaction | undefined;

	while (true) {
		try {
			const order = await storeGetOrder(storeId, orderId);
			lastTxn = toPaymentTransaction(order);
			if (settled(lastTxn)) return lastTxn;
		} catch (err) {
			console.warn('[order-refresh] waitForPaymentProjection fetch failed, retrying:', err);
		}

		if (Date.now() - startedAt >= timeoutMs) {
			return lastTxn;
		}

		await sleep(intervalMs);
	}
}

/**
 * Background continuation for when the blocking poll timed out before the projection
 * settled (Kafka consumer lag can exceed 15s on dev). Keeps polling after the modal
 * closed and refreshes the page once the projection actually reflects the mutation.
 */
export function refreshWhenSettled(
	storeId: string,
	orderId: string,
	settled: (txn: PaymentTransaction | undefined) => boolean,
	opts?: { intervalMs?: number; timeoutMs?: number }
): void {
	void waitForPaymentProjection(storeId, orderId, settled, {
		intervalMs: opts?.intervalMs ?? 3000,
		timeoutMs: opts?.timeoutMs ?? 60000
	})
		.then((txn) => {
			if (settled(txn)) return refreshOrders();
		})
		.catch((err) => {
			console.warn('[order-refresh] background settle watch failed:', err);
		});
}
