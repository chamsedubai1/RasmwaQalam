/// <reference types="node" />
import { grpc } from '@improbable-eng/grpc-web';
import TypedEmitter from 'typed-emitter';
import { diffusionMap } from './utils';
declare type DraftStabilityOptions = Partial<{
    outDir: string;
    debug: boolean;
    requestId: string;
    samples: number;
    engine: string;
    host: string;
    seed: number | Array<number>;
    width: number | null;
    height: number | null;
    diffusion: keyof typeof diffusionMap;
    steps: number;
    cfgScale: number;
    noStore: boolean;
    imagePrompt: {
        mime: string;
        content: Buffer;
        mask?: {
            mime: string;
            content: Buffer;
        };
    } | null;
    stepSchedule: {
        start?: number;
        end?: number;
    };
}>;
declare type RequiredStabilityOptions = {
    apiKey: string;
    prompt: string;
};
declare type ImageData = {
    buffer: Buffer;
    filePath: string;
    seed: number;
    mimeType: string;
    classifications: {
        realizedAction: number;
    };
};
declare type ResponseData = {
    isOk: boolean;
    status: keyof grpc.Code;
    code: grpc.Code;
    message: string;
    trailers: grpc.Metadata;
};
declare type StabilityApi = TypedEmitter<{
    image: (data: ImageData) => void;
    end: (data: ResponseData) => void;
}>;
export declare const generate: (opts: DraftStabilityOptions & RequiredStabilityOptions) => StabilityApi;
export declare const generateAsync: (opts: DraftStabilityOptions & RequiredStabilityOptions) => unknown;
export {};
