import axios, { AxiosHeaders, type AxiosInstance } from 'axios';
import { shouldRedirectToLogin } from '../utils/auth-redirect';
import { navigateToLogin } from '../utils/navigate';
import { getMockAdapter } from '$lib/mock/mock-api';

type Send = {
	method: string;
	path: string;
	data?: any;
	userId?: string;
	query?: any;
};

type Optional = {
	data?: any;
	method: string;
	url: string;
	headers?: any;
	params?: any;
};

export class axiosClient {
	base: string;
	client: AxiosInstance;
	headers: any;

	constructor(base: string) {
		this.base = base;

		let addHdr: AxiosHeaders | undefined;
		try {
			addHdr = JSON.parse(import.meta.env.VITE_ADDITIONS_HEADERS);
		} catch (error) {}

		this.client = axios.create({
			baseURL: this.base,
			withCredentials: !addHdr,
			headers: addHdr,
			// DEV-ONLY: same mock adapter as the v2 client (serves i18n keywords
			// + languages). Statically gated → tree-shaken from prod builds.
			...(import.meta.env.VITE_MOCK_API ? { adapter: getMockAdapter() } : {})
		});

		this.client.interceptors.response.use(
			(response) => response,
			(error) => {
				if (
					typeof window !== 'undefined' &&
					shouldRedirectToLogin(error?.response?.status, error?.response?.data, error?.config?.url)
				) {
					navigateToLogin();
				}
				throw error;
			}
		);
	}

	private send = async ({ method, path, data, query, userId }: Send) => {
		const opts: Optional = {
			method,
			headers: JSON.parse(userId || '{}'),
			url: path
		};

		if (data) {
			opts.data = data;
		}

		if (query) {
			opts.params = query;
		}

		try {
			const { data } = await this.client({ ...opts });
			return data;
		} catch (error) {
			throw error;
		}
	};

	get<T>(path: string, query?: any): Promise<T> {
		return this.send({ method: 'GET', path, query });
	}

	del<T>(path: string, query?: any): Promise<T> {
		return this.send({ method: 'DELETE', path, query });
	}

	post<T>(path: string, data?: any, query?: any): Promise<T> {
		return this.send({ method: 'POST', path, data, query });
	}

	put<T>(path: string, data: any, query?: any): Promise<T> {
		return this.send({ method: 'PUT', path, data, query });
	}
}
