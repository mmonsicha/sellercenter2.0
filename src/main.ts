import '@sellsuki-org/sellsuki-components';
import '@sellsuki-org/sellsuki-components/style.css';
import App from './App.svelte';
import './main.css';

const app = new App({
	target: document.getElementById('app')!
});

export default app;
