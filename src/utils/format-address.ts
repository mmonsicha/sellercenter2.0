import type { Address } from '$lib/entities/address/address';

/**
 * One-line address exactly as the order payload carries it (buyer / seller
 * `address` string). Kept here so the cart UI and the order builder format the
 * same address the same way.
 */
export const addressToLine = (a: Address): string =>
	`${a.street},${a.localityAreaLevel1} ${a.administrativeAreaLevel2} ${a.administrativeAreaLevel1} ${a.postalCode}`;

/**
 * District → province → postcode only. Enough to tell two branches (or two of a
 * customer's addresses) apart on a single narrow line, without the street number
 * that pushes the line past the cart panel's width.
 */
export const addressToShort = (a: Address): string =>
	[
		a.administrativeAreaLevel2 || a.administrativeAreaLevel3,
		a.administrativeAreaLevel1,
		a.postalCode
	]
		.filter(Boolean)
		.join(' ');

/**
 * Address for reading, not for the payload: same parts as `addressToLine` but
 * space-separated, since the payload's `street,locality` comma renders as
 * "123 ถนนสุขุมวิท,คลองเตยเหนือ" with no space after the comma.
 */
export const addressToDisplay = (a: Address): string =>
	[
		a.street,
		a.localityAreaLevel1,
		a.administrativeAreaLevel3,
		a.administrativeAreaLevel2,
		a.administrativeAreaLevel1,
		a.postalCode
	]
		.filter(Boolean)
		.join(' ');
