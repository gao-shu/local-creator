/**
 * 注册所有 Electron E2E 套件（新增套件在此 import + register）
 */
import { registerSuite } from './runner.mjs'
import { smokeSuite } from './suites/smoke.mjs'
import { workshopFlowSuite } from './suites/workshop-flow.mjs'
import { workshopFromScratchSuite } from './suites/workshop-from-scratch.mjs'
import { workshopGenerationStopSuite } from './suites/workshop-generation-stop.mjs'
import { workshopMockFailureSuite } from './suites/workshop-mock-failure.mjs'
import { workshopMultiEpisodeSuite } from './suites/workshop-multi-episode.mjs'
import { workshopStep2EpisodePlanSuite } from './suites/workshop-step2-episode-plan.mjs'
import { workshopProjectCreateSuite } from './suites/workshop-project-create.mjs'
import { workshopProjectListSearchSuite } from './suites/workshop-project-list-search.mjs'
import { workshopProjectLifecycleSuite } from './suites/workshop-project-lifecycle.mjs'
import { canvasListSmokeSuite } from './suites/canvas-list-smoke.mjs'
import { workshopMissingDataRootSuite } from './suites/workshop-missing-data-root.mjs'
import { workshopCapcutExportSuite } from './suites/workshop-capcut-export.mjs'
import { canvasCapcutExportSuite } from './suites/canvas-capcut-export.mjs'
import { workshopCapcutNoClipsSuite } from './suites/workshop-capcut-no-clips.mjs'
import { canvasCapcutNoClipsSuite } from './suites/canvas-capcut-no-clips.mjs'
import { canvasProjectCreateSuite } from './suites/canvas-project-create.mjs'
import { canvasEditorFlowSuite } from './suites/canvas-editor-flow.mjs'
import { canvasRestartPersistenceSuite } from './suites/canvas-restart-persistence.mjs'
import { canvasImageGenerateSuite } from './suites/canvas-image-generate.mjs'
import { canvasImageMaterialSaveSuite } from './suites/canvas-image-material-save.mjs'
import { canvasImageEditSuite } from './suites/canvas-image-edit.mjs'
import { canvasImageEditToolbarSuite } from './suites/canvas-image-edit-toolbar.mjs'
import { canvasGenerationStopSuite } from './suites/canvas-generation-stop.mjs'
import { canvasPromptAiCancelSuite } from './suites/canvas-prompt-ai-cancel.mjs'
import { canvasPromptAiCancelQueueSuite } from './suites/canvas-prompt-ai-cancel-queue.mjs'
import { canvasPromptExtractCancelSuite } from './suites/canvas-prompt-extract-cancel.mjs'
import { canvasAgentSmokeSuite } from './suites/canvas-agent-smoke.mjs'
import { canvasDoubaoWebPanelSuite } from './suites/canvas-doubao-web-panel.mjs'
import { canvasVideoGenerateSuite } from './suites/canvas-video-generate.mjs'
import { canvasMockFailureSuite } from './suites/canvas-mock-failure.mjs'
import { canvasAgentChatSuite } from './suites/canvas-agent-chat.mjs'
import { globalLibrariesSmokeSuite } from './suites/global-libraries-smoke.mjs'
import { workshopStep3MaterialImportSuite } from './suites/workshop-step3-material-import.mjs'
import { workshopStep3MaterialSaveSuite } from './suites/workshop-step3-material-save.mjs'
import { workshopStep4MaterialReferenceSuite } from './suites/workshop-step4-material-reference.mjs'
import { workshopRestartPersistenceSuite } from './suites/workshop-restart-persistence.mjs'
import { workshopShotEditSuite } from './suites/workshop-shot-edit.mjs'
import { workshopStep1ImportSuite } from './suites/workshop-step1-import.mjs'
import { workshopStep3RegenerateSuite } from './suites/workshop-step3-regenerate.mjs'
import { workshopStep3AssetCrudSuite } from './suites/workshop-step3-asset-crud.mjs'
import { workshopStepNavDuringGenerationSuite } from './suites/workshop-step-nav-during-generation.mjs'
import { workshopStep4WorkbenchSuite } from './suites/workshop-step4-workbench.mjs'
import { workshopStep4ValidateSuite } from './suites/workshop-step4-validate.mjs'
import { workshopStep4BatchVideoSuite } from './suites/workshop-step4-batch-video.mjs'
import { workshopTaskPanelActionsSuite } from './suites/workshop-task-panel-actions.mjs'

registerSuite(smokeSuite)
registerSuite(workshopProjectCreateSuite)
registerSuite(workshopProjectListSearchSuite)
registerSuite(workshopProjectLifecycleSuite)
registerSuite(canvasListSmokeSuite)
registerSuite(workshopMissingDataRootSuite)
registerSuite(workshopCapcutExportSuite)
registerSuite(canvasCapcutExportSuite)
registerSuite(workshopCapcutNoClipsSuite)
registerSuite(canvasCapcutNoClipsSuite)
registerSuite(canvasProjectCreateSuite)
registerSuite(canvasEditorFlowSuite)
registerSuite(canvasRestartPersistenceSuite)
registerSuite(canvasImageGenerateSuite)
registerSuite(canvasImageMaterialSaveSuite)
registerSuite(canvasImageEditSuite)
registerSuite(canvasImageEditToolbarSuite)
registerSuite(canvasGenerationStopSuite)
registerSuite(canvasPromptAiCancelSuite)
registerSuite(canvasPromptAiCancelQueueSuite)
registerSuite(canvasPromptExtractCancelSuite)
registerSuite(canvasAgentSmokeSuite)
registerSuite(canvasDoubaoWebPanelSuite)
registerSuite(canvasVideoGenerateSuite)
registerSuite(canvasMockFailureSuite)
registerSuite(canvasAgentChatSuite)
registerSuite(globalLibrariesSmokeSuite)
registerSuite(workshopStep3MaterialImportSuite)
registerSuite(workshopStep3MaterialSaveSuite)
registerSuite(workshopStep4MaterialReferenceSuite)
registerSuite(workshopFlowSuite)
registerSuite(workshopFromScratchSuite)
registerSuite(workshopStep1ImportSuite)
registerSuite(workshopStep3RegenerateSuite)
registerSuite(workshopStep3AssetCrudSuite)
registerSuite(workshopStepNavDuringGenerationSuite)
registerSuite(workshopStep4BatchVideoSuite)
registerSuite(workshopStep4WorkbenchSuite)
registerSuite(workshopStep4ValidateSuite)
registerSuite(workshopGenerationStopSuite)
registerSuite(workshopShotEditSuite)
registerSuite(workshopRestartPersistenceSuite)
registerSuite(workshopTaskPanelActionsSuite)
registerSuite(workshopMockFailureSuite)
registerSuite(workshopMultiEpisodeSuite)
registerSuite(workshopStep2EpisodePlanSuite)
