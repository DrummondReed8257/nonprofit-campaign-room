async function main(): Promise<void> {
  const response = await fetch("http://localhost:3000/match", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "spring-drive-alex-42" },
    body: JSON.stringify({
      campaignId: "spring-book-drive",
      participantId: "volunteer-alex",
      displayName: "Alex",
      role: "volunteer",
      receiptCount: 25,
      receiptGoal: 25,
    }),
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
