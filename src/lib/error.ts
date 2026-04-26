export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function isMissingLikeCountError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message || '';
  return error?.code === '42703' || /like_count.*does not exist/i.test(message);
}
