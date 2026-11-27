/**
 * `fetch` for the app's own API that treats an HTTP error as a failure.
 *
 * Plain `fetch` only rejects on a network error, so a 401 from an expired
 * session or a 500 from DynamoDB used to look like a successful save. This
 * throws instead, and on 401 sends the browser to the login page with a way
 * back.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.ok) return res
  if (res.status === 401 && typeof window !== 'undefined') {
    const next = window.location.pathname + window.location.search
    window.location.assign(`/login?next=${encodeURIComponent(next)}`)
  }
  throw new ApiError(res.status, `${init?.method || 'GET'} ${input} failed with ${res.status}`)
}

/** `apiFetch` + JSON body parse. */
export async function apiJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init)
  return res.json() as Promise<T>
}
