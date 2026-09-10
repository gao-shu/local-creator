/**
 * 更新下载 URL 解析：TOS 绝对地址原样使用；相对路径拼 feed 根目录
 */
import assert from 'node:assert/strict'
import {
  pickPendingUpdateFile,
  resolveUpdateFileUrl,
} from '../electron/main/update-download-resolve'

const SERVER_FEED = 'https://example.invalid/legacy-client/download'
const TOS_FEED = 'https://example.invalid/releases/client/download'
const TOS_URL =
  'https://example.invalid/releases/client/download/本地漫创 Setup 0.1.24.exe'

assert.equal(
  resolveUpdateFileUrl(TOS_URL, TOS_FEED),
  TOS_URL,
  'TOS feed keeps TOS absolute url (Chromium multi-connection)',
)

assert.equal(
  resolveUpdateFileUrl(TOS_URL, SERVER_FEED),
  `${SERVER_FEED}/${encodeURIComponent('本地漫创 Setup 0.1.24.exe')}`,
  'server feed rewrites TOS url to same-origin mirror for legacy speed',
)

assert.equal(
  resolveUpdateFileUrl('本地漫创 Setup 0.1.24.exe', SERVER_FEED),
  `${SERVER_FEED}/${encodeURIComponent('本地漫创 Setup 0.1.24.exe')}`,
  'relative path resolves against feed base (server mirror for legacy clients)',
)

const pickedTos = pickPendingUpdateFile(
  {
    version: '0.1.24',
    path: TOS_URL,
    sha512: 'abc',
    files: [{ url: TOS_URL, sha512: 'abc' }],
  },
  SERVER_FEED,
)
assert.equal(pickedTos?.url, TOS_URL, 'pickPendingUpdateFile keeps TOS absolute url')

const pickedRelative = pickPendingUpdateFile(
  {
    version: '0.1.24',
    path: '本地漫创 Setup 0.1.24.exe',
    sha512: 'abc',
    files: [{ url: '本地漫创 Setup 0.1.24.exe', sha512: 'abc' }],
  },
  SERVER_FEED,
)
assert.ok(
  pickedRelative?.url.startsWith(SERVER_FEED),
  'pickPendingUpdateFile resolves relative path on server feed',
)

const pickedServerMirror = pickPendingUpdateFile(
  {
    version: '0.1.24',
    path: TOS_URL,
    sha512: 'abc',
    files: [{ url: TOS_URL, sha512: 'abc' }],
  },
  SERVER_FEED,
)
assert.equal(
  pickedServerMirror?.url,
  `${SERVER_FEED}/${encodeURIComponent('本地漫创 Setup 0.1.24.exe')}`,
  'server feed rewrites TOS absolute url to same-origin mirror',
)

console.log('[test-update-download-url] ok')
