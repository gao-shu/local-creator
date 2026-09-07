import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/app/dashboard-layout'
import { WorkflowLayout } from '@/app/workshop/workflow-layout'
import { AuthGuard, GuestGuard } from '@/components/auth/auth-guard'
import { resolveResumeStep } from '@/lib/workflow/step-utils'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { HomePage } from '@/pages/dashboard/home-page'
import { LoginPage } from '@/pages/auth/login-page'
import { MaterialsPage } from '@/pages/materials/materials-page'
import { SettingsPage } from '@/pages/settings/settings-page'
import { CanvasListPage } from '@/pages/canvas/canvas-list-page'
import { CanvasRecycleBinPage } from '@/pages/canvas/canvas-recycle-bin-page'
import { CanvasEditorPage } from '@/pages/canvas/canvas-editor-page'
import { ToolboxPage } from '@/pages/toolbox/toolbox-page'
import { SkillsPoolPage } from '@/pages/toolbox/skills-pool-page'
import { ProjectListPage } from '@/pages/workshop/project-list-page'
import { WorkshopRecycleBinPage } from '@/pages/workshop/workshop-recycle-bin-page'
import { Step1ScriptPage } from '@/pages/workshop/step1-script-page'
import { Step2EpisodePage } from '@/pages/workshop/step2-episode-page'
import { Step3AssetsPage } from '@/pages/workshop/step3-assets-page'
import { Step4StoryboardPage } from '@/pages/workshop/step4-storyboard-page'

/** 进入项目根路径时跳转到上次停留步骤 */
function WorkshopStepRedirect() {
  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const loading = useWorkflowSessionStore((s) => s.loading)

  if (loading || !meta || !data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        加载中…
      </div>
    )
  }

  const step = resolveResumeStep(meta, data)
  return <Navigate to={`step/${step}`} replace />
}

/** 无效 step 子路径时留在项目内，避免落入全局 * → /dashboard */
function WorkshopProjectFallback() {
  const { projectId } = useParams()
  return <Navigate to={`/workshop/${projectId}/step/1`} replace />
}

/** 每次路由进入登录页强制 remount，避免退出后沿用已消费的旧二维码会话 */
function LoginRoute() {
  const location = useLocation()
  return <LoginPage key={location.key} />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<GuestGuard />}>
        <Route path="/login" element={<LoginRoute />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/workshop" element={<ProjectListPage />} />
          <Route path="/workshop/recycle" element={<WorkshopRecycleBinPage />} />
          <Route path="/canvas" element={<CanvasListPage />} />
          <Route path="/canvas/recycle" element={<CanvasRecycleBinPage />} />
          <Route path="/canvas/:projectId" element={<CanvasEditorPage />} />
          <Route path="/workshop/:projectId" element={<WorkflowLayout />}>
            <Route index element={<WorkshopStepRedirect />} />
            <Route path="step/1" element={<Step1ScriptPage />} />
            <Route path="step/2" element={<Step2EpisodePage />} />
            <Route path="step/3" element={<Step3AssetsPage />} />
            <Route path="step/4" element={<Step4StoryboardPage />} />
            <Route path="*" element={<WorkshopProjectFallback />} />
          </Route>
          <Route path="/materials/*" element={<MaterialsPage />} />
          <Route path="/toolbox" element={<ToolboxPage />} />
          <Route path="/toolbox/skills" element={<SkillsPoolPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
