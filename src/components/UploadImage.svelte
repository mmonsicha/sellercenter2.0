<script lang="ts">
	import { onDestroy, getContext } from 'svelte';
	import type { UploadResult } from '$lib/entities/payment/upload';
	import { currentLanguage } from '$stores/i18n';
	import type { I18nStore } from '@sellsuki-org/sellsuki-components';

	const i18nStore = getContext<I18nStore>('i18n');

	export let label: string = '';
	export let helperText: string = '';
	export let initialPreview: string | null = null;
	export let onChange: (detail: UploadResult) => void = () => {};
	export let acceptedTypes: string[] = ['image/jpeg', 'image/png'];
	export let accept: string = '.jpg,.jpeg,.png';
	export let maxFileSize: number = 500 * 1024;
	export let acceptedExtensionsLabel: string = '';
	export let previewWidth: string = '250px';
	export let previewHeight: string = '140px';
	export let uploadTestId: string | undefined = 'upload-image.dropzone';
	export let thumbnailTestId: string | undefined = 'upload-image.thumbnail';
	export let removeTestId: string | undefined = 'upload-image.remove-button';
	export let placeholderLabel: string = '';
	export let accentColor: string = 'primary.500';
	export let borderStyle: 'solid' | 'dashed' = 'solid';
	export let borderColor: string = 'var(--ssk-colors-primary-600)';
	// Optional overrides so callers can supply localized validation messages
	export let invalidTypeError: string | null = null;
	export let tooLargeError: string | null = null;

	// Default keywords resolved imperatively; reactive reload on language switch.
	// Used only when the matching prop is not supplied by the caller.
	const kwDefaults = {
		uploadImage: '',
		helperText: '',
		acceptedExtensions: '',
		addImage: '',
		reupload: '',
		removeImage: '',
		readFailed: '',
		invalidFilePrefix: '',
		tooLargePrefix: ''
	};

	async function loadKeywords() {
		const lang = $currentLanguage.code;
		[
			kwDefaults.uploadImage,
			kwDefaults.helperText,
			kwDefaults.acceptedExtensions,
			kwDefaults.addImage,
			kwDefaults.reupload,
			kwDefaults.removeImage,
			kwDefaults.readFailed,
			kwDefaults.invalidFilePrefix,
			kwDefaults.tooLargePrefix
		] = await Promise.all([
			i18nStore.get('common.upload.cta.upload_image', lang, 'default'),
			i18nStore.get('common.upload.helper_text', lang, 'default'),
			i18nStore.get('common.upload.accepted_extensions', lang, 'default'),
			i18nStore.get('common.upload.cta.add_image', lang, 'default'),
			i18nStore.get('common.upload.cta.reupload', lang, 'default'),
			i18nStore.get('common.upload.aria.remove_image', lang, 'default'),
			i18nStore.get('common.upload.error.read_failed', lang, 'default'),
			i18nStore.get('common.upload.error.invalid_file_prefix', lang, 'default'),
			i18nStore.get('common.upload.error.too_large_prefix', lang, 'default')
		]);
	}

	$: if ($currentLanguage.code) void loadKeywords();

	$: displayLabel = label || kwDefaults.uploadImage;
	$: displayHelperText = helperText || kwDefaults.helperText;
	$: displayAcceptedExtensions = acceptedExtensionsLabel || kwDefaults.acceptedExtensions;
	$: displayPlaceholderLabel = placeholderLabel || kwDefaults.addImage;

	let preview: string | null = initialPreview;
	let externalPreview: string | null = initialPreview;
	let fileInput: HTMLInputElement | null = null;
	let hasError = false;
	let activeReader: FileReader | null = null;

	onDestroy(() => {
		activeReader?.abort();
	});

	const formatMaxFileSize = (size: number): string => {
		if (size % (1024 * 1024) === 0) {
			return `${size / (1024 * 1024)} MB`;
		}

		return `${Math.round(size / 1024)} KB`;
	};

	$: if (initialPreview !== externalPreview) {
		externalPreview = initialPreview;
		preview = externalPreview;
	}

	$: hasError = selectedError !== null;

	const triggerFileDialog = () => {
		fileInput?.click();
	};

	const handleKeyPress = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			triggerFileDialog();
		}
	};

	const clearImage = (event: MouseEvent) => {
		event.stopPropagation();
		preview = null;
		selectedError = null;
		if (fileInput) {
			fileInput.value = '';
		}
		emitChange({ file: null, error: null, preview: null });
	};

	const validateFile = (file: File): string | null => {
		if (!acceptedTypes.includes(file.type)) {
			return invalidTypeError ?? `${kwDefaults.invalidFilePrefix} ${displayAcceptedExtensions}`;
		}

		if (file.size > maxFileSize) {
			return tooLargeError ?? `${kwDefaults.tooLargePrefix} ${formatMaxFileSize(maxFileSize)}`;
		}

		return null;
	};

	const emitChange = (detail: UploadResult) => {
		onChange?.(detail);
	};

	const getUploadAriaLabel = (): string => displayLabel;

	let selectedError: string | null = null;

	const handleFileChange = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		selectedError = null;

		if (!file) {
			preview = null;
			emitChange({ file: null, error: null, preview: null });
			return;
		}

		const validationError = validateFile(file);
		if (validationError) {
			selectedError = validationError;
			input.value = '';
			preview = null;
			emitChange({ file: null, error: validationError, preview: null });
			return;
		}

		activeReader?.abort();
		const reader = new FileReader();
		activeReader = reader;

		reader.onload = () => {
			activeReader = null;
			preview = reader.result as string;
			emitChange({ file, error: null, preview });
		};

		reader.onerror = () => {
			activeReader = null;
			selectedError = kwDefaults.readFailed;
			input.value = '';
			preview = null;
			emitChange({ file: null, error: selectedError, preview: null });
		};

		reader.readAsDataURL(file);
	};
