<script lang="ts">
	import { customerAddressToString, type Address } from '$lib/entities/customer/customer';
	import { countriesList } from '$stores/country';

	export let addresses: Address[];
	export let idAddress: string = '';
	export let onClickSelectAddress: (address: Address) => void;
	export let onClickEditAddress: (e: MouseEvent, addrIdx: number) => void;
	export let toggleDrawer: () => void;

	$: {
		if (!idAddress && addresses.length > 0) {
			const defaultAddress = addresses.find((a) => a.isDefault);
			if (defaultAddress?.id) {
				idAddress = defaultAddress.id.toString();
			}
		}
	}

	$: selected = addresses.find((a) => a.id?.toString() === idAddress);

	const getCountryName = (code?: string) =>
		$countriesList.data?.find((c) => c.iso === code)?.name ?? code ?? '';

	const handleSelectAddress = (address: Address) => {
		const aId = address.id?.toString();
		if (!aId) return;
		idAddress = aId;

		onClickSelectAddress(address);
	};

	const handleEditAddressMouseDown = (addrIdx: number) => (event: MouseEvent) => {
		onClickEditAddress(event, addrIdx);
	};
</script>

<ssk-dropdown optionswidth="auto" size="md" width="100%" value={idAddress}>
	<ssk-dropdown-button slot="selected" value={idAddress}>
		{#if selected}
			<ssk-tooltip
				size="sm"
				themeColor="white"
				placement="top"
				color="currentcolor"
				hideCloseButton={true}
			>
				<ssk-dropdown-preview>
					{#if selected.isDefault}
						<ssk-badge slot="prefix" variant="subtle" themeColor="success"> ที่อยู่หลัก </ssk-badge>
					{/if}
					{customerAddressToString(selected, getCountryName(selected.country?.iso))}
				</ssk-dropdown-preview>
				<span slot="content" class="tooltip-content">
					<ssk-text size="xs">
						{customerAddressToString(selected, getCountryName(selected.country?.iso))}
					</ssk-text>
				</span>
			</ssk-tooltip>
		{/if}
	</ssk-dropdown-button>
	{#each addresses as address, index}
		<div class="dropdown-option-wrapper" aria-selected={address.id?.toString() === idAddress}>
			<ssk-tooltip
				size="sm"
				themeColor="white"
				placement="bottom"
				color="currentcolor"
				hideCloseButton={true}
			>
				<ssk-dropdown-option
					key={index}
					value={address.id}
					on:click={() => handleSelectAddress(address)}
				>
					{#if address.isDefault}
						<ssk-badge slot="prefix" variant="subtle" themeColor="success"> ที่อยู่หลัก </ssk-badge>
					{:else}
						<div slot="prefix"></div>
					{/if}
					{customerAddressToString(address, getCountryName(address.country?.iso))}

					<ssk-icon
						slot="postfix"
						name="outline-pencil-square"
						color="gray"
						on:mousedown={handleEditAddressMouseDown(index)}
					/>
				</ssk-dropdown-option>
				<span slot="content" class="tooltip-content">
					<ssk-text size="xs">
						{customerAddressToString(address, getCountryName(address.country?.iso))}
					</ssk-text>
				</span>
			</ssk-tooltip>
		</div>
	{/each}

	<div class="dropdown-footer" on:click={toggleDrawer}>
		<ssk-icon name="solid-plus" size="md" />
		<ssk-text size="md">เพิ่มที่อยู่ใหม่</ssk-text>
	</div>
</ssk-dropdown>

<style lang="css">
	.dropdown-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
	}

	ssk-dropdown {
		--background-color: none;
	}

	ssk-dropdown-option {
		--background-color-hover: var(--ssk-colors-gray-100);
		--rounded: 0px;
		font-weight: normal;
	}

	.tooltip-content {
		padding: 2px 4px;
		max-width: 25rem;
		word-wrap: break-word;
		white-space: normal;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dropdown-option-wrapper {
		width: 22.7dvw;
		margin: 0.1em;
	}

	.dropdown-option-wrapper > ssk-tooltip > .tooltip-content {
		max-width: 21dvw;
	}

	.dropdown-option-wrapper[aria-selected='true'] {
		background-color: var(--ssk-colors-primary-100);
		--color: var(--ssk-colors-primary-500);
	}
</style>
