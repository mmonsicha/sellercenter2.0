import { type ToastStore } from '@sellsuki-org/sellsuki-components';
import { writable } from 'svelte/store';

export const toast = writable<ToastStore>();
