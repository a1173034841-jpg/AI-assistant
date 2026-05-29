import { useMemo, useState } from "react";
import { ClipboardList, FileText, MessageSquareText } from "lucide-react";
import { SurveyTemplatePreview } from "../components/SurveyTemplatePreview";
import { WorkbenchShell } from "../components/WorkbenchShell";
import { mockSurveyExports } from "../data/mockSurveyExports";
import { mapSurveyExportToFeedback } from "../domain/importMapper";
import type { WorkbenchScenario } from "../domain/types";

type ViewMode = "survey" | "workbench";

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("survey");
  const [selectedExportId, setSelectedExportId] = useState(mockSurveyExports[0].exportId);
  const [scenario, setScenario] = useState<WorkbenchScenario>("服务问题闭环");

  const selectedExport = mockSurveyExports.find((item) => item.exportId === selectedExportId) ?? mockSurveyExports[0];
  const selectedProjectExports = useMemo(
    () => mockSurveyExports.filter((item) => item.projectName === selectedExport.projectName),
    [selectedExport.projectName],
  );
  const feedbackRecords = useMemo(
    () => selectedProjectExports.flatMap((source) => mapSurveyExportToFeedback(source)),
    [selectedProjectExports],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">售后服务运营</p>
          <h1>售后反馈报告工作台</h1>
        </div>
        <nav className="view-switch" aria-label="页面切换">
          <button className={viewMode === "survey" ? "active" : ""} onClick={() => setViewMode("survey")}>
            <ClipboardList size={18} />
            问卷字段
          </button>
          <button className={viewMode === "workbench" ? "active" : ""} onClick={() => setViewMode("workbench")}>
            <MessageSquareText size={18} />
            分析工作台
          </button>
        </nav>
      </header>

      <main>
        {viewMode === "survey" ? (
          <SurveyTemplatePreview onOpenWorkbench={() => setViewMode("workbench")} />
        ) : (
          <WorkbenchShell
            exports={mockSurveyExports}
            selectedExportId={selectedExportId}
            onSelectExport={setSelectedExportId}
            scenario={scenario}
            onScenarioChange={setScenario}
            feedbackRecords={feedbackRecords}
          />
        )}
      </main>

      <footer className="app-footer">
        <FileText size={16} />
        当前原型使用模拟 Excel/CSV 导出数据；姓名、手机号、车牌、VIN 均不进入演示数据。
      </footer>
    </div>
  );
}
