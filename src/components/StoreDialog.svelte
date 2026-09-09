<script lang="ts">
	import { companyList } from '$stores/company/company';
	import { currentCompany } from '$stores/company/current-company';
	import { configurationStore, updateUserConfiguration } from '$stores/configuration';
	import { setAction } from '$stores/saved-changes';
	import { currentLanguage } from '$stores/i18n';
	import { currentStore } from '$stores/store/current-store';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { checkPermissionsEach } from '$utils/permission';
	import {
		setDialogPermissionDone,
		setDialogPermissionIdle,
		setDialogPermissionPending
	} from '$stores/permission/store-dialog';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext, tick } from 'svelte';
	import { navigate } from 'svelte-routing';
	import IconCircle from './IconCircle.svelte';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';

	const i18nStore = getContext<I18nStore>('i18n');
	const toastStore = getContext<ToastStore>('toast');

	let toastSwitchStore: string;
	let textAcceptService: string;
	let canCreate = false;

	const loadKeywords = async () => {
		const lang = $currentLanguage.code;
		const fallback = 'default';
		toastSwitchStore = await i18nStore.get(
			'patona-sellercenter-company-create-toast-switched',
			lang,
			fallback
		);
		textAcceptService = await i18nStore.get(
			'patona-sellercenter-company-create-title-companyheader-next',
			lang,
			fallback
		);
	};

	$: if ($currentLanguage?.code) {
		loadKeywords();
	}

	export let isOpen: boolean;

	$: cList =
		$companyList.data?.map((c) => {
			const isSelectedCompany = c.id === $currentCompany?.id;

			return {
				...c,
				isSelectedCompany,
				stores: c.stores.map((s) => {
					const isSelectedStore = s.id === $currentStore?.id;
					return {
						...s,
						isSelectedStore
					};
				})
			};
		}) || [];

	function switchStore(cId: string | undefined, sId: string | undefined) {
		const currStore = $configurationStore.data.user?.selectedStoreId;

		if (currStore !== sId) {
			setAction(async () => {
				updateUserConfiguration({
					selectedCompanyId: cId!,
					selectedStoreId: sId!
				});

				const path = window.location.pathname;

				if (path.startsWith('/order/view')) {
					navigate('/order');
				} else if (path === '/order') {
					await tick();
					navigate('/order');
				} else if (path.startsWith('/customers/view')) {
					navigate('/customers');
				} else if (path.startsWith('/customers/edit')) {
					navigate('/customers');
				} else if (path.startsWith('/customers/new')) {
					navigate('/customers');
				}

				toastStore.addToast({
					message: toastSwitchStore,
					type: 'success',
					timeout: 5000,
					testId: 'sidenav.toast.success'
				});
			});
		}
	}

	function navigatePath(path: string) {
		if (location.href.endsWith(path)) return;
		setAction(() => navigate(path));
	}

	$: currentCompanyId = $currentCompany?.id;

	$: if (currentCompanyId && isOpen) {
		checkPermission();
	}

	$: if (!isOpen) {
		setDialogPermissionIdle();
	}

	async function checkPermission() {
		if (!currentCompanyId) {
			canCreate = false;
			return;
		}
		setDialogPermissionPending(currentCompanyId);
		try {
			const data = await checkPermissionsEach(ScopePermissions.sellsukiCompany, currentCompanyId, [
				EntityPermission.STORECREATE
			]);
			canCreate = data[EntityPermission.STORECREATE];
		} catch (error) {
			canCreate = false;
		} finally {
			setDialogPermissionDone(currentCompanyId);
		}
	}
</script>

