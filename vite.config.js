import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		host: '0.0.0.0',
		allowedHosts: ['seller.sellsuki.local']
	},
	define: {
		'process.env': process.env,
		'import.meta.env.MODE': process.env.MODE,
		'import.meta.env.BASE_URL': process.env.BASE_URL,
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
