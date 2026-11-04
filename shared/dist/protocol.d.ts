import { type InputMessage, type SnapshotMessage } from './types.ts';
/** Binary wire protocol v3. Every multi-byte scalar is little-endian. */
export declare const PROTOCOL_VERSION = 3;
export declare const FRAME_INPUT = 1;
export declare const FRAME_SNAPSHOT = 2;
export declare function encodeInputBinary(input: InputMessage): ArrayBuffer;
export declare function decodeInputBinary(source: ArrayBuffer | ArrayBufferView): InputMessage;
export declare function encodeSnapshotBinary(snapshot: SnapshotMessage): ArrayBuffer;
export declare function decodeSnapshotBinary(source: ArrayBuffer | ArrayBufferView): SnapshotMessage;
export declare function binarySnapshotSize(snapshot: SnapshotMessage): number;
