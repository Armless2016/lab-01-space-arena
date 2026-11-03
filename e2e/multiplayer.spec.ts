import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { ServerMessageSchema, type ParsedServerMessage } from '../shared/schemas.ts';

type JoinedFrame = Extract<ParsedServerMessage, { readonly type: 'joined' }>;
type SnapshotFrame = Extract<ParsedServerMessage, { readonly type: 'snapshot' }>;

function listenForFrames(page: Page, onJoined?: (message: JoinedFrame) => void, onSnapshot?: (snapshot: SnapshotFrame) => void): void {
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/ws')) return;
    socket.on('framereceived', (payload) => {
      if (typeof payload !== 'string') return;
      try {
        const raw: unknown = JSON.parse(payload);
        const parsed = ServerMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        if (parsed.data.type === 'joined') onJoined?.(parsed.data);
        if (parsed.data.type === 'snapshot') onSnapshot?.(parsed.data);
      } catch {
        // This E2E test deliberately selects JSON protocol to inspect received server snapshots.
      }
    });
  });
}

async function enterLobby(page: Page, playerName: string): Promise<void> {
  await page.goto('/');
  await page.locator('#loadGameBtn').click();
  await expect(page.locator('#lobbyPanel')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#roomSelect option').first()).toBeAttached();
  await page.locator('#playerNameInput').fill(playerName);
  await page.locator('#roomSelect').selectOption('rookie-orbit');
  await page.locator('#protocolSelect').selectOption('json');
}

async function joinRoom(page: Page): Promise<void> {
  await page.locator('#joinBtn').click();
  await expect(page.locator('#chatPanel')).toBeVisible();
  await expect(page.locator('#networkPanel')).toBeVisible();
}

test('two independent browser clients share movement and room chat', async () => {
  let browserA: Browser | undefined;
  let browserB: Browser | undefined;
  try {
    browserA = await chromium.launch();
    browserB = await chromium.launch();
    const pageA = await browserA.newPage();
    const pageB = await browserB.newPage();
    let playerAId = 0;
    const observedRemotePositions: Array<{ x: number; y: number }> = [];
    listenForFrames(pageA, (message) => { playerAId = message.playerId; });
    listenForFrames(pageB, undefined, (snapshot) => {
      const ship = snapshot.players.find((player) => Number(player.id) === playerAId);
      if (ship) observedRemotePositions.push({ x: ship.x, y: ship.y });
    });

    await enterLobby(pageA, 'Browser Alpha');
    await joinRoom(pageA);
    await expect.poll(() => playerAId).toBeGreaterThan(0);

    await enterLobby(pageB, 'Browser Beta');
    await joinRoom(pageB);
    await expect.poll(() => observedRemotePositions.length).toBeGreaterThan(2);

    const initial = observedRemotePositions.at(-1);
    await pageA.keyboard.down('w');
    await pageA.waitForTimeout(900);
    await pageA.keyboard.up('w');
    await expect.poll(() => {
      const last = observedRemotePositions.at(-1);
      if (!initial || !last) return 0;
      return Math.hypot(last.x - initial.x, last.y - initial.y);
    }, { timeout: 10_000 }).toBeGreaterThan(2);

    await pageA.locator('#chatInput').fill('playwright-chat-check');
    await pageA.locator('#chatSendBtn').click();
    await expect(pageB.locator('#chatMessages')).toContainText('playwright-chat-check');
  } finally {
    await browserA?.close();
    await browserB?.close();
  }
});
