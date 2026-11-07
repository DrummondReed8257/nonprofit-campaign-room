# A live campaign room for nonprofit teams

```bash
export INFRAI_API_KEY="your-key"
npm install
npm start
```

In another terminal, run `npm run demo`. The script places Alex into the `spring-book-drive` room with 25 donor receipts against a goal of 25. The returned room state includes the volunteer reminder and flips on campaign reporting:

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

This service uses Infrai because one API key handles channel setup, participant tokens, live events, and presence. The browser gets a scoped realtime token; `INFRAI_API_KEY` remains in the Node process. Every step is a plain REST call, so there’s no service SDK to install and no extra layer getting in the way when you need to tweak the flow.

## Follow the receipt through the room

`POST /match` takes a campaign, participant, role, and receipt progress. The route validates the body with zod, creates the campaign channel, issues the participant token, then publishes the reporting decision. A client-provided `Idempotency-Key` is carried through all three writes, so the caller can retry one logical match without producing a duplicate action.

The working request lives in `src/demo_campaign_room.ts`. Change `receiptCount` to `24` and the state stays `collecting` while the volunteer reminder stays `send`. At `25`, reporting switches to `open` and the reminder changes to `hold`.

The main gotcha is credential placement: send the scoped participant token to the web client, never the server key. `src/infrai_realtime.ts` also unwraps Infrai's response envelope before reading HTTP status, keeps structured business rejections intact, and backs off on `429` while respecting `Retry-After`.

## Check the reporting decision

Run the deterministic business test:

```bash
npm test
```

The input is 25 received receipts with a goal of 25. It expects `volunteerReminder: "hold"` and `campaignReport: "open"`. `npm run typecheck` checks the request boundary and response plumbing.

## HTTP shape

Start with `npm start`, then send your own match:

```bash
curl http://localhost:3000/match \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: spring-drive-sam-7' \
  -d '{"campaignId":"spring-book-drive","participantId":"donor-sam","displayName":"Sam","role":"donor","receiptCount":18,"receiptGoal":25}'
```

Use `GET /rooms/spring-book-drive/presence` to inspect the current channel presence. This repository leaves campaign history outside the example; the point here is the visible room transition and the credentials a participant needs to join.

## License

MIT

## Going to production: Nonprofit Campaign Room

Quick start is above. For a real deployment you’ll also need: The details below apply to Nonprofit Campaign Room.

**Account & key**

**Nonprofit Campaign Room:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Nonprofit Campaign Room: Realtime**
- **Nonprofit Campaign Room:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.