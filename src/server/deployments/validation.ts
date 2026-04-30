import { AppError } from '@/server/errors';
import { DeploymentVisibility } from '@/server/deployments/types';

export const MAX_HTML_SIZE_BYTES = 1024 * 1024;
export const SHORT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;

export function normalizeFilename(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'INVALID_FILENAME', 'filename must be a non-empty string.');
  }

  const filename = value.trim();
  if (!/\.html?$/i.test(filename)) {
    throw new AppError(400, 'INVALID_FILENAME', 'filename must end with .html or .htm.');
  }

  return filename;
}

export function normalizeHtmlContent(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'INVALID_HTML', 'content must be a non-empty HTML string.');
  }

  const content = value.trim();
  const size = Buffer.byteLength(content, 'utf8');
  if (size > MAX_HTML_SIZE_BYTES) {
    throw new AppError(
      413,
      'INVALID_HTML',
      `HTML content exceeds ${MAX_HTML_SIZE_BYTES} bytes.`,
      `Received ${size} bytes.`
    );
  }

  if (!/(<!doctype html|<html[\s>])/i.test(content)) {
    throw new AppError(400, 'INVALID_HTML', 'HTML must include <!doctype html> or <html>.');
  }

  return { content, size };
}

export function normalizeShortCode(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_CODE', 'code must be a string.');
  }

  const code = value.trim().toLowerCase();
  if (!SHORT_CODE_PATTERN.test(code)) {
    throw new AppError(
      400,
      'INVALID_CODE',
      'code must be 4-32 chars, lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen.'
    );
  }

  return code;
}

export function normalizeVisibility(value: unknown): DeploymentVisibility {
  if (value == null || value === '') return 'public';
  if (value === 'public' || value === 'private' || value === 'unlisted') return value;
  throw new AppError(400, 'INVALID_PAYLOAD', 'visibility must be public, private, or unlisted.');
}

export function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
