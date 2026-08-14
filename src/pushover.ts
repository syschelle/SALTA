export type PushoverSender = (input: { userKey: string; apiToken: string; title: string; message: string }) => Promise<void>;

export const sendPushoverMessage: PushoverSender = async input => {
  const body = new URLSearchParams({
    token: input.apiToken,
    user: input.userKey,
    title: input.title,
    message: input.message,
    priority: "0"
  });
  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "SALTA/0.8"
    },
    body,
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { status?: number };
  if (!response.ok || payload.status !== 1) throw new Error(`PUSHOVER_REQUEST_FAILED:${response.status}`);
};
