<script lang="ts">
	/**
	 * One option in a PickList: a full-width card so multi-line content (an address,
	 * a branch with its phone) is readable instead of ellipsised into a dropdown row.
	 * A div, not a button, because the card carries its own action button ("แก้ไข")
	 * and buttons cannot nest — so it takes the radio role and the keys itself.
	 */
	export let selected: boolean = false;
	export let tabbable: boolean = false;
	export let title: string;
	export let badge: string = '';
	export let lines: string[] = [];
	export let actionLabel: string = '';
	export let onAction: ((e: MouseEvent) => void) | undefined = undefined;
	export let onSelect: () => void;
	export let testId: string = '';

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onSelect();
	};
</script>

<div
	class="card"
	class:selected
	role="radio"
	aria-checked={selected}
	tabindex={tabbable ? 0 : -1}
	on:click={onSelect}
	on:keydown={onKeydown}
	data-testid={testId}
>
	<span class="mark" aria-hidden="true"></span>
	<span class="info">
		<span class="title">
			{title}
			{#if badge}
				<span class="badge">{badge}</span>
			{/if}
		</span>
		{#each lines as line}
			<span class="line">{line}</span>
		{/each}
	</span>
	{#if actionLabel && onAction}
		<button type="button" class="action" on:click={onAction}>{actionLabel}</button>
	{/if}
</div>

<style>
	.card {
		display: grid;
		grid-template-columns: 1.25rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: start;
		padding: 0.75rem 0.875rem;
		background: #fff;
		border: 1px solid var(--ssk-colors-gray-200);
		border-radius: 10px;
		cursor: pointer;
	}

	.card:hover {
		border-color: var(--ssk-colors-gray-300);
		background: var(--ssk-colors-gray-50);
	}

	.card.selected {
		border-color: var(--ssk-colors-primary-500);
		background: var(--ssk-colors-primary-50, #fdf0ea);
	}

	.card:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
	}

	.mark {
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.125rem;
		border: 1.5px solid var(--ssk-colors-gray-300);
		border-radius: 50%;
		box-sizing: border-box;
	}

	.card.selected .mark {
		border-color: var(--ssk-colors-primary-500);
		border-width: 5px;
	}

	.info {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
		font-size: var(--ssk-font-size-sm);
		font-weight: 500;
		line-height: 1.4;
		color: var(--ssk-colors-gray-800);
	}

	.badge {
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-gray-600);
		background: var(--ssk-colors-gray-100);
		border-radius: 999px;
		padding: 0.05rem 0.45rem;
	}

	.line {
		font-size: var(--ssk-font-size-xs);
		line-height: 1.5;
		color: var(--ssk-colors-gray-600);
	}

	.action {
		align-self: center;
		padding: 0.125rem 0.25rem;
		border: 0;
		background: none;
		font-family: inherit;
		font-size: var(--ssk-font-size-xs);
		font-weight: 500;
		color: var(--ssk-colors-sky-600, #0284c7);
		text-decoration: underline;
		cursor: pointer;
	}

	.action:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-500);
		outline-offset: 1px;
		border-radius: 4px;
	}
</style>
