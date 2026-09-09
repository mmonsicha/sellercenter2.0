import { describe, it, expect, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({
	postMock: vi.fn(async () => ({ data: { ok: 'OK', compensating: true } }))
}));

vi.mock('$lib/axios-client-v2', () => ({
	newAxiosClient: () => ({
		post: postMock,
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		interceptors: {
			request: { use: vi.fn() },
			response: { use: vi.fn() }
		}
	})
}));

import { storeCancelOrder } from './management-rest';

describe('storeCancelOrder', () => {
	it('POSTs to /store/{sId}/order/{oId}/cancel with cancel_reason body and returns response data', async () => {
		const result = await storeCancelOrder('s1', 'o1', 'order_cancelled_by_seller');

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(postMock).toHaveBeenCalledWith('/store/s1/order/o1/cancel', {
			cancel_reason: 'order_cancelled_by_seller'
		});
		expect(result).toEqual({ ok: 'OK', compensating: true });
	});

	it('POSTs with cancel_reason + cancel_note body when reason=other and a note is provided', async () => {
		postMock.mockClear();

		await storeCancelOrder('s1', 'o1', 'other', '  ลูกค้าเปลี่ยนใจ  ');

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(postMock).toHaveBeenCalledWith('/store/s1/order/o1/cancel', {
			cancel_reason: 'other',
			cancel_note: 'ลูกค้าเปลี่ยนใจ'
		});
	});

	it('POSTs an empty {} body when reason and note are both omitted (unpaid case)', async () => {
		postMock.mockClear();

		await storeCancelOrder('s1', 'o1');

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(postMock).toHaveBeenCalledWith('/store/s1/order/o1/cancel', {});
	});

	it('omits cancel_note when note is empty/whitespace-only', async () => {
		postMock.mockClear();

		await storeCancelOrder('s1', 'o1', 'order_cancelled_by_customer', '   ');

		expect(postMock).toHaveBeenCalledTimes(1);
		expect(postMock).toHaveBeenCalledWith('/store/s1/order/o1/cancel', {
			cancel_reason: 'order_cancelled_by_customer'
		});
	});
});
