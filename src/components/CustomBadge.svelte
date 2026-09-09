<script lang="ts">
	export let text: string;
</script>

<div class="badge">
	<ssk-text color="gray.800" size="sm">
		{text}
	</ssk-text>
</div>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--ssk-colors-gray-300);
		border-radius: 1rem;
		padding: 2px 8px;
	}
</style>
