<script lang="ts">
	import Layout from '$components/Layout.svelte';
	import Home from '$pages/Home.svelte';
	import NotFound from '$pages/NotFound.svelte';
	import NewCompany from '$pages/company/NewCompany.svelte';
	import Tos from '$pages/company/Tos.svelte';
	import ContactUs from '$pages/contact/ContactUs.svelte';
	import CustomerCreate from '$pages/customer/Create.svelte';
	import CustomerEdit from '$pages/customer/Edit.svelte';
	import CustomerList from '$pages/customer/List.svelte';
	import CustomerView from '$pages/customer/View.svelte';
	import Order from '$pages/order/list/Orders.svelte';
	import OrderView from '$pages/order/view/Order.svelte';
	import ProductAdd from '$pages/product/ProductAdd.svelte';
	import ProductList from '$pages/product/ProductList.svelte';
	import Sale from '$pages/sales/Sale.svelte';
	import Settings from '$pages/setting/index.svelte';
	import NewStore from '$pages/store/NewStore.svelte';
	import { companyList, loadCompany } from '$stores/company/company';
	import { currentCompany, setCurrentCompany } from '$stores/company/current-company';
	import {
		configurationStore,
		loadConfiguration,
		loadCompanyConfiguration,
		loadStoreConfiguration
	} from '$stores/configuration';
	import { currentStore } from '$stores/store/current-store';
	import { loadCountries } from '$stores/country';
	import { loadProfile, profileInfo } from '$stores/profile';
	import { loadSettings } from '$stores/settings';
	import { loadPrinterConfig } from '$stores/thermal-printer';
	import { toast } from '$stores/toast';
	import { IdbI18nStore, InMemoryToastStore, applyTheme } from '@sellsuki-org/sellsuki-components';
	import { onMount, setContext } from 'svelte';
	import { Route, Router, navigate } from 'svelte-routing';

	const theme = applyTheme({
		colors: {
			gray: {
				50: '#F9FAFB',
				100: '#F3F4F6',
				200: '#E5E7EB',
				300: '#D1D5DB',
				400: '#9CA3AF',
				500: '#6B7280',
				600: '#4B5563',
				700: '#374151',
				800: '#1F2937',
				900: '#111827'
			},
			primary: {
				'50': '#FCEFE7',
				'100': '#F9DDCE',
				'200': '#F4BC9E',
				'300': '#F19B70',
				'400': '#EE7B46',
				'500': '#EC5E2A',
				'600': '#BC4B20',
				'700': '#8D3816',
				'800': '#5E250B',
				'900': '#2F1203',
				'1000': '#1A0800'
			},
			secondary: {
				'100': '#ffe6e6',
				'200': '#ff9194',
				'300': '#ff5e62',
				'400': '#ff5e62',
				'500': '#ff2e33',
				'600': '#ff0006',
				'700': '#d90005',
				'800': '#b50004',
				'900': '#910003',
				'1000': '#730003'
			},
			button: {
				500: '#E5E7EB'
			},
			sky: {
				'50': '#F0F9FF',
				'100': '#D9F2FF',
				'200': '#BCE8FF',
				'300': '#8EDCFF',
				'400': '#58C6FF',
				'500': '#32A9FF',
				'600': '#1B8BF5',
				'700': '#1473E1',
				'800': '#175CB6',
				'900': '#194F8F'
			},
			stroke: {
				'50': '#E5E7EB',
				'100': '#F9FAFB',
				'500': '#6B7280'
			}
		}
	});

	const i18nStore = new IdbI18nStore('ssk-i18n');
	const toastStore = new InMemoryToastStore();
	toast.set(toastStore);
	setContext('toast', toastStore);
	setContext('i18n', i18nStore);
	export let url = window.location.pathname;

	onMount(async () => {
		await loadProfile();
		await loadCountries();
		Promise.all([loadSettings(), loadPrinterConfig()]);
	});

	companyList.subscribe((v) => {
		if (!v.loading && v.data?.length == 0) {
			navigate('/company/new');
		}
	});

	let lastLoadedCompanyId = '';
	currentCompany.subscribe((c) => {
		if (c?.id && c.id !== lastLoadedCompanyId) {
			lastLoadedCompanyId = c.id;
			loadCompanyConfiguration(c.id);
		}
	});

	let lastLoadedStoreId = '';
	currentStore.subscribe((s) => {
		if (s?.id && s.id !== lastLoadedStoreId) {
			lastLoadedStoreId = s.id;
			loadStoreConfiguration(s.id);
		}
	});

	profileInfo.subscribe(async (profile) => {
		if (!profile.loading && profile.data) {
			await loadCompany();
			await loadConfiguration();

			//no company or store selected
			if (
				!(
					$configurationStore.data?.user?.selectedCompanyId &&
					$configurationStore.data?.user?.selectedStoreId
				)
			) {
				setCurrentCompany();
			}

			if (window.clarity) {
				window.clarity('set', 'identity_email', profile.data?.email);
			}
		}
	});
</script>

<!-- svelte-ignore missing-declaration -->

<ssk-theme-provider {theme}>
	<ssk-i18n-provider store={i18nStore}>
		<ssk-toast-provider toast={toastStore}>
			<!-- basepath follows the build's base so a sub-path review deploy matches routes;
			     '/' in every normal build, which is Router's own default. -->
			<Router {url} basepath={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
				<Layout>
					{#if !$companyList.loading}
						<Route path="*" component={NotFound} />
						<Route path="/" component={Home} />
						<Route path="/company/new" component={NewCompany} />
						<Route path="/company/tos" component={Tos} />
						<Route path="/store/new" component={NewStore} />
						<Route path="/product" component={ProductList} />
						<Route path="/product/add" component={ProductAdd} />
						<Route path="/sales" component={Sale} />
						<Route path="/order" component={Order} />
						<Route path="/order/view/:order_id" let:params>
							<OrderView orderId={params.order_id} />
						</Route>
						<Route path="/contact" component={ContactUs} />
						<Route path="/customers/new" component={CustomerCreate} />
						<Route path="/customers/edit/:customerId" let:params>
							<CustomerEdit customerId={params.customerId} />
						</Route>
						<Route path="/customers/view/:customerId" let:params>
							<CustomerView customerId={params.customerId} />
						</Route>
						<Route path="/customers" component={CustomerList} />
						<Route path="/settings" component={Settings} />
					{/if}
				</Layout>
			</Router>
		</ssk-toast-provider>
	</ssk-i18n-provider>
</ssk-theme-provider>
