import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		host: '0.0.0.0',
		allowedHosts: ['seller.sellsuki.local', '.ngrok-free.dev'],
		// The design system is `file:`-linked to ../../sellsuki-components-upgrade while the
		// 0.27.x beta is unpublished, so its dist resolves to real paths outside this root
		// and Vite refuses to serve them without an explicit allowance.
		fs: { allow: ['.', '../../sellsuki-components-upgrade'] }
	},
	define: {
		'process.env': process.env,
		// `import.meta.env.MODE` and `.BASE_URL` used to be overridden with the shell's
		// MODE / BASE_URL, which are normally unset — so Vite's own correct values were
		// replaced by the literal `undefined`, and reading BASE_URL threw. Nothing in src
		// referenced either one, so the overrides only ever broke the built-ins: MODE now
		// comes from --mode and BASE_URL from --base, as Vite documents.
		__APP_ENV__: JSON.stringify(process.env.MODE)
	},
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: '/src/lib',
			$components: '/src/components',
			$pages: '/src/pages',
			$stores: '/src/stores',
			$utils: '/src/utils',
			$types: '/src/types',
			$service: '/src/service'
		}
	}
});
