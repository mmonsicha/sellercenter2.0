const amsUrl = import.meta.env.VITE_AMS_URL;
const amsPatona = import.meta.env.VITE_ACCOUNT_PATONA_URL;
const ccsCompany = import.meta.env.VITE_CCS_3;

export function navigateToLogout() {
	// NOTE: on logout must be location.origin, after logout is always return to home
	window.location.href = `${amsUrl}/logout?return_to=${window.location.origin}&theme=patona`;
}

export function navigateToSettings() {
	window.location.href = `${amsUrl}/settings?return_to=${window.location.href}&theme=patona`;
}

export function navigateToLogin(path?: string) {
	window.location.href = `${amsUrl}/login?return_to=${path ?? window.location.href}&theme=patona`;
}

export function navigateToRegister() {
	window.location.href = `${amsUrl}/registration?return_to=${window.location.href}&theme=patona`;
}

export async function navigateToSyncLogin() {
	window.location.href = `${amsUrl}/cookie?destination_accounts_url=${amsPatona}&referer=${window.location.href}`;
}

export async function navigateToCCSCompany() {
	window.location.href = ccsCompany;
}
