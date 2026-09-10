// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step 5 验收：MediaAPI / IPC payload 类型契约（不启动 Electron）。
 */
import type { MediaAPI } from '@/lib/media/media-service'
import type {
  ExtractAudioResult,
  MediaExtractAudioPayload,
  MediaProbeVideoAudioPayload,
  ProbeVideoAudioResult,
} from '@/types/media'

type AssertEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type ProbeHandler = MediaAPI['probeVideoAudio']
type ExtractHandler = MediaAPI['extractAudio']

type ProbePayloadCheck = AssertEqual<
  Parameters<ProbeHandler>[0],
  MediaProbeVideoAudioPayload
>
type ExtractPayloadCheck = AssertEqual<
  Parameters<ExtractHandler>[0],
  MediaExtractAudioPayload
>
type ProbeReturnCheck = AssertEqual<
  Awaited<ReturnType<ProbeHandler>>,
  ProbeVideoAudioResult
>
type ExtractReturnCheck = AssertEqual<
  Awaited<ReturnType<ExtractHandler>>,
  ExtractAudioResult
>

type MediaIpcContractOk = ProbePayloadCheck extends true
  ? ExtractPayloadCheck extends true
    ? ProbeReturnCheck extends true
      ? ExtractReturnCheck extends true
        ? true
        : false
      : false
    : false
  : false

const contractOk = true as MediaIpcContractOk
if (!contractOk) {
  throw new Error('MediaAPI IPC contract mismatch')
}

console.log('[test:media-ipc] MediaAPI type contract: OK')
