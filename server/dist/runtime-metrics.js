import process from 'node:process';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
const BUCKETS = 10;
/** Small fixed-memory rolling counters: no unbounded per-message history. */
export class RuntimeMetrics {
    #seconds = new Float64Array(BUCKETS).fill(-1);
    #messages = new Float64Array(BUCKETS);
    #bytes = new Float64Array(BUCKETS);
    #eventLoopDelay;
    #eluStart = performance.eventLoopUtilization();
    constructor() {
        this.#eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
        this.#eventLoopDelay.enable();
    }
    recordMessage(byteCount) {
        const second = Math.floor(performance.now() / 1000);
        const slot = second % BUCKETS;
        if (this.#seconds[slot] !== second) {
            this.#seconds[slot] = second;
            this.#messages[slot] = 0;
            this.#bytes[slot] = 0;
        }
        this.#messages[slot] = (this.#messages[slot] ?? 0) + 1;
        this.#bytes[slot] = (this.#bytes[slot] ?? 0) + Math.max(0, byteCount);
    }
    snapshot(rooms, connections) {
        const currentSecond = Math.floor(performance.now() / 1000);
        let messages = 0;
        let bytes = 0;
        for (let index = 0; index < BUCKETS; index += 1) {
            const bucketSecond = this.#seconds[index] ?? -1;
            if (bucketSecond >= 0 && currentSecond - bucketSecond < BUCKETS) {
                messages += this.#messages[index] ?? 0;
                bytes += this.#bytes[index] ?? 0;
            }
        }
        const roomSteps = rooms.performanceMetrics();
        const memory = process.memoryUsage();
        return {
            rooms: roomSteps.length,
            players: roomSteps.reduce((total, room) => total + room.players, 0),
            connections,
            messagesPerSecond: messages / BUCKETS,
            bytesPerSecond: bytes / BUCKETS,
            eventLoopUtilization: performance.eventLoopUtilization(this.#eluStart).utilization,
            eventLoopDelayP95Ms: this.#eventLoopDelay.percentile(95) / 1e6,
            rssBytes: memory.rss,
            heapUsedBytes: memory.heapUsed,
            roomSteps,
        };
    }
    toPrometheus(rooms, connections) {
        const data = this.snapshot(rooms, connections);
        const lines = [
            '# HELP space_arena_rooms Active rooms', '# TYPE space_arena_rooms gauge', `space_arena_rooms ${data.rooms}`,
            '# HELP space_arena_players Active players', '# TYPE space_arena_players gauge', `space_arena_players ${data.players}`,
            '# HELP space_arena_connections Active WebSocket connections', '# TYPE space_arena_connections gauge', `space_arena_connections ${data.connections}`,
            '# HELP space_arena_messages_per_second Rolling 10-second message rate', '# TYPE space_arena_messages_per_second gauge', `space_arena_messages_per_second ${data.messagesPerSecond.toFixed(3)}`,
            '# HELP space_arena_bytes_per_second Rolling 10-second traffic rate', '# TYPE space_arena_bytes_per_second gauge', `space_arena_bytes_per_second ${data.bytesPerSecond.toFixed(3)}`,
            '# HELP space_arena_event_loop_utilization Node event loop utilization', '# TYPE space_arena_event_loop_utilization gauge', `space_arena_event_loop_utilization ${data.eventLoopUtilization.toFixed(6)}`,
            '# HELP space_arena_event_loop_delay_p95_ms Event loop delay p95', '# TYPE space_arena_event_loop_delay_p95_ms gauge', `space_arena_event_loop_delay_p95_ms ${data.eventLoopDelayP95Ms.toFixed(3)}`,
            '# HELP process_resident_memory_bytes Resident memory size', '# TYPE process_resident_memory_bytes gauge', `process_resident_memory_bytes ${data.rssBytes}`,
            '# HELP process_heap_used_bytes V8 heap used', '# TYPE process_heap_used_bytes gauge', `process_heap_used_bytes ${data.heapUsedBytes}`,
            '# HELP space_arena_room_step_last_ms Last simulation step duration by room', '# TYPE space_arena_room_step_last_ms gauge',
            ...data.roomSteps.map((room) => `space_arena_room_step_last_ms{room="${room.roomId}"} ${room.step.lastMs.toFixed(4)}`),
            '# HELP space_arena_room_step_p99_ms Simulation step p99 by room', '# TYPE space_arena_room_step_p99_ms gauge',
            ...data.roomSteps.map((room) => `space_arena_room_step_p99_ms{room="${room.roomId}"} ${room.step.p99Ms.toFixed(4)}`),
            '# HELP space_arena_room_over_budget_steps Simulation steps exceeding 33.333 ms', '# TYPE space_arena_room_over_budget_steps counter',
            ...data.roomSteps.map((room) => `space_arena_room_over_budget_steps{room="${room.roomId}"} ${room.step.overBudgetSteps}`),
        ];
        return `${lines.join('\n')}\n`;
    }
    close() { this.#eventLoopDelay.disable(); }
}
