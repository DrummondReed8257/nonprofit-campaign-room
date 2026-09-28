export type MatchRequest = {
  campaignId: string;
  participantId: string;
  displayName: string;
  role: "donor" | "volunteer";
  receiptCount: number;
  receiptGoal: number;
};

export type CampaignRoomState = {
  campaignId: string;
  receiptProgress: { received: number; goal: number };
  volunteerReminder: "send" | "hold";
  campaignReport: "open" | "collecting";
};

export function decideRoomState(input: MatchRequest): CampaignRoomState {
  const goalReached = input.receiptCount >= input.receiptGoal;
  return {
    campaignId: input.campaignId,
    receiptProgress: { received: input.receiptCount, goal: input.receiptGoal },
    volunteerReminder: goalReached ? "hold" : "send",
    campaignReport: goalReached ? "open" : "collecting",
  };
}

export function campaignChannel(campaignId: string): string {
  return `campaign:${campaignId}`;
}
