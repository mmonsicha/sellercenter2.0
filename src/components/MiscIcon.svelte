<script lang="ts">
	enum IconType {
		normal = 'normal',
		solidFull = 'solid-full',
		solidHalf = 'solid-half',
		outline = 'outline'
	}

	export let iconName: string;
	export let type: IconType = IconType.solidFull;
	export let iconSize: string = 'md';
	export let iconColor: string = '#fff';
</script>

<div class="container solid-full">
	<ssk-icon size={iconSize} name={iconName} color={iconColor} />
</div>

<style>
	.container {
		text-align: center;
		background-color: var(--bg-color);
		width: var(--circle-size);
		height: var(--circle-size);
		border-radius: 50%;

		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
