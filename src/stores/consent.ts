import { getTosConsent } from '../service/management-rest';

export async function loadConsent() {
	const resp = await getTosConsent();
	return resp;
}
