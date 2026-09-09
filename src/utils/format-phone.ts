/**
 * Phone for a compact summary: keeps the leading and trailing digits and masks the
 * middle (`0812345678` → `081***5678`). The cart's customer card has ~90px for this
 * line, so the full number plus an email was being cut mid-string; the masked form
 * always fits, and the full value stays available in the row's tooltip and in the
 * customer drawer.
 */
export const maskPhoneMiddle = (phone?: string): string => {
	const value = (phone ?? '').trim();
	if (value.length <= 7) return value;

	const head = value.slice(0, 3);
	const tail = value.slice(-4);
	return `${head}***${tail}`;
};
