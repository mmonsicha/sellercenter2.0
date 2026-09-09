// Shared amount-input sanitizer used by the POS payment modal and the
// edit-payment modal.
//
// Rules:
//   - keep only digits and one decimal point
//   - integer part: max 7 digits, no leading zeros ("007" → "7")
//   - decimal part: max 2 digits
//   - fractional-only values are rejected ("." / "0.5" / ".5" → "")
const MAX_INT_DIGITS = 7;
const MAX_DECIMAL_DIGITS = 2;

export function sanitizeAmount(raw: string): string {
	// Keep only digits and dots
	const cleaned = raw.trimStart().replace(/[^\d.]/g, '');

	// First dot is the decimal point; extra dots collapse into the
	// decimal part ("1.2.3" → int "1", dec "23")
	const [rawInt, ...rest] = cleaned.split('.');
	const hasDecimal = rest.length > 0;
	const rawDec = rest.join('');

	// Strip leading zeros; if nothing is left and there's a decimal,
	// the value is fractional-only ("." / "0.5") → reject
	const intPart = rawInt.replace(/^0+/, '');
	if (intPart === '' && hasDecimal) return '';

	// Cap lengths
	const intCapped = intPart.slice(0, MAX_INT_DIGITS);
	const decCapped = rawDec.slice(0, MAX_DECIMAL_DIGITS);
	return hasDecimal ? `${intCapped}.${decCapped}` : intCapped;
}
