// i18n keys ,consumers must render them via the i18n store / <ssk-i18n-translate>.
export const TRANSFER_DATETIME_ERRORS = {
	future: 'payment.transfer_datetime.error.future',
	tooOld: 'payment.transfer_datetime.error.too_old',
	dateRequired: 'payment.transfer_datetime.error.date_required',
	timeRequired: 'payment.transfer_datetime.error.time_required',
	dateFormat: 'payment.transfer_datetime.error.date_format',
	timeFormat: 'payment.transfer_datetime.error.time_format'
} as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NO_TRANSFER_ERROR = { dateError: null, timeError: null } as const;

export function getTransferValidationErrors(
	date: string,
	time: string
): { dateError: string | null; timeError: string | null } {
	if (!date) return NO_TRANSFER_ERROR;

	const normalizedDate = normalizeTransferDate(date);
	const parsedDateOnly = normalizedDate ? new Date(`${normalizedDate}T00:00:00`) : null;
	if (!parsedDateOnly || isNaN(parsedDateOnly.getTime()))
		return { dateError: TRANSFER_DATETIME_ERRORS.dateFormat, timeError: null };

	const now = new Date();
	const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	const sevenDaysAgoStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

	if (parsedDateOnly >= startOfTomorrow)
		return { dateError: TRANSFER_DATETIME_ERRORS.future, timeError: null };
	if (parsedDateOnly < sevenDaysAgoStart)
		return { dateError: TRANSFER_DATETIME_ERRORS.tooOld, timeError: null };

	if (!time) return NO_TRANSFER_ERROR;

	let parsed: Date;
	try {
		parsed = new Date(toRFC3339(date, time));
	} catch {
		return { dateError: null, timeError: TRANSFER_DATETIME_ERRORS.timeFormat };
	}

	if (parsed > now) return { dateError: null, timeError: TRANSFER_DATETIME_ERRORS.future };
	if (parsed.getTime() < now.getTime() - SEVEN_DAYS_MS)
		return { dateError: null, timeError: TRANSFER_DATETIME_ERRORS.tooOld };

	return NO_TRANSFER_ERROR;
}

export function normalizeTransferDate(date: string): string | null {
	const trimmedDate = date.trim();
	if (!trimmedDate) return null;

	const isoMatch = trimmedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		const [, year, month, day] = isoMatch;
		return `${year}-${month}-${day}`;
	}

	const slashMatch = trimmedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4,5})$/);
	if (slashMatch) {
		const [, day, month, rawYear] = slashMatch;
		const numericYear = Number(rawYear.replace(/^0+/, '') || '0');
		const normalizedYear = numericYear > 2400 ? numericYear - 543 : numericYear;
		return `${normalizedYear.toString().padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	return null;
}

export function toRFC3339(date: string, time: string): string {
	const normalizedDate = normalizeTransferDate(date);
	if (!normalizedDate) {
		throw new RangeError(`Invalid transfer date: ${date}`);
	}

	const localDate = new Date(`${normalizedDate}T${time}:00`);
	if (Number.isNaN(localDate.getTime())) {
		throw new RangeError(`Invalid transfer datetime: ${date} ${time}`);
	}

	return localDate.toISOString();
}