{#key $currentStore}
	<div class={`container ${isOpen ? '' : 'hidden'}`}>
		<div class="content">
			{#each cList as c}
				<div class="company">
					<div class="name">
						<ssk-text color="gray" size="sm">{c.name}</ssk-text>
					</div>
					<div class="sub-content" data-testid="sidenav.company-profile.menu.store-list">
						{#if !c.tosId}
							<div class="btt">
								<ssk-button
									testId={`dialog-company-store.button.tos`}
									variant="outline"
									width="full"
									on:click={() => navigatePath(`/company/tos?company_id=${c.id}`)}
									>{textAcceptService}</ssk-button
								>
							</div>
						{:else}
							{#each c.stores as s, index}
								<div
									class="store"
									data-testid={`store.${c.stores.length - index}`}
									on:click={() => switchStore(c.id, s.id)}
								>
									<div class="store-content">
										<IconCircle
											iconName="outline-building-storefront"
											fixedCircleSize="2.3rem"
											iconColor="#f97315"
										/>
										<div class="store-name">{s.name}</div>
									</div>
									<ssk-radio
										class="fuck-me"
										size="2xl"
										label=""
										checked={s.isSelectedStore}
										testId={`sidenav.company-profile.radio.store-list.${c.stores.length - index}`}
									></ssk-radio>
								</div>
							{/each}
						{/if}
					</div>
				</div>
				<div class="divider">
					<ssk-divider size="xs" />
				</div>
			{/each}
		</div>
		{#if canCreate}
			<div class="footer">
				<div
					class="menu"
					on:click={() => navigatePath(`/store/new?company_id=${$currentCompany?.id}`)}
					data-testid="sidenav.company-profile.button.create-store"
				>
					<ssk-text size="sm" color="primary">
						<ssk-i18n-translate
							key="patona-sellercenter-sidebar-radio-addnewstore"
							lang={$currentLanguage.code}
							fallbackLang="default"
						></ssk-i18n-translate>
					</ssk-text>
				</div>
			</div>
		{/if}
	</div>
{/key}

<style>
	.container {
		cursor: default;
		z-index: 100;
		background-color: white;
		border: 1px solid var(--ssk-colors-gray-100);
		border-radius: 8px;
		box-sizing: border-box;
		padding-top: 1rem;

		/* Anchored to .company-anchor in Layout.svelte instead of the previous
		   hard-coded `top: 9.7rem; left: 1rem; width: 17.5rem`. Those offsets were
		   calibrated against the old header height and drifted when .company-header
		   moved to base-16 font tokens. left/right:0 also makes the panel exactly
		   the trigger's width, so both edges line up at any sidebar width.
		   Mirrors what ssk-dropdown does internally (dropdown.ts:583-606). */
		position: absolute;
		top: calc(100% + var(--ssk-spacing-xs, 0.5rem));
		left: 0;
		right: 0;

		/* DS elevation token. `md` (0px 3px 16px) is the step matched to a ~280px
		   floating menu: xs/sm read flat at this footprint, lg/xl are modal weight. */
		box-shadow: var(--ssk-box-shadow-md, 0px 3px 16px rgba(0, 0, 0, 0.2));
	}

	.container.hidden {
		display: none;
	}

	.content {
		display: block;
		padding-bottom: 1rem;

		max-height: 20rem;
		overflow-y: auto;
		/* Reserve the (slim, 0.25rem) scrollbar strip so a row's right inset is the
		   same whether the list scrolls or not — the old fix for that was a pair of
		   0.2rem padding-rights on .container/.content, which ate into the row on
		   BOTH states and left the radio 26px from the panel edge against the
		   icon's 16px on the left. */
		scrollbar-gutter: stable;
	}

	.company > .name {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
		/* Same 1rem inset as .store on both sides — the row is space-between, so a
		   right inset is what keeps a second child off the panel edge. */
		padding: 0 1rem;
	}

	.store {
		display: flex;
		padding: 0.5rem 0 0.5rem 1rem;

		align-items: center;
		justify-content: space-between;
		cursor: pointer;
	}
	.store:hover {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: var(--ssk-colors-primary-100);
		cursor: pointer;
	}
	.store > .store-content {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.store-name {
		/* Long names used to wrap to a 2nd line (rows 55px → 64px, so the list read
		   ragged). Kept to one line with a real "…" instead.
		   Plain element rather than <ssk-text> on purpose: text-overflow only applies
		   to the block that clips the text, and ssk-text's <p> sits in its shadow
		   root with no exposed part — from outside, the text can only be hard-clipped.
		   Values match what ssk-text rendered here (md / 400 / background.900), and
		   mirror .company-header .name in Layout.svelte, which does the same. */
		font-size: var(--ssk-font-size-md);
		line-height: 1.5;
		color: var(--ssk-colors-background-900);

		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.sub-content {
		padding-top: 1rem;
	}

	.footer {
		display: flex;
		justify-content: space-around;
		background-color: var(--ssk-colors-gray-50);
		color: var(--ssk-colors-primary-500);
		padding: 1rem;
	}

	.menu {
		cursor: pointer;
	}
	.btt {
		padding: 0.5rem 0 0 1rem;
	}

	.fuck-me {
		pointer-events: none;
	}

	/* Revise scrollbar */
	/* width — 0.25rem (was 0.5rem): the reserved gutter is dead space on the right,
	   so keeping it slim is what lets the radio land 1rem from the panel edge,
	   mirroring the store icon's 1rem on the left. */
	::-webkit-scrollbar {
		width: 0.25rem;
	}

	/* Track */
	::-webkit-scrollbar-track {
		background: none;
	}

	/* Handle */
	::-webkit-scrollbar-thumb {
		background: var(--ssk-colors-gray-100);
		border-radius: 8px;
	}

	/* Handle on hover */
	::-webkit-scrollbar-thumb:hover {
		background: var(--ssk-colors-gray-300);
	}

	.divider {
		margin: 1rem;
	}

	.divider:last-child {
		display: none;
	}
</style>
