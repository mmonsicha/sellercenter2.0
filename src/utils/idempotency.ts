export function createIdempotencyKey(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
