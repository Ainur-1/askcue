export type ApiErrorKind = 'permanent' | 'rate_limit' | 'transient'

export function getHttpStatus(error: unknown): number | undefined {
  const value = error as { response?: { status?: unknown }, status?: unknown, code?: unknown }
  const status = value?.response?.status ?? value?.status
  return typeof status === 'number' ? status : undefined
}

export function classifyApiError(error: unknown): ApiErrorKind {
  const status = getHttpStatus(error)
  if ([400, 401, 403, 404].includes(status ?? -1)) return 'permanent'

  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message
      : String(error ?? '')
  if (status === 429) {
    return /quota exceeded|limit:\s*0|daily limit/i.test(message) ? 'permanent' : 'rate_limit'
  }
  return 'transient'
}

export function isPermanentApiError(error: unknown): boolean {
  return classifyApiError(error) === 'permanent'
}
