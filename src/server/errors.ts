export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'INVALID_JSON'
  | 'INVALID_PAYLOAD'
  | 'INVALID_HTML'
  | 'INVALID_FILENAME'
  | 'INVALID_CODE'
  | 'INVALID_SLUG'
  | 'CODE_TAKEN'
  | 'SITE_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'AGENT_KEY_NOT_FOUND'
  | 'DEPLOYMENT_NOT_FOUND'
  | 'CONTENT_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'DATABASE_ERROR'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly detail?: string;

  constructor(status: number, code: AppErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) return error;
  return new AppError(500, 'INTERNAL_ERROR', 'Unexpected server error.', getErrorMessage(error));
}
