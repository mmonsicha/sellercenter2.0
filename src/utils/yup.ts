import { ValidationError } from 'yup';

export function yupValidationErrorToRecord(error: any): Record<string, string> {
	let validationError: Record<string, string> = {};
	if (error instanceof ValidationError) {
		validationError = {};
		for (const field of error.inner) {
			if (!field.path) continue;
			validationError[field.path] = field.message;
		}
	}

	return validationError;
}
