<script lang="ts">
	import Modal from '$components/modal/Modal.svelte';
	import ModalWithDivider from '$components/modal/ModalWithDivider.svelte';
	import Payment from '$components/payment/Payment.svelte';
	import { isSukipayFlow, OrderTaskName, PaymentType, Status } from '$lib/entities/order/order';
	import { makeOrderReceiptData, previewOrderReceipt } from '$lib/paper-template/template-handler';
	import { currentCompany } from '$stores/company/current-company';
	import { currentLanguage, i18nKW } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';
	import {
		clearOrder,
		getOrder,
		orderData,
		refreshOrderUntilCancelled,
		shippingFee,
		updateState
	} from '$stores/order/order';
	import {
		clearPayment,
		makeAttributesPayment,
		paymentInfo,
		showPaymentModal,
		togglePaymentModal,
		updatePayment,
		updateTaskInfoAndPaymentAmount
	} from '$stores/payment';
	import { currentStore } from '$stores/store/current-store';
	import { validationSchema as validatePaymentForm } from '$utils/form-validation/payment-form';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { beforeUpdate, getContext, onDestroy, onMount } from 'svelte';
	import Customer from './Customer.svelte';
	import OrderItemDetail from './ItemDetail.svelte';
	import Tracking from './Tracking.svelte';
	import {
		getBadgeOrderStatus,
		getOrderRowAction,
		mapOrderStateForPaymentCompleteByFlow,
		orderDisplayStatus,
		OrderRowActionKind
	} from '$utils/utils-order';
	import { orderStatusI18nKey, orderSaleTypeI18nKey } from '$utils/i18n-keys';
	import { tryOpenRecordPaymentModal } from '$stores/payment/payment-transaction';
	import Channel from './Channel.svelte';
	import Remark from './Remark.svelte';
	import ButtonAction from './OrderActions.svelte';
	import { navigate, useLocation } from 'svelte-routing';
	import { checkPermissionsEach } from '$utils/permission';
	import { ScopePermissions } from '$lib/entities/role-permission/scope';
	import { EntityPermission } from '$lib/entities/role-permission/permission';
	import PermissionDenied from '$components/PermissionDenied.svelte';
	import LoadingPage from '$components/LoadingPage.svelte';
	import { waitForDialogPermissionReady } from '$stores/permission/store-dialog';
	import MenuDropdown from '$components/dropdown/MenuDropdown.svelte';
	import SlipReviewModal from '$components/order/SlipReviewModal.svelte';
	import EditPaymentModal from '$components/order/EditPaymentModal.svelte';
	import RejectPaymentModal from '$components/order/RejectPaymentModal.svelte';
	import CancelOrderModal from '$components/order/CancelOrderModal.svelte';
	import CannotCancelOrderModal from '$components/order/CannotCancelOrderModal.svelte';
	import ApproveConfirmModal from '$components/order/ApproveConfirmModal.svelte';
	import DeliverConfirmModal from '$components/order/DeliverConfirmModal.svelte';
	import PaymentEvidence from './PaymentEvidence.svelte';
	import CancellationRefund from './CancellationRefund.svelte';
	import { toPaymentTransaction } from '$service/payment-adapter';
	import { isForwardPayment } from '$lib/entities/payment/payment-transaction';
	import { hasUnderReviewPayment } from '$utils/cancel-order';
	import OrderPaymentModal from '$pages/sales/modals/OrderPaymentModal.svelte';
	import NoPaymentChannelModal from '$pages/sales/modals/NoPaymentChannelModal.svelte';
	import { setOrderRefresher, clearOrderRefresher } from '$stores/order/order-refresh';

	export let orderId: string;

	const location = useLocation();
	var showCancelOrderModal: boolean = false;
	let showCannotCancelModal = false;
	let isPaymentValid: boolean = false;
	let isPaymentCompleted: boolean = true;
	let isPaymentProcessing = false;
	let canCancel = false;
	let canUpdate = false;
	let lastPermissionStoreId = '';
	let canView = false;
	let permissionPromise: Promise<void> | null = null;
	let canManagePayment = false;

	const toastStore = getContext<ToastStore>('toast');
	const i18nStore = getContext<I18nStore>('i18n');

	// An order created under a SukiPay flow cancels through the OMS cancel saga
	// (POST /store/{id}/order/{id}/cancel — CancelOrderModal). A legacy order has no
	// SukiPay transaction, so that saga rejects it (ErrTransactionNotCreated) — it must
	// cancel via the legacy state transition (PUT /store/{id}/order/{id}/state), exactly
	// as before PAT-2038. Keyed on the order's OWN flow type (see isSukipayFlow).
	$: isSukipayOrder = isSukipayFlow($orderData.flow?.type);

	function toggleCancelOrderModal() {
		// SukiPay orders: if a payment slip is still under review, cancel is not allowed —
		// open the dedicated "cannot cancel" notice instead of the cancel/refund modal.
		// (Legacy orders have no SukiPay slips, so this never applies to them.)
		if (isSukipayOrder && hasUnderReviewPayment($orderData)) {
			showCannotCancelModal = true;
			return;
		}
		showCancelOrderModal = !showCancelOrderModal;
	}

	// Legacy (non-SukiPay) cancel target state — the pre-PAT-2038 mapping
	// (mapCanceledStateByOrderStatus): a processing/paid order goes to
	// refunded:canceled, anything else to canceled. No payment reversal, no OMS saga.
	function legacyCancelState(status: string | undefined): string {
		return status === Status.Processing ? 'refunded:canceled' : 'canceled';
	}

	// Legacy cancel: transition the order state directly via PUT .../state. Used only
	// for non-SukiPay orders; SukiPay orders go through CancelOrderModal instead.
	async function cancelOrder(cancelState: string) {
		try {
			await updateState($currentStore.id!, $orderData.orderId!, cancelState);
			await getOrder($currentStore.id!, orderId!);
			toastStore.addToast({
				message: $i18nKW['patona-sellercenter-orderdetail-toast-canceled-success'],
				type: 'success',
				timeout: 3000
			});
		} catch (error) {
			toastStore.addToast({
				message: $i18nKW['patona-sellercenter-orderdetail-toast-canceled-fail'],
				type: 'error',
				timeout: 3000
			});
		} finally {
			showCancelOrderModal = false;
		}
	}

	// Scroll target for the "cannot cancel — resolve pending payment" modal.
	// The payment-evidence section lists every under-review slip with its own
	// review button, so pointing the user here handles one or many pending slips.
	let paymentEvidenceEl: HTMLDivElement | undefined;
	function scrollToPaymentEvidence() {
		paymentEvidenceEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function toggleClosePaymentModal() {
		clearPayment();
		togglePaymentModal($showPaymentModal);
	}

	$: cancelModalStoreId = $currentStore.id ?? '';
	$: cancelModalOrderId = $orderData.orderId ?? '';
	// Mirrors PaymentEvidence's own render gate — only render the (scroll-target)
	// wrapper when there are payment slips, so it doesn't add an empty grid item /
	// stray gap in the right column for unpaid orders.
	$: hasPaymentEvidence =
		!!$orderData.orderId &&
		(toPaymentTransaction($orderData)?.payments ?? []).filter(isForwardPayment).length > 0;

	$: headerAction = getOrderRowAction($orderData);
	$: showHeaderPayButton =
		canUpdate &&
		(headerAction.kind === OrderRowActionKind.Pay ||
			headerAction.kind === OrderRowActionKind.PayMore);

	async function onClickHeaderPay() {
		// SukiPay orders pay through the shared record-context payment modal;
		// legacy orders keep the old payment form (updatePayment + togglePaymentModal).
		const handled = await tryOpenRecordPaymentModal($orderData);
		if (handled) return;

		updatePayment({
			type: PaymentType.Cash,
			total: ($orderData?.buyerStatement?.netPrice ?? 0) + $shippingFee
		});
		togglePaymentModal($showPaymentModal);
	}

	paymentInfo.subscribe((v) => {
		validatePaymentForm(v).then((isValid) => {
			isPaymentValid = isValid;
		});
	});

	const _onOkPayment = async () => {
		if (!isPaymentValid || isPaymentProcessing) return;
		isPaymentProcessing = true;

		try {
			let isValid = await validatePaymentForm($paymentInfo);
			if (!isValid) return;
			$orderData!.buyerStatement = {
				...$orderData!.buyerStatement,
				receivedAmount: $paymentInfo.received
			};
			let attributes = makeAttributesPayment($paymentInfo);

			await updateState(
				$currentStore.id!,
				$orderData.orderId!,
				mapOrderStateForPaymentCompleteByFlow($orderData.flow.type!)
			);
			await updateTaskInfoAndPaymentAmount(
				$currentStore.id!,
				$orderData.orderId!,
				attributes,
				$orderData
			);

			togglePaymentModal($showPaymentModal);
			clearPayment();

			await getOrder($currentStore.id!, orderId);
			toastStore.addToast({
				message: await i18nStore.get(
					'order.payment.toast.success',
					$currentLanguage.code,
					'default'
				),
				type: 'success',
				timeout: 3000
			});
		} catch (error) {
			toastStore.addToast({
				message: await i18nStore.get(
					'order.payment.toast.failed',
					$currentLanguage.code,
					'default'
				),
				type: 'error',
				timeout: 3000
			});
		} finally {
			isPaymentProcessing = false;
		}
	};

	function printOrderReceipt() {
		const email = $currentCompany.email ? $currentCompany.email : undefined;
		const logo = $currentCompany.logo ? $currentCompany.logo : undefined;
		const storeCode = !$currentStore.isSystemCode ? $currentStore.code : undefined;

		const oReceipt = makeOrderReceiptData($orderData, email, logo, storeCode);
		previewOrderReceipt(oReceipt);
	}

	function back() {
		let redirectUrl = '/order';
		const params = new URLSearchParams($location.search);
		const backTo = params.get('back_to');
		if (!!backTo) {
			// NOTE: Restore query params when navigate back from /order/view/{id} to /order
			redirectUrl = backTo;
		}
		navigate(redirectUrl);
	}

	async function checkPermission() {
		if (!$currentStore?.id) {
			canCancel = false;
			canUpdate = false;
			canView = false;
			return;
		}
		await waitForDialogPermissionReady($currentCompany?.id);
		try {
			const data = await checkPermissionsEach(ScopePermissions.patonaStore, $currentStore.id, [
				EntityPermission.ORDERSTATUSUPDATE,
				EntityPermission.ORDERUPDATE,
				EntityPermission.ORDERVIEW,
				EntityPermission.ORDERPAYMENTMANAGE
			]);
			canCancel = data[EntityPermission.ORDERSTATUSUPDATE];
			canUpdate = data[EntityPermission.ORDERUPDATE];
			canView = data[EntityPermission.ORDERVIEW];
			canManagePayment = !!data[EntityPermission.ORDERPAYMENTMANAGE];
		} catch (error) {
			canCancel = false;
			canUpdate = false;
			canView = false;
			canManagePayment = false;
		}
	}

	$: {
		if ($currentStore?.id && $currentStore.id !== lastPermissionStoreId) {
			lastPermissionStoreId = $currentStore.id;
			permissionPromise = checkPermission();
		}
	}

	let initialLoadStarted = false;
	const ensureInitialOrder = async () => {
		if (initialLoadStarted || !$currentStore?.id) return;
		initialLoadStarted = true;
		try {
			await getOrder($currentStore.id, orderId);
		} catch (err) {
			initialLoadStarted = false; // allow a retry on the next update
			console.warn('[order-view] initial getOrder failed:', err);
		}
	};

	beforeUpdate(async () => {
		if (!$orderData.orderId) {
			await ensureInitialOrder();
		}

		if ($orderData.orderId) {
			const payment = $orderData.tasks?.find((t) => t.name === OrderTaskName.Payments);
			if (payment?.status === Status.Completed) {
				isPaymentCompleted = false;
			}
		}
	});

	onMount(() => {
		// Register the refresher FIRST — it must not depend on the initial fetch, or a
		// deduped getOrder abort would skip registration (see ensureInitialOrder above).
		setOrderRefresher(refreshThisOrder);
		void ensureInitialOrder();
	});

	const refreshThisOrder = () => {
		if ($currentStore?.id && orderId) {
			return getOrder($currentStore.id, orderId);
		}
	};

	onDestroy(() => {
		clearOrder();
		// Clear only our own registration — during route swaps the new page may have
		// registered before this onDestroy runs.
		clearOrderRefresher(refreshThisOrder);
	});
</script>

<ModalWithDivider
	toggleModal={toggleClosePaymentModal}
	id="payment"
	ShowModal={$showPaymentModal}
	hPosition="left"
	modalWidth="40vw"
	modalPaddingBody="0px"
>
	<div slot="title">
		<ssk-text size="2xl">
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-modal-payment-title-order"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
			<span>{$orderData.orderSerial}</span>
		</ssk-text>
	</div>
	<div class="modal-payment-body" slot="body">
		{#if $showPaymentModal}
			<Payment info={$paymentInfo} />
		{/if}
	</div>
	<div class="modal-payment-footer" slot="footer">
		<ssk-button
			variant="outline"
			themeColor="gray"
			on:click={toggleClosePaymentModal}
			data-testid="order-view.payment-modal.button.back"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-modal-payment-button-back"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
		<ssk-button
			on:click={_onOkPayment}
			disabled={!isPaymentValid || isPaymentProcessing}
			data-testid="order-view.payment-modal.button.confirm"
		>
			<ssk-i18n-translate
				key="patona-sellercenter-orderdetail-modal-payment-button-confirm"
				lang={$currentLanguage.code}
				fallbackLang="default"
			/>
		</ssk-button>
	</div>
</ModalWithDivider>

{#if isSukipayOrder}
	<CancelOrderModal
		show={showCancelOrderModal}
		storeId={cancelModalStoreId}
		orderId={cancelModalOrderId}
		order={$orderData}
		onClose={() => (showCancelOrderModal = false)}
		onCancelled={() => refreshOrderUntilCancelled(cancelModalStoreId, orderId)}
	/>
{:else}
	<!-- Legacy (non-SukiPay) cancel: simple confirm → PUT /store/{id}/order/{id}/state -->
	<Modal
		toggleModal={toggleCancelOrderModal}
		id="cancel-order"
		icon="outline-exclamation-circle"
		iconColor="#d97706"
		ShowModal={showCancelOrderModal}
		title={$i18nKW['patona-sellercenter-orderdetail-modal-cancel-title-confirmation']}
		body={$i18nKW['patona-sellercenter-orderdetail-modal-cancel-body-confirmation']}
	>
		<ssk-button
			slot="modal-footer-left"
			variant="outline"
			themeColor="gray"
			width="full"
			on:click={() => (showCancelOrderModal = false)}
			data-testid="order-view.cancel-modal.button.cancel"
		>
			<span>{$i18nKW['patona-sellercenter-orderdetail-modal-button-cancel']}</span>
		</ssk-button>
		<ssk-button
			width="full"
			slot="modal-footer-right"
			on:click={() => cancelOrder(legacyCancelState($orderData.status))}
			data-testid="order-view.cancel-modal.button.confirm"
		>
			<span>{$i18nKW['patona-sellercenter-orderdetail-modal-button-confirm']}</span>
		</ssk-button>
	</Modal>
{/if}

<CannotCancelOrderModal
	show={showCannotCancelModal}
	onClose={() => (showCannotCancelModal = false)}
	onGoToPayments={scrollToPaymentEvidence}
/>

<!-- deliver modal: shared store-driven component (same flow as the order list page) -->
<DeliverConfirmModal />
<SlipReviewModal {canManagePayment} />
<EditPaymentModal {canManagePayment} />
<RejectPaymentModal />
<ApproveConfirmModal />
<OrderPaymentModal {canManagePayment} />
<NoPaymentChannelModal />

{#if $currentStore?.id}
	{#await permissionPromise}
		<LoadingPage
			description={$i18nKW['common.loading']}
		/>
	{:then}
		{#if !canView}
			<PermissionDenied />
		{:else}
			<div class="container">
				{#if $orderData.orderId}
					<div class="content">
						<div class="header">
							<div class="left-section">
								<div class="breadcrumb">
									<div class="back" on:click={back} data-testid="order-view.header.button.back">
										<ssk-icon name="outline-chevron-left" size="sm" />
									</div>
									<div class="badge">
										<ssk-text size="sm" color="gray.800">
											<ssk-i18n-translate
												key={orderSaleTypeI18nKey($orderData.saleChannel?.type)}
												lang={$currentLanguage.code}
												fallbackLang="default"
											/>
										</ssk-text>
									</div>
								</div>
								<div class="order-title">
									<ssk-text size="2xl" color="gray.800">
										<ssk-i18n-translate
											key="patona-sellercenter-orderdetail-title-order"
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
										<span> {$orderData.orderSerial}</span>
									</ssk-text>
									<ssk-badge variant="subtle" themeColor={getBadgeOrderStatus(orderDisplayStatus($orderData))}>
										<ssk-i18n-translate
											key={orderStatusI18nKey(orderDisplayStatus($orderData))}
											lang={$currentLanguage.code}
											fallbackLang="default"
										/>
									</ssk-badge>
								</div>
							</div>
							<div class="right-section">
								<ssk-button
									variant="solid-light"
									themeColor="gray"
									disabled={isPaymentCompleted}
									on:click={() => printOrderReceipt()}
									data-testid="order-view.header.button.print-receipt"
								>
									<ssk-i18n-translate
										key="patona-sellercenter-orderdetail-button-printreceipt"
										lang={$currentLanguage.code}
										fallbackLang="default"
									/>
								</ssk-button>

								{#if showHeaderPayButton}
									{#if canManagePayment}
										<ssk-button
											data-testid="order-view.header.button.pay"
											on:click={onClickHeaderPay}
										>
											{#if headerAction.kind === OrderRowActionKind.Pay}
												<ssk-i18n-translate
													key="patona-sellercenter-orderdetail-button-checkout"
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
											{:else}
												<ssk-i18n-translate
													key="order.payment.pay_more_btn"
													lang={$currentLanguage.code}
													fallbackLang="default"
												/>
											{/if}
										</ssk-button>
									{:else}
										<!-- no patona.order.payment.manage → pay CTA disabled + tooltip -->
										<ssk-tooltip
											size="xs"
											themeColor="black"
											hideCloseButton={true}
											areaPosition="130%"
										>
											<span slot="content" class="tooltip-content">
												<ssk-text size="xs" color="white">
													<ssk-i18n-translate
														key="common.permission.access_restricted"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>
												</ssk-text>
											</span>
											<ssk-button data-testid="order-view.header.button.pay-disabled" disabled>
												{#if headerAction.kind === OrderRowActionKind.Pay}
													<ssk-i18n-translate
														key="patona-sellercenter-orderdetail-button-checkout"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>
												{:else}
													<ssk-i18n-translate
														key="order.payment.pay_more_btn"
														lang={$currentLanguage.code}
														fallbackLang="default"
													/>
												{/if}
											</ssk-button>
										</ssk-tooltip>
									{/if}
								{/if}

								<MenuDropdown testId="order-view.menu">
									<ssk-icon
										name="outline-ellipsis-vertical"
										slot="trigger"
										data-testid="order-view.menu.trigger"
									/>
									<svelte:fragment slot="menu" let:close>
										<div class="menu-dropdown-options-container">
											{#if $orderData.status === Status.Completed || $orderData.status === Status.Canceled}
												<div class="menu-dropdown-option disabled">
													<ssk-text color="gray.400">
														<ssk-i18n-translate
															key="patona-sellercenter-orderdetail-menu-save"
															lang={$currentLanguage.code}
															fallbackLang="default"
														/>
													</ssk-text>
												</div>
											{/if}
											{#if $orderData.status === Status.Processing || $orderData.status === Status.Pending || $orderData.status === Status.PartialCompleted}
												{#if !canCancel}
													<ssk-tooltip
														size="xs"
														themeColor="black"
														hideCloseButton={true}
														areaPosition="130%"
													>
														<span slot="content" class="tooltip-content">
															<ssk-text size="xs" color="white">
																<ssk-i18n-translate
																	key="common.permission.access_restricted"
																	lang={$currentLanguage.code}
																	fallbackLang="default"
																/>
															</ssk-text>
														</span>

														<div class="menu-dropdown-option-container" class:disabled={!canCancel}>
															<div
																class="menu-dropdown-option"
																on:click={() => {
																	if (!canCancel) return;
																}}
																data-testid="order-view.menu.cancel-order-disabled"
															>
																<ssk-text>
																	<ssk-i18n-translate
																		key="patona-sellercenter-orderdetail-menu-cancelorder"
																		lang={$currentLanguage.code}
																		fallbackLang="default"
																	/>
																</ssk-text>
															</div>
														</div>
													</ssk-tooltip>
												{:else}
													<div class="menu-dropdown-option-container">
														<div
															class="menu-dropdown-option"
															on:click={() => {
																toggleCancelOrderModal();
																close();
															}}
															data-testid="order-view.menu.cancel-order"
														>
															<ssk-text>
																<ssk-i18n-translate
																	key="patona-sellercenter-orderdetail-menu-cancelorder"
																	lang={$currentLanguage.code}
																	fallbackLang="default"
																/>
															</ssk-text>
														</div>
													</div>
												{/if}
											{/if}
										</div>
									</svelte:fragment>
								</MenuDropdown>
							</div>
						</div>
						<div class="divider" />
						<div class="body">
							<OrderItemDetail />
							<div class="right-section">
								<Customer />
								<Tracking />
								{#if canUpdate}
									<ButtonAction />
								{/if}
								{#if hasPaymentEvidence}
									<div bind:this={paymentEvidenceEl} style="scroll-margin-top: 80px;">
										<PaymentEvidence {canManagePayment} />
									</div>
								{/if}
								<CancellationRefund />
								<Channel />
								<Remark bind:canUpdate />
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/await}
{/if}

<style lang="css">
	ssk-text > span {
		color: var(--ssk-colors-primary-500);
	}
	.container {
		width: 100%;
		height: 100%;

		background-color: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 8px;
	}

	.content {
		padding: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;

		align-items: center;
		gap: 0.5rem;
	}

	.header > .left-section,
	.order-title {
		display: grid;
		gap: 0.5rem;
	}

	.order-title {
		grid-template-columns: auto auto;
		align-items: center;
	}

	.header > .right-section {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge {
		border: 1px solid var(--ssk-colors-gray-300);
		border-radius: 999px;
		padding: 2px 9px;
	}

	.divider {
		border-bottom: 1px solid var(--ssk-colors-gray-200);
		margin: 1.5rem 0;
	}

	.body {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: 72% auto;
	}

	.body > .right-section {
		display: grid;
		gap: 1.5rem;
		height: fit-content;
	}

	.menu-dropdown-option-container.disabled .menu-dropdown-option,
	.menu-dropdown-option.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-payment-body {
		width: 100%;
	}

	.modal-payment-footer {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 20rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
