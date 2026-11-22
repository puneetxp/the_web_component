/**
 * Calls the host app's own backend with the logged-in user's session: the cookie, plus the
 * session header when the app keeps one in localStorage (intaxing: X-Session-Id = session_id).
 * No API key ever reaches the browser; the backend adds whatever key it needs.
 */
export class TheApi {
  constructor(
    private base: string,
    private sessionStorageKey = 'session_id',
    private sessionHeader = 'X-Session-Id',
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    try {
      const s = localStorage.getItem(this.sessionStorageKey);
      if (s) h[this.sessionHeader] = s;
    } catch { /* storage blocked: the cookie alone is used */ }
    return h;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base.replace(/\/+$/, '') + path, {
      method,
      credentials: 'include',
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch { /* not JSON */ }
    if (!res.ok || (data && data.success === false)) {
      const msg = (data && (data.message || data.error)) || text.replace(/<[^>]+>/g, ' ').trim().slice(0, 200) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, body);
  }
}
