import axios from 'axios';

/** Returns true when err is an Axios error with the given HTTP status code. */
export function isAxiosErrorWithStatus(err: unknown, status: number): boolean {
	return axios.isAxiosError(err) && err.response?.status === status;
}
