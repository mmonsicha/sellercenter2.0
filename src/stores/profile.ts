import type { Profile } from '$lib/entities/identity/profile';
import { navigate } from 'svelte-routing';
import { derived, writable } from 'svelte/store';
import { cookieMatchingAndUserProfile, redirectCookieMatching } from '../service/accounts';
import { getUserProfile } from '../service/management-rest';

export type ProfileState = {
	loading: boolean;
	data: Profile | undefined;
};

export const profileInfo = writable<ProfileState>({
	loading: false,
	data: undefined
});

export const isMember = derived(
	profileInfo,
	($profileInfo) => {
		return !!$profileInfo.data;
	},
	false
);

export async function loadProfile() {
	if (!import.meta.env.VITE_DISABLE_COOKIE_MATCHING) {
		if (!window.location.search.includes('cookie_matched')) {
			return redirectCookieMatching();
		} else {
			// remove "cookie_matched" from the query string
			const url = new URL(window.location.href);
			url.searchParams.delete('cookie_matched');
			url.searchParams.delete('auth');
			navigate(url.toString(), { replace: true });
		}
	}

	profileInfo.update((p) => {
		return { ...p, loading: true };
	});

	const profile = await getUserProfile();
	profileInfo.set({
		data: profile,
		loading: false
	});

	if (!profile) {
		navigate('/', { replace: true });

		return;
	}

	return;
}
