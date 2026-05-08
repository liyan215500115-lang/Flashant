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

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  QUEUED: "排队中",
  UPLOADING: "上传中",
  PROCESSING: "平台处理中",
  PUBLISHED: "已发布",
  FAILED: "失败",
};

interface PublishPanelProps {
  records: PublishRecordItem[];
  onPublish: () => void;
  loading: boolean;
}

export function PublishPanel({ records, onPublish, loading }: PublishPanelProps) {
  const hasRecords = records.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>发布</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            选择发布平台并追踪发布状态
          </p>
        </div>
        {!hasRecords && (
          <button
            onClick={onPublish}
            disabled={loading}
            className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "var(--radius-md)",
            }}
          >
            {loading ? "发布中..." : "📤 发布到平台"}
          </button>
        )}
      </div>

      {hasRecords && (
        <div className="flex flex-col gap-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="p-4 rounded-lg border flex items-center justify-between"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 18 }}>
                  {record.platform === "douyin" ? "📱" : "📱"}
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
                <span
                  className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: record.status === "PUBLISHED" ? "var(--success)" :
                      record.status === "FAILED" ? "var(--error)" :
                      "var(--accent)",
                    color: "#fff",
                  }}
                >
                  {PUBLISH_STATUS_LABELS[record.status] || record.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasRecords && (
        <div
          className="p-8 rounded-lg border text-center"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>准备就绪</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            所有素材已审核通过，可发布到平台
          </p>
        </div>
      )}
    </div>
  );
}
