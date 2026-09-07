/**
 * Electron 专项配置扫描（可选，失败不阻塞 scan:security）
 *
 *   npm run scan:electron
 */
import { runCommand } from './lib/security-scan-utils.mjs'

runCommand(
  'Electronegativity',
  'npx',
  ['--yes', '@doyensec/electronegativity', '-i', 'electron/'],
  { allowFail: true },
)

console.log('[scan:electron] 完成（仅供参考，工具较旧时可能有误报）')
