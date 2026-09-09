type AuthErrorPayload = {
	error?: string;
	error_code?: string | number;
};

type WrappedAuthErrorPayload = {
	error?: {
		code?: number;
		status?: string;
		message?: string;
	};
};

const authErrorValues = new Set(['unauthorized', 'unauthenticated']);

const skipAuthRedirectPaths = ['/user/profile', '/public/countries', '/public/languages', '/public/keywords/'];

const shouldSkipAuthRedirect = (url?: string): boolean => {
	if (!url) {
		return false;
	}

	return skipAuthRedirectPaths.some((path) => url.includes(path));
};

const isAuthErrorPayload = (data: unknown): boolean => {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const payload = data as AuthErrorPayload;
	const wrapped = data as WrappedAuthErrorPayload;
	const error = typeof payload.error === 'string' ? payload.error : '';
	const errorCode = typeof payload.error_code === 'string' ? payload.error_code : '';

	if (authErrorValues.has(error)) {
		return true;
	}

	if (authErrorValues.has(errorCode)) {
		return true;
	}

	if (payload.error === 'unauthenticated' && payload.error_code === 0) {
		return true;
	}

	if (wrapped.error?.code === 401) {
		return true;
	}

	if (wrapped.error?.status === 'Unauthorized') {
		return true;
	}

	return false;
};

export const shouldRedirectToLogin = (
	status?: number,
	data?: unknown,
	url?: string
): boolean => {
	if (shouldSkipAuthRedirect(url)) {
		return false;
	}

	if (status !== 401 && status !== 500) {
		return false;
	}

	return isAuthErrorPayload(data);
};
