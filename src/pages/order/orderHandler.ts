import { PaymentState, Status, type Order, type Task } from '$lib/entities/order/order';
import { PaymentTxnState } from '$lib/entities/payment/payment-transaction';
import _ from 'lodash';

export type Tracking = {
	status: string;
	state: string;
	created_at: string;
	tasks?: Task[];
};

export function getOrderTracking(o: Order): Tracking {
	const ct: Task[] = customTask(o.state, o.tasks) ?? [];

	const tracking: Tracking = {
		status: o.status ?? '',
		state: o.state ?? '',
		created_at: o.createdAt ?? '',
		tasks: ct
	};

	return tracking;
}

function customTask(state: string = '', tasks: Task[] = []): Task[] {
	// A compensated (refunded) SukiPay payment renders a dedicated "refund" step on
	// the timeline. Under the final POS-ONLINE-SUKIPAY-V1 flow a paid-cancel ends at
	// the unified terminal canceled:canceled with the payments task status overwritten
	// to canceled, so the durable signal for "this was refunded" is the COMPENSATED
	// marker preserved in the payments task attributes — NOT the composite state
	// (which used to be refunded:canceled) nor the task state (now canceled).
	if (hasCompensatedPayment(tasks)) {
		return customRefundTasks(tasks);
	}

	switch (state) {
		case 'refunded:canceled': // legacy composite (pre-final flow / other flows)
			return customRefundTasks(tasks);
		case 'canceled':
			return customPendingPaymentTask(tasks);
		default:
			return tasks;
	}
}

// isCompensatedPayment reports whether a payments task carries the SukiPay
// COMPENSATED marker in its attributes — set by handleTransactionCompensated and
// preserved through the finalize to canceled:canceled (rewriteTaskState overwrites
// status/state but not attributes).
function isCompensatedPayment(task: Task): boolean {
	return (
		task.name === 'payments' && task.attributes?.transaction_state === PaymentTxnState.COMPENSATED
	);
}

function hasCompensatedPayment(tasks: Task[] = []): boolean {
	return tasks.some((task) => isCompensatedPayment(task));
}

function customPendingPaymentTask(tasks: Task[] = []): Task[] {
	const modifiedTasks: Task[] = tasks.map((task) => {
		// If the task is canceled and has no completedAt, reset task status to pending
		if (task.name === 'payments' && task.status === Status.Canceled && !task.completedAt) {
			return { ...task, canceledAt: undefined, status: Status.Pending };
		}
		return task;
	});

	return modifiedTasks;
}

function customRefundTasks(tasks: Task[] = []): Task[] {
	const modifiedTasks: Task[] = tasks;
	const alreadyHasCustomRefundTask = modifiedTasks.some((task) => task.name === 'refund');

	// Find the payment that was refunded. Under the final flow the payments task
	// status/state is overwritten to canceled at the terminal, so match the durable
	// COMPENSATED attribute as well as the legacy refunded task state.
	const refundedPayment = tasks.find(
		(task) =>
			task.name === 'payments' &&
			(isCompensatedPayment(task) || task.state === PaymentState.Refunded)
	);

	// If there's a refunded payment, add refund task
	if (refundedPayment && !alreadyHasCustomRefundTask) {
		const refundTask: Task = {
			...refundedPayment,
			name: 'refund',
			canceledAt: refundedPayment.canceledAt
		};
		modifiedTasks.push(refundTask);
		modifiedTasks.forEach((task) => {
			if (task.name === 'payments') {
				// Remove canceledAt from payment task
				task.status = Status.Completed;
				task.canceledAt = undefined; // Remove canceledAt property
			}
		});
	}

	return modifiedTasks;
}
