<script lang="ts">
	export let iconName: string;
	export let type: IconType = 'solid';
	export let iconSize: Size = 'md';
	export let iconColor: string; // must be hexcode color
	export let fixedCircleSize: string = '';
	export let fixedBgColor: string = '';
	export let fixedBorderColor: string = '';

	var bgColor: string = iconColor;
	var bgColor2: string = '';

	switch (type) {
		case 'solid':
			iconColor = '#fff';
			break;
		case 'light':
			bgColor = lightenColor(iconColor, 80) || 'red';
			break;
		case 'outline':
			bgColor = lightenColor(iconColor, 93) || 'red';
			bgColor2 = lightenColor(iconColor, 80) || 'red';
			break;
	}

	type IconType = 'light' | 'solid' | 'outline';
	type Size = 'xs' | 'sm' | 'md' | 'xl' | '2xl' | '3xl' | '4xl';

	const circleSize = {
		xs: '30px',
		sm: '40px',
		md: '50px',
		xl: '48px',
		'2xl': '65px',
		'3xl': '80px',
		'4xl': '90px'
	};

	const circleSize2 = {
		xs: '20px',
		sm: '30px',
		md: '40px',
		xl: '33px',
		'2xl': '45px',
		'3xl': '70px',
		'4xl': '80px'
	};

	function lightenColor(color: string, amount: number) {
		if (!/^#[0-9A-F]{6}$/i.test(color)) {
			return null;
		}
		let match = color.slice(1).match(/\w{2}/g);
		if (match == null) {
			return null;
		}
		const rgb = match.map((x) => parseInt(x, 16));
		const factor = Math.min(amount / 100, 1);
		const newRgb = rgb.map((val) => Math.max(0, Math.round(val + (255 - val) * factor)));
		return `#${newRgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
	}
</script>

{#if type == 'outline'}
	<div
		style="--circle-size: {fixedCircleSize || circleSize[iconSize]}; --bg-color: {fixedBgColor ||
			bgColor}"
		class={`container layers`}
	>
		<div style="--circle-size2: {circleSize2[iconSize]}; --bg-color: {bgColor2}" class="layer2">
			<ssk-icon size={iconSize} name={iconName} color={iconColor} />
		</div>
	</div>
{:else}
	<div
		style="--circle-size: {fixedCircleSize || circleSize[iconSize]}; --bg-color: {fixedBgColor ||
			bgColor}; --border-color: {fixedBorderColor || iconColor};"
		class={`container normal`}
	>
		<ssk-icon size={iconSize} name={iconName} color={iconColor} />
	</div>
{/if}

<style>
	.container {
		display: flex;
		justify-content: center;
	}

	.normal {
		align-items: center;
		background-color: var(--bg-color);
		width: var(--circle-size);
		height: var(--circle-size);
		border: 1px solid var(--border-color);
		border-radius: 50%;
	}

	.layer2 {
		align-items: center;
		display: flex;
		justify-content: center;
		border: 2.5px solid var(--bg-color);
		width: var(--circle-size2);
		height: var(--circle-size2);
		border-radius: 50%;
	}

	.layers {
		border: 2.5px solid var(--bg-color);
		width: calc(var(--circle-size) - 2px);
		height: calc(var(--circle-size) - 2px);
		border-radius: 50%;
		align-items: center;
	}
</style>
