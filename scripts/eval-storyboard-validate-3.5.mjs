/**
 * Phase 3.5：打印 5 镜连续性样本的增强前/后 prompt 预算对比。
 *
 * 用法：npm run eval:storyboard-validate
 */
import {
  CONTINUITY_EVAL_5_SHOTS,
  compareValidatePromptBudget,
  formatValidatePromptCompareReport,
} from '../src/lib/workflow/storyboard-validate-compare.ts'

const report5 = compareValidatePromptBudget()
const stretched = Array.from({ length: 20 }, (_, i) => {
  const base = CONTINUITY_EVAL_5_SHOTS[i % 5]
  return {
    ...base,
    shotNumber: i + 1,
    dialogue: `${base.dialogue}#${i + 1}`,
  }
})
const report20 = compareValidatePromptBudget(stretched)

console.log(formatValidatePromptCompareReport(report5))
console.log('\n---\n')
console.log(formatValidatePromptCompareReport(report20))
