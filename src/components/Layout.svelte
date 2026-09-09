<script lang="ts">
	import type { Company } from '$lib/entities/company/company';
	import { companyList } from '$stores/company/company';
	import { currentCompany } from '$stores/company/current-company';
	import { updateUserConfiguration } from '$stores/configuration';
	import {
		currentLanguage,
		i18nKW,
		isLoadedI18n,
		languages,
		loadAndSetKeywords,
		loadLanguages,
		setCurrentLanguage
	} from '$stores/i18n';
	import { setAction } from '$stores/saved-changes';
	import { currentStore } from '$stores/store/current-store';
	import { localStorageKey, setItem } from '$utils/local-storage';
	import {
		navigateToCCSCompany,
		navigateToLogin,
		navigateToLogout,
		navigateToRegister,
		navigateToSettings
	} from '$utils/navigate';
	import { type I18nStore } from '@sellsuki-org/sellsuki-components';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import { sidebar, sidebarExpandedGroup, sidebarToggle, type Sidebar } from '../stores/layout';
	import { isMember, profileInfo, type ProfileState } from '../stores/profile';
	import StoreDialog from './StoreDialog.svelte';
	import IconCircle from './IconCircle.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import UnsavedAlertModal from './modal/UnsavedAlertModal.svelte';

	const env = import.meta.env;

	type SidebarItem = {
		key: string;
		icon: string;
		iconActive: string;
		path: string;
		exact?: boolean;
		testid?: string;
	};

	type SideBarGroup = {
		key: string;
		items: SidebarItem[];
		hidden?: boolean;
	};

	let isOpenDialog: boolean = false;
	let userProfile: ProfileState;
	let isHideFullfilmentMenu = !!env.VITE_DISABLE_FULFILLMENT_FEATURE;
	let isHideCustomerMenu = !!env.VITE_DISABLE_CUSTOMER_FEATURE;

	const i18nStore = getContext<I18nStore>('i18n');
	const location = useLocation();

	let path = window.location.pathname;

	function handleCompanyDialog() {
		path = `${window.location.pathname}${window.location.search}`;
		setItem(localStorageKey.PATH_BACK_URL, path);
		isOpenDialog = !isOpenDialog;
	}

	function handleLogout() {
		setAction(navigateToLogout);
	}

	function handleSettings() {
		setAction(navigateToSettings);
	}

	function toCCS3() {
		setAction(navigateToCCSCompany);
	}

	function toHome() {
		setAction(() => navigate('/'));
	}

	function toContact() {
		setAction(() => navigate('/contact'));
	}

	function toSetting() {
		setAction(() => navigate('/settings'));
	}

	function handleClickOutside(e: Event) {
		if (!(e.target as HTMLDivElement).closest('.company-header')) {
			isOpenDialog = false;
		}
	}

	function handleExpandedGroups(e: CustomEvent) {
		sidebarExpandedGroup(e.detail.key, e.detail.expanded);
	}

	function isInPath(path: string, currentPath: string, exact = false) {
		// allow trailing slash
		if (exact) {
			return currentPath.replace(/\/$/, '') === path.replace(/\/$/, '');
		}

		return currentPath.startsWith(path);
	}

	function isShowNavBar(path: string): boolean {
		return (
			path.startsWith('/company/edit') ||
			(!path.startsWith('/company') && !path.startsWith('/store'))
		);
	}

	function isShowOnlyTopBar(path: string): boolean {
		return path.startsWith('/product/add');
	}

	function toKey(str: string) {
		return str.toLowerCase().replace(/\s/g, '-');
	}

	function isNoContentPadding(path: string): boolean {
		return path.startsWith('/sales');
	}

	function isNoContentPaddingCustomer(path: string): boolean {
		return path.startsWith('/customers/view/');
	}

	function withBackground(path: string): boolean {
		// WTF is this why not put background in `CompanyStoreConainer` instead ???
		const regexCheckPath = /^\/(contact|company\/new|company\/tos|store\/new)/;
		return regexCheckPath.test(path);
	}

	location.subscribe((value) => {
		path = value.pathname;
	});

	const sidebarGroupsLoggedIn: SideBarGroup[] = [
		{
			key: 'patona-sellercenter-sidebar-title-main',
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-home',
					path: '/',
					icon: 'outline-home',
					iconActive: 'solid-home',
					exact: true,
					testid: 'sidenav.menu.home'
				}
			]
		},
		{
			key: 'patona-sellercenter-sidebar-title-product',
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-myproduct',

					path: '/product',
					icon: 'outline-shopping-bag',
					iconActive: 'solid-shopping-bag',
					exact: true,
					testid: 'sidenav.menu.my-product'
				},
				{
					key: 'patona-sellercenter-sidebar-menu-addproduct',

					path: '/product/add',
					icon: 'outline-plus',
					iconActive: 'solid-plus',
					testid: 'sidenav.menu.add-product'
				}
			]
		},
		{
			key: 'patona-sellercenter-sidebar-title-ordermanagement',
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-sales',
					path: '/sales',
					icon: 'outline-shopping-cart',
					iconActive: 'solid-shopping-cart',
					exact: true,
					testid: 'sidenav.menu.sales'
				},
				{
					key: 'patona-sellercenter-sidebar-menu-myorder',
					path: '/order',
					icon: 'outline-document-text',
					iconActive: 'solid-document-text',
					testid: 'sidenav.menu.my-order'
				}
			]
		},
		{
			key: 'patona-sellercenter-sidebar-title-fulfillment',
			hidden: isHideFullfilmentMenu,
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-quicklabel',
					path: '/template',
					icon: 'outline-printer',
					iconActive: 'solid-printer'
				},
				{
					key: 'patona-sellercenter-sidebar-menu-parcelmanagement',
					path: '/parcel',
					icon: 'outline-archive-box',
					iconActive: 'solid-archive-box'
				}
			]
		},
		{
			key: 'patona-sellercenter-sidebar-title-customer-management',
			hidden: isHideCustomerMenu,
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-customerbook',
					path: '/customers',
					icon: 'outline-book-open',
					iconActive: 'solid-book-open'
				}
			]
		}
	];

	const sidebarGroupsGuest: SideBarGroup[] = [
		{
			key: 'patona-sellercenter-sidebar-title-main',
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-home',
					path: '/',
					icon: 'outline-home',
					iconActive: 'solid-home',
					exact: true
				}
			]
		},
		{
			key: 'patona-sellercenter-sidebar-title-fulfillment',
			hidden: isHideFullfilmentMenu,
			items: [
				{
					key: 'patona-sellercenter-sidebar-menu-quicklabel',
					path: '/template',
					icon: 'outline-printer',
					iconActive: 'solid-printer'
				}
			]
		}
	];

	let sidebarGroups: SideBarGroup[] = sidebarGroupsGuest;
	let sideBarState: Sidebar;

	sidebar.subscribe((value) => {
		sideBarState = value;
	});

	sidebar.set({
		expanded: true,
		expandedGroups: sidebarGroupsLoggedIn.map((group) => toKey(group.key))
	});

	profileInfo.subscribe((value) => {
		userProfile = value;
		if (value.data) {
			sidebarGroups = sidebarGroupsLoggedIn;
		} else {
			sidebarGroups = sidebarGroupsGuest;
		}
	});

	let currCm: Company;
	currentCompany.subscribe((c) => {
		if (c) currCm = c;
	});

	let currSt: any;
	currentStore.subscribe((s) => {
		if (s) currSt = s;
	});

	let cList: Company[];
	companyList.subscribe((c) => {
		if (c.data) cList = c.data;
	});

	let showLanguageDropdown = false;

	$: langList = $languages;

	function changeLanguage(code: string | undefined): boolean {
		const language = langList.find((lang) => lang.code === code);
		if (language) {
			updateUserConfiguration({
				language: code
			});
			return true;
		}
		return false;
	}

	onMount(async () => {
		await loadLanguages();
		setCurrentLanguage({ code: $currentLanguage.code });

		await loadAndSetKeywords(i18nStore, 'patona');
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
	});
