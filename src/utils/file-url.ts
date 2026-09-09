// File-access URLs (`/file/access/private/?fileRecordID=...`) require a `refID`
// identifying the owning tenant, e.g. `&refID=sellsuki.company:<companyId>`.
export const withCompanyRef = (url?: string, companyId?: string): string | undefined => {
	if (!url || !companyId) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('refID', `sellsuki.company:${companyId}`);
		return u.toString();
	} catch {
		return url;
	}
};
