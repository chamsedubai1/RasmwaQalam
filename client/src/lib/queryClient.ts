import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * SECURITY ENHANCEMENT: Get CSRF token from cookie for protection against CSRF attacks
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Auto-refresh the short-lived access token using the longer-lived refresh
 * token cookie. Single-flight: while one refresh is in progress, all other
 * 401 handlers await the same promise instead of stampeding the endpoint.
 *
 * Returns true if refresh succeeded (caller should retry the original
 * request once), false otherwise (caller should treat as authentication
 * failure and redirect to login).
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const csrfToken = getCsrfToken();
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      });
      // 200 → server set new cookies. 401 → refresh token is gone or revoked.
      return res.ok;
    } catch {
      return false;
    } finally {
      // Reset after a tick so concurrent failures all settle before the
      // next attempt is allowed to retry the network.
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();

  return refreshPromise;
}

/**
 * Send the request once. If the server returns 401 (access token expired
 * or missing), try to refresh and replay the request a single time.
 */
async function fetchWithRefresh(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status !== 401) return res;

  // Don't loop refreshing the refresh endpoint itself.
  if (url.includes("/api/auth/refresh") || url.includes("/api/auth/login")) {
    return res;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;

  // Pull a fresh CSRF token in case the refresh response set a new one,
  // then replay the request exactly once.
  if (init.headers && typeof init.headers === "object" && "x-csrf-token" in (init.headers as any)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) (init.headers as any)["x-csrf-token"] = csrfToken;
  }
  res = await fetch(url, init);
  return res;
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers: Record<string, string> = {};

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }
  }

  const res = await fetchWithRefresh(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithRefresh(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute stale time instead of Infinity to ensure fresh data
      retry: 2, // Retry failed queries twice
    },
    mutations: {
      retry: false,
    },
  },
});
