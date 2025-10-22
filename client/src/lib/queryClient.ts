import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // SECURITY ENHANCEMENT: Tokens now in httpOnly cookies, automatically sent by browser
  // No need to read from localStorage - prevents XSS attacks
  
  // Set up headers
  const headers: Record<string, string> = {};
  
  // Add Content-Type for requests with a body
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // This sends httpOnly cookies automatically
  });

  await throwIfResNotOk(res);
  
  // For 204 No Content responses (common for DELETE operations), return empty object
  if (res.status === 204) {
    return {} as T;
  }
  
  return await res.json() as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // SECURITY ENHANCEMENT: Tokens now in httpOnly cookies, automatically sent by browser
    // No need to add Authorization header - prevents XSS attacks
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include", // This sends httpOnly cookies automatically
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
