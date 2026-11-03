import { WebSocket } from 'ws';

export interface BotConnection {
  readonly socket: WebSocket;
  readonly name: string;
  seq: number;
  joined: boolean;
}

export async function createBotRoom(baseUrl: string, id: string, maxPlayers = 128): Promise<string> {
  const response = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, name: `Lab 7 ${id}`, maxPlayers, width: 960, height: 540, asteroids: 72, enemies: 8, enemyHp: 60, seed: 707 }),
  });
  if (!response.ok) throw new Error(`Cannot create bot room (${response.status}): ${await response.text()}`);
  return id;
}

export async function connectBots(baseUrl: string, roomId: string, count: number, prefix = 'Bot'): Promise<BotConnection[]> {
  const sockets: BotConnection[] = [];
  for (let index = 0; index < count; index += 1) {
    const name = `${prefix}${index + 1}`.slice(0, 18);
    const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/ws`);
    const bot: BotConnection = { socket, name, seq: 0, joined: false };
    sockets.push(bot);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out connecting ${name}`)), 10_000);
      socket.once('open', () => {
        socket.send(JSON.stringify({ type: 'join', roomId, playerName: name, protocol: 'json' }));
      });
      socket.on('message', (raw) => {
        let messageType: string;
        try {
          const parsed: unknown = JSON.parse(raw.toString());
          if (typeof parsed !== 'object' || parsed === null || !('type' in parsed) || typeof parsed.type !== 'string') return;
          messageType = parsed.type;
        } catch { return; }
        if (messageType === 'joined') {
          bot.joined = true;
          clearTimeout(timeout);
          resolve();
        }
        if (messageType === 'error') {
          clearTimeout(timeout);
          reject(new Error(`${name} join failed: ${raw.toString()}`));
        }
      });
      socket.once('error', (error) => { clearTimeout(timeout); reject(error); });
    });
  }
  return sockets;
}

export function startBotInputs(bots: readonly BotConnection[]): NodeJS.Timeout {
  return setInterval(() => {
    for (let index = 0; index < bots.length; index += 1) {
      const bot = bots[index];
      if (!bot || !bot.joined || bot.socket.readyState !== WebSocket.OPEN) continue;
      bot.seq = bot.seq >= 0xffff_fffe ? 1 : bot.seq + 1;
      const phase = (bot.seq + index * 13) % 120;
      const turn = Math.sin((bot.seq + index * 17) * 0.035);
      bot.socket.send(JSON.stringify({
        type: 'input', seq: bot.seq,
        throttle: phase < 80 ? 0.85 : -0.25,
        turn,
        fire: bot.seq % (5 + (index % 4)) === 0,
      }));
    }
  }, 1000 / 30);
}

export async function closeBots(bots: readonly BotConnection[]): Promise<void> {
  await Promise.all(bots.map((bot) => new Promise<void>((resolve) => {
    if (bot.socket.readyState === WebSocket.CLOSED) { resolve(); return; }
    bot.socket.once('close', () => resolve());
    bot.socket.close(1000, 'load test complete');
    setTimeout(() => { if (bot.socket.readyState !== WebSocket.CLOSED) bot.socket.terminate(); resolve(); }, 1000).unref();
  })));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
