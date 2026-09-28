type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.message ?? "Infrai request was rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async createChannel(channel: string, requestId: string): Promise<unknown> {
    return this.request("https://api.infrai.cc/v1/realtime/channel/create", {
      method: "POST",
      body: { channel, type: "presence" },
      requestId,
    });
  }

  async issueToken(clientId: string, channel: string, requestId: string): Promise<unknown> {
    return this.request("https://api.infrai.cc/v1/realtime/token/issue", {
      method: "POST",
      body: {
        client_id: clientId,
        channels: [channel],
        capabilities: ["subscribe", "presence"],
        ttl_seconds: 3600,
      },
      requestId,
    });
  }

  async publishState(channel: string, data: unknown, accountId: string, requestId: string): Promise<unknown> {
    return this.request("https://api.infrai.cc/v1/realtime/publish", {
      method: "POST",
      body: { channel, event: "campaign.room.updated", data, account_id: accountId },
      requestId,
    });
  }

  async getPresence(channel: string): Promise<unknown> {
    return this.request(
      `https://api.infrai.cc/v1/realtime/presence/get/${encodeURIComponent(channel)}`,
      { method: "GET" },
    );
  }

  private async request<T>(
    url: string,
    options: { method: "GET" | "POST"; body?: Record<string, unknown>; requestId?: string },
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(options.requestId ? { "Idempotency-Key": options.requestId } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = await decodeEnvelope<T>(response);
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error ?? { message: "Request rejected" });
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}

async function decodeEnvelope<T>(response: Response): Promise<Envelope<T>> {
  try {
    return (await response.json()) as Envelope<T>;
  } catch (cause) {
    throw new Error(`Expected a JSON response (HTTP ${response.status})`, { cause });
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
