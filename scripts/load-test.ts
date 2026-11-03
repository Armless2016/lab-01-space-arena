import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { closeBots, connectBots, createBotRoom, sleep, startBotInputs } from './bot-utils.ts';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const durationMs = Math.max(1000, Number(process.env.DURATION_MS ?? 5000));
const counts = (process.env.CLIENT_COUNTS ?? '8,32,64,128').split(',').map(Number).filter((value) => Number.isInteger(value) && value > 0);

const RoomMetricsSchema = z.object({
  rooms: z.array(z.object({
    roomId: z.string(),
    players: z.number(),
    step: z.object({
      samples: z.number(), lastMs: z.number(), p50Ms: z.number(),
      p95Ms: z.number(), p99Ms: z.number(), overBudgetSteps: z.number(),
    }),
  })),
});
type RoomMetric = z.infer<typeof RoomMetricsSchema>['rooms'][number];

async function readMetrics(): Promise<RoomMetric[]> {
  const response = await fetch(`${baseUrl}/api/metrics`);
  if (!response.ok) throw new Error(`Metrics endpoint returned ${response.status}`);
  const result = RoomMetricsSchema.parse(await response.json());
  return result.rooms;
}

async function runCount(count: number): Promise<{ count: number; p95: number; p99: number; maxLast: number; overBudget: number }> {
  const roomId = `lab7-load-${process.pid}-${count}`;
  await createBotRoom(baseUrl, roomId, count);
  const rooms = [roomId];
  const bots = [];
  let timer: NodeJS.Timeout | null = null;
  try {
    const connected = await connectBots(baseUrl, roomId, count, 'B');
    bots.push(...connected);
    timer = startBotInputs(bots);
    const start = performance.now();
    const observed: RoomMetric[] = [];
    while (performance.now() - start < durationMs) {
      for (const metric of await readMetrics()) if (rooms.includes(metric.roomId)) observed.push(metric);
      await sleep(200);
    }
    const final = (await readMetrics()).filter((metric) => rooms.includes(metric.roomId));
    const all = [...observed, ...final];
    const p95 = Math.max(0, ...all.map((metric) => metric.step.p95Ms));
    const p99 = Math.max(0, ...all.map((metric) => metric.step.p99Ms));
    const maxLast = Math.max(0, ...final.map((metric) => metric.step.lastMs));
    const overBudget = final.reduce((sum, metric) => sum + metric.step.overBudgetSteps, 0);
    return { count, p95, p99, maxLast, overBudget };
  } finally {
    if (timer) clearInterval(timer);
    await closeBots(bots);
    await sleep(250);
  }
}

async function main(): Promise<void> {
  const health = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Server is not reachable at ${baseUrl}. Start it with npm run dev first.`);
  const results = [];
  for (const count of counts) {
    process.stdout.write(`Running ${count} WebSocket bots for ${durationMs} ms...\n`);
    results.push(await runCount(count));
  }
  const overloaded = results.find((row) => row.p99 > 1000 / 30);
  console.log('\nClients | step p95 ms | step p99 ms | last max ms | steps > 33.33 ms');
  for (const row of results) console.log(`${row.count}\t| ${row.p95.toFixed(3)}\t| ${row.p99.toFixed(3)}\t| ${row.maxLast.toFixed(3)}\t| ${row.overBudget}`);
  console.log(overloaded
    ? `First tested load above the 33.33 ms p99 budget: ${overloaded.count} clients.`
    : 'No tested load exceeded the 33.33 ms p99 step budget.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
