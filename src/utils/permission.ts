import { managementCheckPermissionsEach } from '../service/management-rest';

export type PermissionStatus = Record<string, boolean>;

/**
 * DEV ONLY — `VITE_BYPASS_PERMISSIONS=true` in `.env.dev` makes every gate answer
 * "granted", so pages render for a dev user whose account holds no roles on the
 * selected company/store. For UI / design-system review, not a real capability.
 *
 * Compared against the string `'true'` on purpose: env values arrive as strings,
 * so a bare truthiness check would also treat `=false` as enabled.
 *
 * `import.meta.env.DEV` is false for every `vite build`, so this branch (and the
 * flag read) is statically eliminated from production bundles.
 *
 * Scope: this unlocks the permission *gate* only. A page that reads
 * `ErrorCode.PermissionDenied` off a real data response (e.g. Orders.svelte) can
 * still fall back to <PermissionDenied /> when the backend itself refuses.
 * For a fully offline shell, use `VITE_MOCK_API=true` instead.
 */
const bypassPermissions =
	import.meta.env.DEV && import.meta.env.VITE_BYPASS_PERMISSIONS === 'true';

const grantAll = (permissions: string[]): PermissionStatus =>
	permissions.reduce((acc, permission) => {
		acc[permission] = true;
		return acc;
	}, {} as PermissionStatus);

export const checkPermissionsEach = async (
	kind: string,
	id: string,
	permissions: string[]
): Promise<PermissionStatus> => {
	if (bypassPermissions) {
		return grantAll(permissions);
	}

	try {
		return await managementCheckPermissionsEach(kind, id, permissions);
	} catch (error) {
		return permissions.reduce((acc, permission) => {
			acc[permission] = false;
			return acc;
		}, {} as PermissionStatus);
	}
};
