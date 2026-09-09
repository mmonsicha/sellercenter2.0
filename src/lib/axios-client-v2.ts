import { shouldRedirectToLogin } from '$utils/auth-redirect';
import { navigateToLogin } from '$utils/navigate';
import { getMockAdapter } from '$lib/mock/mock-api';
import axios, { AxiosHeaders, type AxiosRequestConfig } from 'axios';

export const newAxiosClient = (
	baseURL: string,
	headers?: AxiosHeaders,
	singleRequestPerPath = false
) => {
	let addHdr: AxiosHeaders | undefined;
	try {
		addHdr = JSON.parse(import.meta.env.VITE_ADDITIONS_HEADERS);
	} catch {}

	const client = axios.create({
		baseURL,
		withCredentials: !addHdr,
		headers: { ...addHdr, ...headers },
		// DEV-ONLY: serve offline mock data + bypass login. Statically gated so
		// this branch (and the mock module) is tree-shaken out of prod builds.
		...(import.meta.env.VITE_MOCK_API ? { adapter: getMockAdapter() } : {})
	});

	const pending: Record<string, AbortController> = {};

	client.interceptors.request.use((config) => {
		if (!singleRequestPerPath) return config;

		// Build full request URL (absolute with query)
		const key = getKeyFromConfig(config);

		if (pending[key]) {
			pending[key].abort();
		}

		const controller = new AbortController();
		config.signal = controller.signal;

		pending[key] = controller;

		return config;
	});

	client.interceptors.response.use(
		(response) => {
			if (singleRequestPerPath) {
				const key = getKeyFromConfig(response.config);
				delete pending[key];
			}
			return response;
		},
		(error) => {
			if (
				typeof window !== 'undefined' &&
				shouldRedirectToLogin(error?.response?.status, error?.response?.data, error?.config?.url)
			) {
				navigateToLogin();
			}

			if (singleRequestPerPath && error.config) {
				const key = getKeyFromConfig(error.config);
				delete pending[key];
			}
			throw error;
		}
	);

	return client;
};

function getKeyFromConfig(config: AxiosRequestConfig): string {
	const base = config.baseURL ?? '';
	const url = config.url ?? '';
	const fullUrl = new URL(url, base);

	if (config.params) {
		const searchParams = new URLSearchParams();

		for (const [key, value] of Object.entries(config.params)) {
			if (Array.isArray(value)) {
				value.forEach((v) => searchParams.append(key, v.toString()));
			} else if (value !== undefined && value !== null) {
				searchParams.append(key, value.toString());
			}
		}

		fullUrl.search = searchParams.toString();
	}

	return fullUrl.toString() ?? '';
}
