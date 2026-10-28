import '@sellsuki-org/sellsuki-components';
import '@sellsuki-org/sellsuki-components/style.css';
import App from './App.svelte';
import './main.css';

/**
 * Review builds are served from a sub-path (a GitHub Pages project site lives at
 * /<repo>/), but svelte-routing's `navigate()` writes the absolute path it is given —
 * all 27 call sites say `/order`, `/settings`, … — so the first in-app navigation would
 * jump out of the base and 404. Prefixing history writes here fixes every call site at
 * once and keeps the app's own code free of deployment concerns.
 *
 * Inert in every normal build: BASE_URL is '/' unless `vite build --base=…` says
 * otherwise, and then this whole block is skipped.
 */
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
if (basePath) {
	const withBase = (url: string | URL | null | undefined) => {
		if (typeof url !== 'string' || !url.startsWith('/')) return url;
		// Already inside the base (svelte-routing echoes the current path on some updates).
		if (url === basePath || url.startsWith(`${basePath}/`)) return url;
		return `${basePath}${url}`;
	};

	const { pushState, replaceState } = window.history;
	window.history.pushState = function (state, title, url) {
		return pushState.call(this, state, title, withBase(url));
	};
	window.history.replaceState = function (state, title, url) {
		return replaceState.call(this, state, title, withBase(url));
	};
}

const app = new App({
	target: document.getElementById('app')!
});

export default app;
