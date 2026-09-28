import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.ts";
import { campaignChannel, decideRoomState } from "./room_state.ts";

const matchBody = z.object({
  campaignId: z.string().trim().min(1).max(80),
  participantId: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["donor", "volunteer"]),
  receiptCount: z.number().int().nonnegative(),
  receiptGoal: z.number().int().positive(),
}).strict();

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtimeClient = new InfraiRealtime(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "POST" && url.pathname === "/match") {
      const parsed = matchBody.safeParse(await readJson(request));
      if (!parsed.success) return json(response, 400, { error: "Invalid match request", issues: parsed.error.issues });

      const requestId = request.headers["idempotency-key"]?.toString() ?? randomUUID();
      const channel = campaignChannel(parsed.data.campaignId);
      const state = decideRoomState(parsed.data);
      await realtimeClient.createChannel(channel, `${requestId}:channel`);
      const token = await realtimeClient.issueToken(parsed.data.participantId, channel, `${requestId}:token`);
      await realtimeClient.publishState(channel, state, parsed.data.participantId, `${requestId}:state`);

      return json(response, 201, { channel, token, state });
    }

    const presenceMatch = url.pathname.match(/^\/rooms\/([^/]+)\/presence$/);
    if (request.method === "GET" && presenceMatch) {
      const channel = campaignChannel(decodeURIComponent(presenceMatch[1]));
      return json(response, 200, { channel, presence: await realtimeClient.getPresence(channel) });
    }

    return json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.message, detail: error.detail });
    }
    return json(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}).listen(port, () => {
  console.log(`Nonprofit room service listening on http://localhost:${port}`);
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
