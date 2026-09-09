import type { DropdownState } from '@sellsuki-org/sellsuki-components';
import { writable } from 'svelte/store';

export const dropdownState = writable<{
	[key: string]: DropdownState;
}>({});

export const initDropdownState = () => {
	dropdownState.set({
		postalCode: { setValue: (value: string, el: HTMLElement) => {}, isOpened: false },
		administrative_name_level_1: {
			setValue: (value: string, el: HTMLElement) => {},
			isOpened: false
		},
		administrative_name_level_2: {
			setValue: (value: string, el: HTMLElement) => {},
			isOpened: false
		},
		administrative_name_level_3: {
			setValue: (value: string, el: HTMLElement) => {},
			isOpened: false
		},
		locality_name_level_1: { setValue: (value: string, el: HTMLElement) => {}, isOpened: false },
		locality_name_level_2: { setValue: (value: string, el: HTMLElement) => {}, isOpened: false },
		locality_name_level_3: { setValue: (value: string, el: HTMLElement) => {}, isOpened: false }
	});
};

export const setDropdownState = (level: string, newState: Partial<DropdownState>) => {
	dropdownState.update((state) => {
		const updateState = { ...state };

		Object.keys(updateState).forEach((key) => {
			if (key !== level) {
				updateState[key] = { ...updateState[key], isOpened: false };
			}
		});

		updateState[level] = {
			...updateState[level],
			...newState
		};

		return updateState;
	});
};
