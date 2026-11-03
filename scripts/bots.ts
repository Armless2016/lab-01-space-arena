import { closeBots, connectBots, createBotRoom, sleep, startBotInputs } from './bot-utils.ts';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const count = Math.min(24, Math.max(1, Number(process.env.BOT_COUNT ?? 8)));
const durationMs = Math.max(5000, Number(process.env.DURATION_MS ?? 30_000));
const roomId = process.env.ROOM_ID ?? `lab7-showcase-${Date.now().toString(36)}`;

async function main(): Promise<void> {
  const health = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Server is not reachable at ${baseUrl}. Start it with npm run dev first.`);
  await createBotRoom(baseUrl, roomId, 32);
  const bots = await connectBots(baseUrl, roomId, count, 'Bot');
  const timer = startBotInputs(bots);
  console.log(`Connected ${count} bots to room "${roomId}" for ${durationMs} ms.`);
  console.log('The room is visible in the browser lobby. Join it with a human player and start your 30-second recording now.');
  await sleep(durationMs);
  clearInterval(timer);
  await closeBots(bots);
  console.log('Bot demo complete.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
