import { z } from 'zod';
export declare const JoinMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"join">;
    roomId: z.ZodString;
    playerName: z.ZodString;
    protocol: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>>;
}, "strict", z.ZodTypeAny, {
    type: "join";
    roomId: string;
    playerName: string;
    protocol?: "json" | "binary" | undefined;
}, {
    type: "join";
    roomId: string;
    playerName: string;
    protocol?: "json" | "binary" | undefined;
}>;
export declare const LeaveMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"leave">;
}, "strict", z.ZodTypeAny, {
    type: "leave";
}, {
    type: "leave";
}>;
export declare const ChatMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"chat">;
    message: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "chat";
    message: string;
}, {
    type: "chat";
    message: string;
}>;
export declare const InputMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"input">;
    seq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
    throttle: z.ZodNumber;
    turn: z.ZodNumber;
    fire: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    type: "input";
    seq: number & {
        readonly __brand: "InputSeq";
    };
    throttle: number;
    turn: number;
    fire: boolean;
}, {
    type: "input";
    seq: number;
    throttle: number;
    turn: number;
    fire: boolean;
}>;
export declare const ClientMessageSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"join">;
    roomId: z.ZodString;
    playerName: z.ZodString;
    protocol: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>>;
}, "strict", z.ZodTypeAny, {
    type: "join";
    roomId: string;
    playerName: string;
    protocol?: "json" | "binary" | undefined;
}, {
    type: "join";
    roomId: string;
    playerName: string;
    protocol?: "json" | "binary" | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"leave">;
}, "strict", z.ZodTypeAny, {
    type: "leave";
}, {
    type: "leave";
}>, z.ZodObject<{
    type: z.ZodLiteral<"chat">;
    message: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "chat";
    message: string;
}, {
    type: "chat";
    message: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"input">;
    seq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
    throttle: z.ZodNumber;
    turn: z.ZodNumber;
    fire: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    type: "input";
    seq: number & {
        readonly __brand: "InputSeq";
    };
    throttle: number;
    turn: number;
    fire: boolean;
}, {
    type: "input";
    seq: number;
    throttle: number;
    turn: number;
    fire: boolean;
}>]>;
export declare const SnapshotMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"snapshot">;
    version: z.ZodLiteral<3>;
    tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
    ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
    serverTimeMs: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
        score: z.ZodNumber;
        fireCooldown: z.ZodNumber;
        shotsFired: z.ZodNumber;
        kind: z.ZodLiteral<"ship">;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }>, "many">;
    enemies: z.ZodArray<z.ZodObject<{
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
        score: z.ZodNumber;
        fireCooldown: z.ZodNumber;
        shotsFired: z.ZodNumber;
        kind: z.ZodLiteral<"enemy">;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }>, "many">;
    bullets: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"bullet">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        ttl: z.ZodNumber;
        radius: z.ZodNumber;
        homing: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        ownerId: number & {
            readonly __brand: "EntityId";
        };
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        ownerId: number;
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }>, "many">;
    asteroids: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"asteroid">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        angularVelocity: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }>, "many">;
    pickups: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"pickup">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        radius: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        active: boolean;
        kind: "pickup";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        active: boolean;
        kind: "pickup";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "snapshot";
    width: number;
    height: number;
    version: 3;
    tick: number & {
        readonly __brand: "StepNumber";
    };
    ackSeq: number & {
        readonly __brand: "InputSeq";
    };
    serverTimeMs: number;
    players: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }[];
    enemies: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }[];
    bullets: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        ownerId: number & {
            readonly __brand: "EntityId";
        };
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }[];
    asteroids: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }[];
    pickups: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        active: boolean;
        kind: "pickup";
    }[];
}, {
    type: "snapshot";
    width: number;
    height: number;
    version: 3;
    tick: number;
    ackSeq: number;
    serverTimeMs: number;
    players: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }[];
    enemies: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }[];
    bullets: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        ownerId: number;
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }[];
    asteroids: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }[];
    pickups: {
        x: number;
        y: number;
        radius: number;
        id: number;
        active: boolean;
        kind: "pickup";
    }[];
}>;
export declare const PlayersMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"players">;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "players";
    players: {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }[];
}, {
    type: "players";
    players: {
        playerId: number;
        name: string;
    }[];
}>;
export declare const JoinedMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, z.ZodTypeAny, "passthrough">>;
export declare const ErrorMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export declare const ChatServerMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export declare const SystemMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export declare const ShutdownMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"shutdown">;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "shutdown";
    reason: string;
}, {
    type: "shutdown";
    reason: string;
}>;
export declare const ServerMessageSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"snapshot">;
    version: z.ZodLiteral<3>;
    tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
    ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
    serverTimeMs: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
        score: z.ZodNumber;
        fireCooldown: z.ZodNumber;
        shotsFired: z.ZodNumber;
        kind: z.ZodLiteral<"ship">;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }>, "many">;
    enemies: z.ZodArray<z.ZodObject<{
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
        score: z.ZodNumber;
        fireCooldown: z.ZodNumber;
        shotsFired: z.ZodNumber;
        kind: z.ZodLiteral<"enemy">;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }>, "many">;
    bullets: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"bullet">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        ttl: z.ZodNumber;
        radius: z.ZodNumber;
        homing: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        ownerId: number & {
            readonly __brand: "EntityId";
        };
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        ownerId: number;
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }>, "many">;
    asteroids: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"asteroid">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        vx: z.ZodNumber;
        vy: z.ZodNumber;
        angle: z.ZodNumber;
        angularVelocity: z.ZodNumber;
        radius: z.ZodNumber;
        hp: z.ZodNumber;
        maxHp: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }>, "many">;
    pickups: z.ZodArray<z.ZodObject<{
        kind: z.ZodLiteral<"pickup">;
        id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        radius: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        active: boolean;
        kind: "pickup";
    }, {
        x: number;
        y: number;
        radius: number;
        id: number;
        active: boolean;
        kind: "pickup";
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "snapshot";
    width: number;
    height: number;
    version: 3;
    tick: number & {
        readonly __brand: "StepNumber";
    };
    ackSeq: number & {
        readonly __brand: "InputSeq";
    };
    serverTimeMs: number;
    players: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }[];
    enemies: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }[];
    bullets: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        ownerId: number & {
            readonly __brand: "EntityId";
        };
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }[];
    asteroids: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }[];
    pickups: {
        x: number;
        y: number;
        radius: number;
        id: number & {
            readonly __brand: "EntityId";
        };
        active: boolean;
        kind: "pickup";
    }[];
}, {
    type: "snapshot";
    width: number;
    height: number;
    version: 3;
    tick: number;
    ackSeq: number;
    serverTimeMs: number;
    players: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "ship";
    }[];
    enemies: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        score: number;
        fireCooldown: number;
        shotsFired: number;
        kind: "enemy";
    }[];
    bullets: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        ownerId: number;
        kind: "bullet";
        ttl: number;
        homing: boolean;
    }[];
    asteroids: {
        x: number;
        y: number;
        radius: number;
        id: number;
        vx: number;
        vy: number;
        angle: number;
        hp: number;
        maxHp: number;
        kind: "asteroid";
        angularVelocity: number;
    }[];
    pickups: {
        x: number;
        y: number;
        radius: number;
        id: number;
        active: boolean;
        kind: "pickup";
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"players">;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    type: "players";
    players: {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }[];
}, {
    type: "players";
    players: {
        playerId: number;
        name: string;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"joined">;
    room: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodString;
        name: z.ZodString;
        players: z.ZodNumber;
        maxPlayers: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        asteroids: z.ZodNumber;
        enemies: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>;
    playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
    protocol: z.ZodUnion<[z.ZodLiteral<"json">, z.ZodLiteral<"binary">]>;
    seed: z.ZodNumber;
    players: z.ZodArray<z.ZodObject<{
        playerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        playerId: number & {
            readonly __brand: "EntityId";
        };
        name: string;
    }, {
        playerId: number;
        name: string;
    }>, "many">;
    snapshot: z.ZodObject<{
        type: z.ZodLiteral<"snapshot">;
        version: z.ZodLiteral<3>;
        tick: z.ZodEffects<z.ZodNumber, import("./types.ts").StepNumber, number>;
        ackSeq: z.ZodEffects<z.ZodNumber, import("./types.ts").InputSeq, number>;
        serverTimeMs: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        players: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"ship">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }>, "many">;
        enemies: z.ZodArray<z.ZodObject<{
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
            score: z.ZodNumber;
            fireCooldown: z.ZodNumber;
            shotsFired: z.ZodNumber;
            kind: z.ZodLiteral<"enemy">;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }>, "many">;
        bullets: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"bullet">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            ownerId: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            ttl: z.ZodNumber;
            radius: z.ZodNumber;
            homing: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }>, "many">;
        asteroids: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"asteroid">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            vx: z.ZodNumber;
            vy: z.ZodNumber;
            angle: z.ZodNumber;
            angularVelocity: z.ZodNumber;
            radius: z.ZodNumber;
            hp: z.ZodNumber;
            maxHp: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }>, "many">;
        pickups: z.ZodArray<z.ZodObject<{
            kind: z.ZodLiteral<"pickup">;
            id: z.ZodEffects<z.ZodNumber, import("./types.ts").EntityId, number>;
            x: z.ZodNumber;
            y: z.ZodNumber;
            radius: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strict", z.ZodTypeAny, {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }, {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number & {
            readonly __brand: "StepNumber";
        };
        ackSeq: number & {
            readonly __brand: "InputSeq";
        };
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            ownerId: number & {
                readonly __brand: "EntityId";
            };
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number & {
                readonly __brand: "EntityId";
            };
            active: boolean;
            kind: "pickup";
        }[];
    }, {
        type: "snapshot";
        width: number;
        height: number;
        version: 3;
        tick: number;
        ackSeq: number;
        serverTimeMs: number;
        players: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "ship";
        }[];
        enemies: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            score: number;
            fireCooldown: number;
            shotsFired: number;
            kind: "enemy";
        }[];
        bullets: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            ownerId: number;
            kind: "bullet";
            ttl: number;
            homing: boolean;
        }[];
        asteroids: {
            x: number;
            y: number;
            radius: number;
            id: number;
            vx: number;
            vy: number;
            angle: number;
            hp: number;
            maxHp: number;
            kind: "asteroid";
            angularVelocity: number;
        }[];
        pickups: {
            x: number;
            y: number;
            radius: number;
            id: number;
            active: boolean;
            kind: "pickup";
        }[];
    }>;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"error">;
    code: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"chat">;
    playerName: z.ZodString;
    message: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"system">;
    text: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"shutdown">;
    reason: z.ZodString;
}, "strict", z.ZodTypeAny, {
    type: "shutdown";
    reason: string;
}, {
    type: "shutdown";
    reason: string;
}>]>;
export type ParsedClientMessage = z.infer<typeof ClientMessageSchema>;
export type JoinMessage = z.infer<typeof JoinMessageSchema>;
export type ParsedInputMessage = z.infer<typeof InputMessageSchema>;
export type ParsedSnapshotMessage = z.infer<typeof SnapshotMessageSchema>;
export type ParsedServerMessage = z.infer<typeof ServerMessageSchema>;