</script>

{#if $isLoadedI18n}
	<main>
		{#if isShowNavBar(path)}
			<ssk-top-navbar>
				<div slot="left" class="top-navbar-item">
					<ssk-icon
						name="outline-bars-3-center-left"
						slot="left"
						type="button"
						on:click={sidebarToggle}
						on:keypress={sidebarToggle}
						role="button"
						cursor="pointer"
						tabindex="0"
						padding="8px"
						data-testid="topnav.icon.collapse-expand"
					/>
					<ssk-logo
						on:click={toHome}
						srcLogo="/images/logos/patona-logo-icon.svg"
						altLogo="Patona"
						srcLogoName="/images/logos/patona-logo-name.svg"
						altLogoName="Patona"
						fullLogo
						logoSize="sm"
					/>
				</div>

				<div slot="right" class="top-navbar-item">
					{#if $profileInfo.data}
						<ssk-icon name="outline-bell" />
						<ssk-dropdown themeColor="gray" optionsWidth="auto" data-testid="topnav.icon.chobar">
							<ssk-icon name="solid-point-3x3" slot="selected" />

							<div class="dropdown-options-container" data-testid="topnav.dropdown.chocbar">
								<div class="dropdown-option">
									<ssk-text size="sm" color="text.300">ระบบจัดการ</ssk-text>
									<div
										class="dropdown-option-item gap"
										on:click={toCCS3}
										data-testid="topnav.chocbar.menu.company-management"
									>
										<IconCircle
											iconColor="#EC5E2A"
											type="light"
											fixedCircleSize="38px"
											fixedBgColor="#FCEFE7"
											fixedBorderColor="#F9DDCE"
											iconName="outline-cog-8-tooth"
										/>
										<ssk-text color="gray.800">Company Management</ssk-text>
									</div>
								</div>
								<div class="dropdown-option">
									<ssk-text size="sm" color="text.300"> แอปพลิเคชัน </ssk-text>
									<div
										class="dropdown-option-item gap"
										on:click={toHome}
										data-testid="topnav.chocbar.menu.patona"
									>
										<div class="circle-img">
											<img src="/images/logos/patona-logo-icon.svg" width="30" />
										</div>
										<div>
											<ssk-text size="sm" color="gray.800" fontWeight="medium">Patona</ssk-text>
											<ssk-text size="xs" color="gray.500">ผู้ช่วยของคนทำธุรกิจ</ssk-text>
										</div>
									</div>
								</div>
							</div>
						</ssk-dropdown>

						<ssk-dropdown
							themeColor="gray"
							optionsWidth="auto"
							data-testid="topnav.icon.user-profile"
							on:click|stopPropagation
						>
							<ssk-avatar
								slot="selected"
								src="/images/ui/Avatar.png"
								alt="demo avatar"
								shape="circle"
								boxsize="40px"
							/>

							<div class="dropdown-options-container" data-testid="topnav.dropdown.user-profile">
								<div class="dropdown-option">
									<ssk-text size="sm" color="text.300"
										><ssk-i18n-translate
											key="patona-sellercenter-topbar-option-account"
											lang={$currentLanguage.code}
											fallbackLang="default"
										></ssk-i18n-translate></ssk-text
									>

									<div class="profile-header">
										<ssk-avatar
											class="avatar"
											src={userProfile?.data?.avatar || '/images/ui/Sukidog.png'}
											alt={userProfile?.data?.avatar}
											shape="circle"
										></ssk-avatar>
										<span class="name" data-testid="topnav.user-profile.text.username">
											{`${userProfile?.data?.firstName} ${userProfile?.data?.lastName}`}
										</span>
										<ssk-tooltip
											size="sm"
											themeColor="white"
											placement="bottom"
											color="currentcolor"
											hideCloseButton={true}
											class="email-tooltip"
										>
											<div class="tooltip-content" slot="content">
												<ssk-text size="xs">
													{userProfile?.data?.email}
												</ssk-text>
											</div>
											<span class="email-ellipsis" data-testid="topnav.user-profile.text.email"
												>{userProfile?.data?.email}</span
											>
										</ssk-tooltip>
									</div>
								</div>
								<div class="dropdown-option">
									<ssk-text size="sm" color="text.300">
										<ssk-i18n-translate
											key="patona-sellercenter-topbar-option-settings"
											lang={$currentLanguage.code}
											fallbackLang="default"
										></ssk-i18n-translate>
									</ssk-text>
									<div
										class="dropdown-option-item"
										on:click={handleSettings}
										data-testid="topnav.user-profile.menu.account-setting"
									>
										<ssk-icon slot="prefix" size="sm" name="outline-cog-8-tooth" />
										<ssk-text size="sm"
											><ssk-i18n-translate
												key="patona-sellercenter-topbar-option-accountsettings"
												lang={$currentLanguage.code}
												fallbackLang="default"
											></ssk-i18n-translate></ssk-text
										>
									</div>
									<div
										class="dropdown-option-item"
										on:click={() => (showLanguageDropdown = !showLanguageDropdown)}
										data-testid="topnav.user-profile.menu.language"
									>
										<ssk-icon slot="prefix" size="sm" name="outline-language" />
										<div class="dropdown-language">
											<ssk-text size="sm">
												<ssk-i18n-translate
													key="patona-sellercenter-topbar-option-language"
													lang={$currentLanguage.code}
													fallbackLang="default"
												></ssk-i18n-translate>
												: {`${$currentLanguage.name} / ${$currentLanguage.code.toLocaleUpperCase()}`}
											</ssk-text>
											<ssk-image
												src={$currentLanguage.img}
												alt={$currentLanguage.code}
												width="22px"
												height="16px"
												rounded="3px"
											>
											</ssk-image>
										</div>
										<ssk-icon
											name={showLanguageDropdown ? 'solid-chevron-down' : 'solid-chevron-right'}
										/>
									</div>
									{#if showLanguageDropdown}
										<div class="dropdown-option-language">
											{#each langList as lang, index}
												<div
													class="dropdown-option-item-language"
													on:click={() => changeLanguage(lang.code)}
												>
													<ssk-radio
														size="xl"
														value={lang.code}
														checked={lang.code === $currentLanguage.code}
														testId={`dropdown.radio.language-list.${lang.code + index}`}
													></ssk-radio>
													<ssk-text size="sm">
														{`${lang.name} / ${lang.code.toLocaleUpperCase()}`}
													</ssk-text>
													<ssk-image
														src={lang.img}
														alt={lang.code + index}
														width="22px"
														height="16px"
														rounded="3px"
													>
													</ssk-image>
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<div class="dropdown-option">
									<div
										class="dropdown-option-item"
										on:click={handleLogout}
										on:keypress={handleLogout}
										data-testid="topnav.user-profile.menu.signout"
									>
										<ssk-icon slot="prefix" size="sm" name="solid-arrow-right-on-rectangle" />
										<ssk-text size="sm">
											<ssk-i18n-translate
												key="patona-sellercenter-topbar-option-logout"
												lang={$currentLanguage.code}
												fallbackLang="default"
											></ssk-i18n-translate></ssk-text
										>
									</div>
								</div>
							</div>
						</ssk-dropdown>
					{:else}
						<ssk-button
							variant="outline"
							on:click={() => navigateToLogin()}
							testId="main.navbar.signin"
						>
							<ssk-icon iconName="outline-arrow-left-on-rectangle" />
							<ssk-text size="sm" color="currentcolor">Sign in</ssk-text>
						</ssk-button>
						<ssk-button on:click={navigateToRegister} testId="main.navbar.signup">
							<ssk-icon iconName="outline-arrow-right-on-rectangle" />
							<ssk-text size="sm" color="currentcolor">Sign up</ssk-text>
						</ssk-button>
					{/if}
				</div>
			</ssk-top-navbar>

			{#if !isShowOnlyTopBar(path)}
				<ssk-sidebar
					expanded={sideBarState.expanded}
					expandedGroups={sideBarState.expandedGroups}
					on:expanded-groups-changed={handleExpandedGroups}
				>
					{#if $isMember}
						<ssk-sidebar-header slot="header">
							<ssk-avatar
								src={currCm?.logo ? currCm.logo : '/images/ui/Avatar.png'}
								alt="demo avatar"
								shape="circle"
								size="sm"
								padding="8px 0"
								slot="mini"
							></ssk-avatar>

							{#key currSt}
								<!-- Positioning context for StoreDialog: the dropdown anchors to this
								     wrapper (top: 100% + gap, left/right: 0) instead of hard-coded
								     offsets, so it tracks the trigger's real box. The wrapper sits
								     OUTSIDE .company-header on purpose — handleClickOutside() and the
								     on:click toggle both key off that class, so keeping the boundary
								     intact preserves open/close behaviour. -->
								<div class="company-anchor">
									<div
										class="company-header"
										on:click={handleCompanyDialog}
										data-testid="sidenav.dropdown.company-profile"
									>
										<ssk-avatar
											class="avatar"
											src={currCm?.logo ? currCm.logo : '/images/ui/Avatar.png'}
											alt="demo avatar"
											shape="circle"
											size="md"
											data-testid="sidenav.company-profile.image.company"
										></ssk-avatar>
										{#if currCm}
											<span class="name" data-testid="sidenav.company-profile.text.company-name">
												{currCm.name}
											</span>
										{:else}
											<ssk-skeleton size="md" width="136px"></ssk-skeleton>
										{/if}
										<div class="branch">
											{#if currSt}
												<span data-testid="sidenav.company-profile.text.store-name">
													{currSt.name}
												</span>
												<IconCircle
													iconColor="#f97315"
													iconSize="xs"
													iconName={isOpenDialog ? 'solid-chevron-up' : 'solid-chevron-down'}
													type="light"
													fixedCircleSize="1rem"
													fixedBgColor="#fff"
													fixedBorderColor="#E5E7EB"
												/>
											{:else}
												<div class="branch-undefined">
													<ssk-skeleton size="2xs" width="136px"></ssk-skeleton>
												</div>
											{/if}
										</div>
									</div>

									<StoreDialog isOpen={isOpenDialog} />
								</div>
							{/key}
						</ssk-sidebar-header>
					{/if}

					<ssk-sidebar-list>
						{#each sidebarGroups as group}
							{#if !group.hidden}
								<ssk-sidebar-group label={$i18nKW[group.key] ?? group.key} key={toKey(group.key)}>
									{#each group.items as item}
										<ssk-sidebar-item
											on:click={() => {
												setAction(() => navigate(item.path));
											}}
											key={toKey(item.path)}
											actived={isInPath(item.path, path, item.exact)}
											data-testid={item.testid}
										>
											<ssk-icon
												slot="prefix"
												name={isInPath(item.path, path, item.exact) ? item.iconActive : item.icon}
											></ssk-icon>
											<ssk-i18n-translate
												key={item.key}
												lang={$currentLanguage.code}
												fallbackLang="default"
											></ssk-i18n-translate>
										</ssk-sidebar-item>
									{/each}
								</ssk-sidebar-group>
							{/if}
						{/each}
					</ssk-sidebar-list>
					<div slot="footer">
						<ssk-sidebar-item
							on:click={toContact}
							key={toKey('/contact')}
							actived={isInPath('/contact', path)}
							data-testid="sidenav.menu.support"
						>
							<ssk-icon
								slot="prefix"
								name={isInPath('/contact', path)
									? 'solid-information-circle'
									: 'outline-information-circle'}
							></ssk-icon>

							<ssk-i18n-translate
								key="patona-sellercenter-sidebar-menu-support"
								lang={$currentLanguage.code}
								fallbackLang="default"
							></ssk-i18n-translate>
						</ssk-sidebar-item>
						{#if $isMember}
							<ssk-sidebar-item
								on:click={toSetting}
								data-testid="sidenav.menu.setting"
								key={toKey('/settings')}
								actived={isInPath('/settings', path)}
							>
								<ssk-icon slot="prefix" name="outline-cog-8-tooth"></ssk-icon>

								<ssk-i18n-translate
									key="patona-sellercenter-sidebar-menu-setting"
									lang={$currentLanguage.code}
									fallbackLang="default"
								></ssk-i18n-translate>
							</ssk-sidebar-item>
						{/if}
					</div>
				</ssk-sidebar>
			{/if}
		{/if}
		<div
			class="content {isNoContentPadding(path) || isShowOnlyTopBar(path) ? 'not-padding' : ''}
				{isNoContentPaddingCustomer(path) ? 'not-padding-top-bottom' : ''}
				{withBackground(path) ? 'background' : ''}"
		>
			<slot />
		</div>
	</main>
{:else}
	<LoadingPage height="100vh" />
{/if}
<UnsavedAlertModal />

<style>
	main {
		display: grid;
		grid-template-areas: 'top-navbar top-navbar' 'sidebar content';
		grid-template-columns: auto 1fr;
		grid-template-rows: auto minmax(0, 1fr);
		height: 100dvh;
		width: 100dvw;
		overflow: hidden;
	}

	ssk-top-navbar {
		grid-area: top-navbar;
	}

	ssk-sidebar {
		grid-area: sidebar;
	}

	.content {
		background-color: var(--ssk-colors-background-100);
		box-sizing: border-box;
		grid-area: content;
		overflow: auto;
		padding: 1rem;
		margin: 0;
		display: grid;
		align-items: start;
		justify-items: center;
	}

	.content.background {
		--bg-img: url('/images/backgrounds/sellsuki-left-company-background.png'),
			url('/images/backgrounds/sellsuki-right-company-background.png');

		background-image: var(--bg-img);
		background-size:
			37.5em 37.5em,
			37.5em 37.5em;
		background-repeat: no-repeat;
		background-position:
			bottom left,
			bottom right;
	}

	.not-padding {
		padding: 0;
	}

	.not-padding-top-bottom {
		padding-left: 1rem;
		padding-right: 1rem;
	}

	.top-navbar-item {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	/* Anchor for the store dropdown. Layout-neutral: ssk-sidebar-header slots into
	   a flex row, and .company-header is already width:100%, so wrapping the pair
	   in one full-width item renders identically. */
	.company-anchor {
		position: relative;
		width: 100%;
	}

	.company-header {
		display: grid;
		grid-template-areas: 'avatar name' 'avatar branch';
		grid-template-columns: min-content 1fr;
		align-items: center;
		gap: 0 12px;

		/* Without border-box, `width: 100%` + 1em padding + 1px border made the
		   trigger 238px inside the sidebar's 204px content column (ssk-sidebar pads
		   12px 18px). It overhung the column by 34px — flush to the sidebar's outer
		   edge — so StoreDialog (correctly sized to .company-anchor) looked 34px
		   narrower than its own trigger. border-box puts it back on the sidebar grid
		   that every ssk-sidebar-item shares. */
		box-sizing: border-box;
		width: 100%;
		padding: 0.4em 1em;
		background-color: var(--ssk-colors-primary-50);
		border-radius: 8px;
		border: 1px solid var(--ssk-colors-primary-100);
	}

	.company-header .avatar {
		grid-area: avatar;
	}

	.company-header .name {
		grid-area: name;
		/* DS 1.0 (upgrade storybook) base-16 rebalance: body size + one weight up
		   for hierarchy — was hardcoded 24px, oversized next to base-16 menu rows. */
		font-size: var(--ssk-font-size-md);
		font-weight: 600;
		line-height: 1.3;
		color: var(--ssk-colors-text-900);
		text-align: start;
	}

	.company-header > .branch {
		grid-area: branch;
		/* DS 1.0 (upgrade storybook) base-16 rebalance: was hardcoded 20px. */
		font-size: var(--ssk-font-size-sm);
		line-height: 1.3;
		color: var(--ssk-colors-primary-500);
		align-items: center;
		display: grid;
		grid-template-columns: auto 1fr;
		grid-gap: 10px;
	}

	.branch > span {
		text-align: start;
		text-overflow: ellipsis;
		white-space: nowrap;
		overflow: hidden;
	}

	.branch-undefined {
		margin-top: 4px;
	}

	span.name {
		text-align: start;
		text-overflow: ellipsis;
		white-space: nowrap;
		overflow: hidden;
	}

	ssk-sidebar-group > :global(a) {
		text-decoration: none;
		color: inherit;
	}

	[slot='footer'] {
		padding-top: 0.5rem;
	}

	[slot='footer'] > :global(a) {
		text-decoration: none;
		color: inherit;
	}
	.dropdown-options-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.dropdown-option {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
	}

	.profile-header {
		display: grid;
		grid-template-areas: 'avatar name' 'avatar email';
		grid-template-columns: min-content 1fr;
		grid-template-rows: 1fr min-content;
		align-items: center;
		gap: 0 8px;

		padding: 8px;

		border-radius: 8px;
		border-color: var(--ssk-colors-primary-100);
		border-width: 1px;
		border-style: solid;

		background-color: var(--ssk-colors-primary-50);
	}

	.profile-header .avatar {
		grid-area: avatar;
	}

	.profile-header .name {
		grid-area: name;
		font-size: var(--ssk-font-size-md);
		color: var(--ssk-colors-text-900);
		text-align: start;

		width: 12.5rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.email-ellipsis {
		grid-area: email;
		font-size: var(--ssk-font-size-sm);
		color: var(--ssk-colors-text-300);

		width: 12.5rem;
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.profile-header .email-tooltip {
		line-height: 0.7;
	}

	.dropdown-language {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dropdown-option-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-gap: 8px;
		padding: 2px 0;
		align-items: center;

		color: var(--ssk-colors-text-300);

		font-size: var(--ssk-font-size-md);
		font-weight: normal;

		border-radius: 9px;

		cursor: pointer;

		transition: background-color 0.2s ease-in-out;
	}
	.gap {
		grid-gap: 1rem;
	}

	.circle-img {
		padding: 5px;
		border: 0 solid #fff;
		border-radius: 50%;
		display: flex;
	}

	.tooltip-content {
		max-width: 13.5rem;
		word-wrap: break-word;
		white-space: normal;
	}

	.dropdown-option-language {
		max-height: 200px;
		overflow-y: auto;
		scrollbar-color: transparent transparent;
		display: grid;
		gap: 8px;
	}

	.dropdown-option-item-language {
		display: flex;
		padding: 2px 0;
		align-items: center;

		color: var(--ssk-colors-text-300);

		font-size: var(--ssk-font-size-md);
		font-weight: normal;

		border-radius: 9px;

		cursor: pointer;

		transition: background-color 0.2s ease-in-out;
	}
	.dropdown-option-item-language ssk-text {
		margin-right: 0.5rem;
	}
</style>
