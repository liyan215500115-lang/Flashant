import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PublishRecordItem {
  id: string;
  platform: string;
  status: string;
  platformPostUrl: string | null;
  errorMessage: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
};

const PLATFORM_ICONS: Record<string, string> = {
  douyin: "🎵",
  kuaishou: "📱",
};

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  QUEUED: "排队中",
  UPLOADING: "上传中",
  PROCESSING: "平台处理中",
  PUBLISHED: "已发布",
  FAILED: "失败",
};

function PublishStatusBadge({ status }: { status: string }) {
  const label = PUBLISH_STATUS_LABELS[status] || status;
  if (status === "FAILED") return <Badge variant="destructive">{label}</Badge>;
  if (status === "PUBLISHED") return <Badge variant="default" className="bg-[#16A34A] text-white">{label}</Badge>;
  return <Badge variant="default">{label}</Badge>;
}

interface PublishPanelProps {
  records: PublishRecordItem[];
  onPublish: () => void;
  loading: boolean;
}

export function PublishPanel({ records, onPublish, loading }: PublishPanelProps) {
  const hasRecords = records.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="section-header">
        <div>
          <h2 className="section-title">发布</h2>
          <p className="section-subtitle">选择发布平台并追踪发布状态</p>
        </div>
        {!hasRecords && (
          <Button variant="default" onClick={onPublish} disabled={loading}>
            {loading ? "发布中..." : "📤 发布到平台"}
          </Button>
        )}
      </div>

      {hasRecords && (
        <div className="flex flex-col gap-3">
          {records.map((record) => (
            <div key={record.id} className="card-static p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 20 }}>
                  {PLATFORM_ICONS[record.platform] || "📱"}
                </span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>
                    {PLATFORM_LABELS[record.platform] || record.platform}
                  </p>
                  {record.platformPostUrl && (
                    <a
                      href={record.platformPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                      style={{ color: "var(--accent)" }}
                    >
                      查看发布
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {record.errorMessage && (
                  <span style={{ fontSize: 12, color: "var(--error)" }}>
                    {record.errorMessage}
                  </span>
                )}
                <PublishStatusBadge status={record.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasRecords && (
        <div className="card-static p-8 text-center">
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>准备就绪</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            所有素材已审核通过，可发布到平台
          </p>
        </div>
      )}
    </div>
  );
}
