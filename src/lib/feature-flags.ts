// Set in an env file to switch the feature off — same `VITE_DISABLE_*` convention the
// fulfilment and customer menus already use (Layout.svelte). Multi-parcel stays off in
// production until a backend can actually deliver a digital parcel (it is the cart that
// promises "ส่งทางอีเมลทันทีหลังชำระเงิน" and blocks payment to collect that email).
//
// A function, not a const: delivery-group.test.ts needs to flip this per test case, and
// a module-scope const baked in at import time can't be restubbed without a fresh module
// instance. `vi.mock('$lib/feature-flags')` can swap this function's return value freely.
export const isMultiParcelEnabled = (): boolean => !import.meta.env.VITE_DISABLE_MULTI_PARCEL;

// The discount-code field in the ส่วนลด modal. Off in production for the same reason:
// there is no coupon endpoint to validate a code against yet (see service/discount-code.ts),
// so a cashier must not be shown a box that looks like it checks anything. The quick
// 10/20/50 buttons beside it are plain amounts and stay on everywhere.
export const isDiscountCodeEnabled = (): boolean => !import.meta.env.VITE_DISABLE_DISCOUNT_CODE;
