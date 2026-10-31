import {
  loginResponseSchema,
  userResponseSchema,
  type ApiErrorCode,
  type LoginRequest,
  type RegisterRequest,
} from "@cord/contracts";

export class ApiError extends Error {
  readonly code: ApiErrorCode | "NETWORK_ERROR";
  readonly status: number;
  constructor(code: ApiErrorCode | "NETWORK_ERROR", status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function createApiClient(options: { baseUrl?: string; getToken: () => string | null }) {
  async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = options.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await fetch(`${options.baseUrl ?? ""}/api/v1${path}`, {
        method,
        headers,
        credentials: "omit",
        cache: "no-store",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError("NETWORK_ERROR", 0);
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: { code?: ApiErrorCode };
      } | null;
      throw new ApiError(data?.error?.code ?? "INTERNAL_ERROR", response.status);
    }
    return response.status === 204 ? undefined : response.json();
  }
  return {
    async register(input: RegisterRequest) {
      return userResponseSchema.parse(await request("/auth/register", "POST", input));
    },
    async login(input: LoginRequest) {
      return loginResponseSchema.parse(await request("/auth/login", "POST", input));
    },
    async me() {
      return userResponseSchema.parse(await request("/users/me"));
    },
    async logout() {
      await request("/auth/logout", "POST");
    },
  };
}
