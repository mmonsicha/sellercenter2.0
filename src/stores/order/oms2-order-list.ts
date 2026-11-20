// OMS 2.0 order-list store. Reads from the mock source (API bypassed, DES-2235);
// replace `listOms2Orders` with the real adapter once PAT-2617 is available.
import { writable } from 'svelte/store';
import {
	Oms2Tab,
	type Oms2ListQuery,
	type Oms2OrderRow
} from '$lib/entities/order/oms2-order-list';
import { listOms2Orders } from '$lib/mock/mock-oms2-orders';

export type Oms2ListState = {
	loading: boolean;
	error: boolean;
	rows: Oms2OrderRow[];
	total: number;
	tabCounts: Record<Oms2Tab, number>;
	unknownCount: number;
};

const emptyCounts = (): Record<Oms2Tab, number> => ({
	[Oms2Tab.All]: 0,
	[Oms2Tab.InProgress]: 0,
	[Oms2Tab.Completed]: 0,
	[Oms2Tab.Refund]: 0,
	[Oms2Tab.Cancelled]: 0
});

export const oms2OrderList = writable<Oms2ListState>({
	loading: false,
	error: false,
	rows: [],
	total: 0,
	tabCounts: emptyCounts(),
	unknownCount: 0
});

let seq = 0;

export async function loadOms2Orders(q: Oms2ListQuery): Promise<void> {
	const mine = ++seq; // drop stale responses when filters change quickly
	oms2OrderList.update((s) => ({ ...s, loading: true, error: false }));
	try {
		const r = await listOms2Orders(q);
		if (mine !== seq) return;
		oms2OrderList.set({ loading: false, error: false, ...r });
	} catch {
		if (mine !== seq) return;
		oms2OrderList.update((s) => ({ ...s, loading: false, error: true, rows: [], total: 0 }));
	}
}