</script>

<div class="upload-image">
	{#if displayLabel}
		<ssk-text size="md" color="gray.800" class="upload-label">{displayLabel}</ssk-text>
	{/if}
	<div class="upload-row">
		<div
			class="upload-left"
			class:preview-state={!!preview}
			class:error-state={hasError}
			style={`width: ${previewWidth}; height: ${previewHeight}; --ub-style: ${borderStyle}; --ub-color: ${borderColor};`}
			data-testid={uploadTestId}
			role="button"
			tabindex="0"
			on:click={triggerFileDialog}
			on:keydown={handleKeyPress}
			aria-label={getUploadAriaLabel()}
		>
			{#if preview}
				<div
					class="remove-button"
					data-testid={removeTestId}
					on:click|stopPropagation={clearImage}
					aria-label={kwDefaults.removeImage}
					title={kwDefaults.removeImage}
				>
					<ssk-icon name="solid-minus-small" size="sm" color="white" />
				</div>
				<div class="preview-wrapper" data-testid={thumbnailTestId}>
					<img class="preview" src={preview} alt="upload preview" />
				</div>
			{:else}
				<div class="placeholder">
					<ssk-icon
						name={hasError ? 'outline-arrow-path' : 'solid-photo'}
						size="lg"
						color={hasError ? 'error.500' : accentColor}
					/>
					<ssk-text size="md" color={hasError ? 'error.500' : accentColor}>
						{hasError ? kwDefaults.reupload : displayPlaceholderLabel}
					</ssk-text>
				</div>
			{/if}

			<input
				type="file"
				class="file-input"
				{accept}
				bind:this={fileInput}
				on:change={handleFileChange}
				aria-hidden="true"
				tabindex="-1"
				data-testid={`${uploadTestId ?? 'upload-image.dropzone'}.file-input`}
			/>
		</div>

		<div class="upload-right">
			<ssk-text size="md" color="gray.500">{displayHelperText}</ssk-text>
		</div>
	</div>
</div>

<style>
	.upload-image {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.upload-label {
		margin-bottom: 0.5rem;
	}

	.upload-row {
		display: flex;
		gap: 1.5rem;
	}

	.upload-left {
		width: 250px;
		height: 140px;
		position: relative;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background-color: var(--ssk-colors-gray-50);
		/* faint photo-stack backdrop per design (same as CCS3 UploadImage) */
		background-image: url('/images/default-image.png');
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		border-width: 1px;
		border-style: var(--ub-style, solid);
		border-color: var(--ub-color, var(--ssk-colors-primary-600));
	}

	.upload-left.preview-state {
		border-color: var(--ssk-colors-gray-200);
	}

	.upload-left.error-state {
		border-color: var(--ssk-colors-gray-400);

		background-color: var(--ssk-colors-gray-100);
	}

	.upload-left:focus-visible {
		outline: 2px solid var(--ssk-colors-primary-400);
		outline-offset: 2px;
	}

	.preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 8px;
	}

	.preview-wrapper {
		position: relative;
		display: inline-flex;
		width: 100%;
		height: 100%;
	}

	.remove-button {
		position: absolute;
		top: -7px;
		right: -8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 10px;
		min-height: 10px;
		background: var(--ssk-colors-error-500);
		border-radius: 9999px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		z-index: 1;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.25rem;
		color: var(--ssk-colors-gray-500);
	}

	.upload-right {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.file-input {
		display: none;
	}
</style>
