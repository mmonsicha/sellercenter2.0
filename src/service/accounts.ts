import type { Profile } from '$lib/entities/identity/profile';

export type ProfileReponse = {
	avatar: string;
	email: string;
	first_name: string;
	gender: string;
	id: string;
	last_name: string;
	phone: string;
	verified: boolean;
};

const base = import.meta.env.VITE_AMS_URL;

export const cookieMatchingAndUserProfile = async (): Promise<Profile | undefined> => {
	return fetch(`${base}/cookie-matching/profile`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		redirect: 'follow'
	}).then((res) => {
		if (res.ok) {
			return res.json().then((data: ProfileReponse): Profile => {
				return {
					avatar: data.avatar,
					email: data.email,
					firstName: data.first_name,
					lastName: data.last_name,
					gender: data.gender,
					id: data.id,
					phone: data.phone,
					verified: data.verified
				};
			});
		}

		// if in 401, it means not login yet
		if (res.status === 401) {
			return undefined;
		}

		// otherwise, show error message
		res.text().then((t) => console.warn('Error: Sync cookie', t));
		return undefined;
	});
};

export const redirectCookieMatching = (redirectUrl?: string): void => {
	const u = new URL('/cookie-matching', base);
	u.searchParams.set('path', redirectUrl ?? window.location.href);

	window.location.href = u.toString();
};
