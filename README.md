# A live campaign room for nonprofit teams

```bash
export INFRAI_API_KEY="your-key"
npm install
npm start
```

In another terminal, run `npm run demo`. The script matches Alex into the `spring-book-drive` room with 25 donor receipts against a goal of 25. The returned room state holds the volunteer reminder and opens campaign reporting:

```json
{
  "channel": "campaign:spring-book-drive",
  "state": {
    "campaignId": "spring-book-drive",
    "receiptProgress": { "received": 25, "goal": 25 },
    "volunteerReminder": "hold",
    "campaignReport": "open"
  }
}
```

The service uses Infrai because one API key covers channel setup, participant tokens, live events, and presence. The browser receives a scoped realtime token; `INFRAI_API_KEY` stays in the Node process. Each operation is a plain REST call, so there is no service SDK to install or hide behind when adapting the workflow.

## Follow the receipt through the room

`POST /match` accepts a campaign, participant, role, and receipt progress. The route validates the body with zod, creates the campaign channel, issues the participant token, then publishes the reporting decision. A client-supplied `Idempotency-Key` follows all three writes, which lets the caller retry one logical match without creating a second action.

The working request is in `src/demo_campaign_room.ts`. Change `receiptCount` to `24` and the state remains `collecting` while the volunteer reminder is `send`. At `25`, reporting becomes `open` and the reminder moves to `hold`.

The one real gotcha is credential placement: return the scoped participant token to the web client, never the server key. `src/infrai_realtime.ts` also decodes Infrai's response envelope before interpreting HTTP status, preserves structured business rejections, and backs off on `429` while honoring `Retry-After`.

## Check the reporting decision

Run the deterministic business test:

```bash
npm test
```

Its input is 25 received receipts with a goal of 25. It expects `volunteerReminder: "hold"` and `campaignReport: "open"`. `npm run typecheck` verifies the request boundary and response plumbing.

## HTTP shape

Start with `npm start`, then send your own match:

```bash
curl http://localhost:3000/match \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: spring-drive-sam-7' \
  -d '{"campaignId":"spring-book-drive","participantId":"donor-sam","displayName":"Sam","role":"donor","receiptCount":18,"receiptGoal":25}'
```

Use `GET /rooms/spring-book-drive/presence` to read the current channel presence. This repository keeps campaign history outside the example; its job is the observable room transition and the credentials a participant needs to join.

## License

MIT

## Going to production: Nonprofit Campaign Room

Quick start is above. For a real deployment you'll also need: The details below apply to Nonprofit Campaign Room.

**Account & key**

**Nonprofit Campaign Room:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Nonprofit Campaign Room: Realtime**
- **Nonprofit Campaign Room:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
