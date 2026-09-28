import assert from "node:assert/strict";
import test from "node:test";
import { decideRoomState } from "../src/room_state.ts";

test("opens reporting and holds reminders when every receipt has arrived", () => {
  const state = decideRoomState({
    campaignId: "spring-book-drive",
    participantId: "volunteer-alex",
    displayName: "Alex",
    role: "volunteer",
    receiptCount: 25,
    receiptGoal: 25,
  });

  assert.deepEqual(state, {
    campaignId: "spring-book-drive",
    receiptProgress: { received: 25, goal: 25 },
    volunteerReminder: "hold",
    campaignReport: "open",
  });
});
