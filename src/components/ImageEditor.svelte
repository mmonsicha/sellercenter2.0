<script lang="ts">
	import type { CropArea } from '$lib/crop-image';
	import getCroppedImg from '$lib/crop-image';
	import type { ToastStore } from '@sellsuki-org/sellsuki-components';
	import { getContext } from 'svelte';
	import Cropper from 'svelte-easy-crop';
	import { currentLanguage } from '$stores/i18n';

	export let AvatarName: string;
	export let title: string;
	export let onChangeImg: any;
	export let testId: string = '';

	let ShowModal: boolean = false;
	let crop = { x: 0, y: 0 };
	let zoom = 1;
	let minZoom = 1;
	let pixelCrop: CropArea;
	let cropImage: string;
	const toastStore = getContext<ToastStore>('toast');

	function popupChangeAvatar() {
		ShowModal = !ShowModal;
		if (ShowModal) addShowAttr();
		else removeShowAttr();
	}

	function addShowAttr() {
		document.querySelector('#modal-image')?.setAttribute('show', '');
	}

	function removeShowAttr() {
		document.querySelector('#modal-image')?.removeAttribute('show');
	}

	function handleFileChange(event: Event) {
		const target = event.target as unknown as { files: File[]; value: string };
		const file = target.files?.[0];

		if (!file) return;

		cropImage = URL.createObjectURL(file);

		popupChangeAvatar();
		target.value = '';
	}

	function deleteAvatar() {
		AvatarName = '';
		toastStore.addToast({
			message: 'ลบรูปสำเร็จ',
			type: 'success',
			timeout: 5000,
			testId: 'toast.success.delete-image'
		});
		onChangeImg(AvatarName);
	}
</script>

<div class="container">
	<ssk-modal id="modal-image" hideCloseButton>
		<div slot="header">
			<ssk-text size="xl">อัปโหลดหรือแก้ไขรูปภาพ</ssk-text>
		</div>
		<div slot="body" class="cropper-body" data-testid={`${testId}.container.crop-image`}>
			<Cropper
				image={cropImage}
				{zoom}
				{crop}
				{minZoom}
				maxZoom={(minZoom + 5) * 3}
				aspect={1}
				cropShape="round"
				showGrid={false}
				on:cropcomplete={(e) => (pixelCrop = e.detail.pixels)}
			/>
		</div>

		<ssk-button
			testId={`${testId}.button.save-image`}
			slot="footer"
			width="full"
			on:click={async () => {
				AvatarName = await getCroppedImg(cropImage, pixelCrop);
				popupChangeAvatar();
				onChangeImg(AvatarName);
			}}
		>
			บันทึก
		</ssk-button>
		<ssk-button
			testId={`${testId}.button.cancel-image`}
			slot="footer"
			variant="outline"
			width="full"
			themeColor="button"
			on:click={popupChangeAvatar}
		>
			ยกเลิก
		</ssk-button>
	</ssk-modal>

	<div class="avatar-container">
		<label for="avatar-input" data-testid={`${testId}.preview.crop-image`}>
			<div class="avatar">
				{#if AvatarName != ''}
					<ssk-avatar
						shape="circle"
						src={AvatarName}
						alt="demo avatar"
						data-testid={`${testId}.element.image-attach`}
					></ssk-avatar>
					<div class="delete" on:click|preventDefault={() => deleteAvatar()}>
						<ssk-icon
							name="outline-trash"
							color="red"
							size="lg"
							data-testid={`${testId}.icon.delete-image`}
						/>
					</div>
				{:else}
					<ssk-icon name="outline-building-storefront" color="#fff" size="3xl" />
				{/if}
			</div>
			<div class="badge">
				<ssk-icon name="outline-camera" size="lg" />
			</div>
		</label>
		<input hidden id="avatar-input" type="file" accept="image/*" on:change={handleFileChange} />
	</div>

	<div class="text-container">
		<ssk-text size="md">{title}</ssk-text>
		<ssk-text size="sm"
			><span>
				<ssk-i18n-translate
					key={'patona-sellercenter-company-create-input-description-company'}
					lang={$currentLanguage.code}
					fallbackLang="default"
				></ssk-i18n-translate></span
			></ssk-text
		>
	</div>
</div>

<style lang="css">
	.container {
		display: grid;
		gap: 16px;
		width: 100%;
		border-radius: 8px;
		text-align: center;
	}

	.avatar {
		position: relative;
		cursor: pointer;
		overflow: hidden;
		border-radius: 50%;
	}

	.avatar-container {
		display: flex;
		justify-content: center;
	}

	.avatar-container > label {
		display: flex;
		position: relative;
		cursor: pointer;
		justify-content: center;
		background-color: #f97315;
		width: 120px;
		height: 120px;
		border-radius: 50%;
	}

	.avatar-container > label > div > ssk-icon {
		position: relative;
		top: 30%;
	}

	ssk-icon {
		color: #6b7280;
	}

	ssk-avatar {
		--object-fit: cover;
		--width: auto;
	}

	.badge {
		position: absolute;
		bottom: 0;
		right: 0;
		background-color: white;
		padding: 4px 8px;
		border-radius: 50%;
	}

	.delete {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background-color: white;
		padding: 4px 8px;
		border-radius: 50%;
		border: 1px solid red;
		opacity: 0;
		transition: opacity 0.3s ease;
		box-shadow: 0 0 0 9999em;
		color: rgba(0, 0, 0, 0.5);
	}

	.avatar:hover .delete {
		opacity: 1;
	}

	ssk-text > span {
		color: #6b7280;
	}

	.text-container {
		display: grid;
		gap: 5px;
	}

	ssk-modal {
		--width: 30vw;
		--border-color: white;
		--header-justify-content: center;
		--body-justify-content: center;
		--footer-display: grid;
		--footer-justify-content: normal;
		--background-color-footer: white;
	}

	.cropper-body {
		position: relative;
		width: 400px;
		height: 300px;
		border-radius: 8px;
	}
</style>
