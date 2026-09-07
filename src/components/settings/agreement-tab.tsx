import { GlassCard } from '@/components/ui/glass-card'

const AGREEMENT_UPDATED_AT = '2026-07-04'

export function AgreementTab() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">用户协议</h2>
        <p className="text-sm text-muted-foreground mt-1">
          好的漫创桌面客户端使用条款。最后更新：{AGREEMENT_UPDATED_AT}
        </p>
      </div>

      <GlassCard className="p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h3 className="text-foreground font-medium mb-2">1. 软件性质</h3>
          <p>
            好的漫创是一款 AI 辅助影视/漫创工具。剧本解析、分镜、生图、生视频等生成结果由您选用的 AI 模型或平台服务产生，
            本软件不对模型输出内容的准确性、完整性、合法性承担保证责任。您应对生成内容的审核、发布与使用自行负责。
          </p>
        </section>

        <section>
          <h3 className="text-foreground font-medium mb-2">2. 数据存储</h3>
          <p>
            项目、配置、素材与生成文件默认保存在您于「存储位置」中选择的便携数据目录内（含 settings.json、data.json、tasks.json 等），
            不会自动上传至我们的服务器。请勿在不受信任的环境中存放 API Key、访问令牌或其他敏感凭证。
          </p>
        </section>

        <section>
          <h3 className="text-foreground font-medium mb-2">3. 模型与 API 使用</h3>
          <p>
            您可配置自定义模型（自备 API Key 直连第三方服务商），亦可选用平台提供的系统模型。使用自定义模型时，
            您应遵守相应服务商的使用条款与计费规则；使用系统模型时，应遵守平台与服务方相关规则。
            本软件仅作为调用与编排工具，不替代第三方或平台服务方的责任。
          </p>
        </section>

        <section>
          <h3 className="text-foreground font-medium mb-2">4. 账户与邀请</h3>
          <p>
            开启登录后，您可使用微信扫码等方式绑定账户，查看邀请码与邀请记录。
            具体规则以产品内展示及后台配置为准。账户信息的处理，亦受本协议隐私条款约束。
          </p>
        </section>

        <section>
          <h3 className="text-foreground font-medium mb-2">5. 隐私</h3>
          <p>
            除您主动发起的登录、模型 API 请求，以及为完成生图/生视频所必需的上传与回调外，
            本软件不会将您的剧本正文、分镜稿、项目资产等创作数据批量上传至我们的服务器。
            启用登录或平台系统模型时，相关账户信息会按业务需要与后端同步。
          </p>
        </section>

        <section>
          <h3 className="text-foreground font-medium mb-2">6. 免责声明</h3>
          <p>
            因网络、第三方 API 故障、模型服务中断或您本地环境（含路径、权限、磁盘空间）导致的数据丢失或任务失败，
            我们将在合理范围内提供排查支持，但不承担由此产生的间接损失。建议您定期使用「打包导出」备份便携数据目录。
          </p>
        </section>
      </GlassCard>
    </div>
  )
}
