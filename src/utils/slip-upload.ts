import { uploadPrivateFile, deletePrivateFile } from '../service/management-rest';
import { createThumbnailFile } from '$utils/slip-thumbnail';

export type UploadedSlipFiles = {
	fullImageUrl: string;
	thumbnailUrl: string;
	fullFileRecordId: string;
	thumbnailFileRecordId: string;
	refId: string;
};

export function isUploadedSlipFilesComplete(
	files: Partial<UploadedSlipFiles>
): files is UploadedSlipFiles {
	return !!(
		files.fullImageUrl &&
		files.thumbnailUrl &&
		files.fullFileRecordId &&
		files.thumbnailFileRecordId &&
		files.refId
	);
}

export async function cleanupUploadedSlipFiles(files: Partial<UploadedSlipFiles>): Promise<void> {
	const refId = files.refId;
	const targets: Promise<unknown>[] = [];
	if (files.fullFileRecordId && refId) {
		targets.push(
			deletePrivateFile(files.fullFileRecordId, refId).catch((e) =>
				console.error('Error deleting uploaded full slip file:', e)
			)
		);
	}
	if (
		files.thumbnailFileRecordId &&
		refId &&
		files.thumbnailFileRecordId !== files.fullFileRecordId
	) {
		targets.push(
			deletePrivateFile(files.thumbnailFileRecordId, refId).catch((e) =>
				console.error('Error deleting uploaded thumbnail slip file:', e)
			)
		);
	}
	await Promise.allSettled(targets);
}

export async function uploadSlipFiles(file: File, refId: string): Promise<UploadedSlipFiles> {
	const thumbnailFile = await createThumbnailFile(file);

	// Sequential (not parallel): managementClient dedups by path+query, and both uploads
	// hit the same /file/private?ref_id=...&access_mode=... — running them concurrently
	// would abort one. Awaiting in series keeps a single client viable.
	const full = await uploadPrivateFile(file, refId);
	const thumb = thumbnailFile ? await uploadPrivateFile(thumbnailFile, refId) : full;

	const uploaded: Partial<UploadedSlipFiles> = {
		fullImageUrl: full.fileAccessURL,
		thumbnailUrl: thumb.fileAccessURL,
		fullFileRecordId: full.fileRecordID,
		thumbnailFileRecordId: thumb.fileRecordID,
		refId
	};

	if (!isUploadedSlipFilesComplete(uploaded)) {
		await cleanupUploadedSlipFiles(uploaded);
		throw new Error('Unable to upload payment slip');
	}

	return uploaded;
}
