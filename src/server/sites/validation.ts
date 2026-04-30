import { createHash } from 'node:crypto';
import { AppError } from '@/server/errors';
import { SiteVisibility } from '@/server/sites/types';

export const MAX_HTML_SIZE_BYTES = 1024 * 1024;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])?$/;

export function normalizeSlug(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'INVALID_SLUG', 'slug must be a non-empty string.');
  }

  const slug = value.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new AppError(
      400,
      'INVALID_SLUG',
      'slug must be 4-32 chars, lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen.'
    );
  }

  return slug;
}

export function slugFromFilename(filename: unknown) {
  if (typeof filename !== 'string' || !filename.trim()) return null;
  const base = filename
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/\.html?$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!base) return null;
  return base.slice(0, 32);
}

export function normalizeFilename(value: unknown) {
  if (value == null || value === '') return 'index.html';
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'INVALID_FILENAME', 'filename must be a string.');
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

  return {
    content,
    size,
    checksum: `sha256:${createHash('sha256').update(content).digest('hex')}`,
  };
}

export function normalizeVisibility(value: unknown): SiteVisibility | undefined {
  if (value == null || value === '') return undefined;
  if (value === 'public' || value === 'private' || value === 'unlisted') return value;
  throw new AppError(400, 'INVALID_PAYLOAD', 'visibility must be public, private, or unlisted.');
}

export function optionalString(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}
