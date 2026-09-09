const ThaiMonths = [
	'ม.ค.',
	'ก.พ.',
	'มี.ค.',
	'เม.ย.',
	'พ.ค.',
	'มิ.ย.',
	'ก.ค.',
	'ส.ค.',
	'ก.ย.',
	'ต.ค.',
	'พ.ย.',
	'ธ.ค.'
];

const EnglishMonths = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

export function formatDateWithTime(fullDate: string): string {
	const date = new Date(fullDate);

	if (isNaN(date.getTime())) return fullDate;

	const sTime = formatTime(fullDate, 'Asia/Bangkok');
	const sDate = formatDate(fullDate, 'th');

	return `${sDate} ${sTime}`;
}

export function formatDate(dateStr: string | Date, lang: string): string {
	const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;

	let translatedMonth: string[] = ThaiMonths;
	let year = date.getFullYear();

	switch (lang) {
		case 'th':
			translatedMonth = ThaiMonths;
			year += 543;

			break;
		case 'en':
			translatedMonth = EnglishMonths;
			break;
	}

	if (isNaN(date.getTime())) return typeof dateStr === 'string' ? dateStr : '';

	const day = date.getDate();
	const month = date.getMonth();

	const monthName = translatedMonth[month];

	return `${day} ${monthName} ${year}`;
}

export function formatTime(dateStr: string, timezone: string): string {
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;

	const options: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: timezone
	};

	return date.toLocaleTimeString('en-TH', options);
}
