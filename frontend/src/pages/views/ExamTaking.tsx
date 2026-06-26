import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import {
  type ExamQuestion,
  type ExamResult,
  reportExamCheat,
  saveExamAnswer,
  startExam,
  submitExam,
} from "../../services/exam";

const { Title, Text } = Typography;

type AnswerMap = Record<string, unknown>;

const formatSeconds = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m.toString().padStart(2, "0") + ":" + s.toString().padStart(2, "0");
};

const getQuestionText = (q: ExamQuestion) =>
  q.question_vi || q.question_en || q.question_zh || "Câu hỏi";
const getOptionText = (opt: any) =>
  opt.option_vi || opt.option_en || opt.option_zh || "Lựa chọn";

export default function ExamTaking() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const parsedSessionId = Number(sessionId);
  const planId = searchParams.get("planId")
    ? Number(searchParams.get("planId"))
    : undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [reportingCheat, setReportingCheat] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);

  const warningAtRef = useRef(0);

  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter(
        (value) =>
          !(
            value === null ||
            value === undefined ||
            value === "" ||
            (Array.isArray(value) && value.length === 0)
          ),
      ).length,
    [answers],
  );

  const progressPct = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const isUrgent = timeLeft <= 300;

  const handleSubmitExam = async () => {
    if (!attemptId || submitting) return;
    try {
      setSubmitting(true);
      const submitResult = await submitExam(attemptId);
      setResult(submitResult);
      setResultOpen(true);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Không thể nộp bài thi");
    } finally {
      setSubmitting(false);
    }
  };

  const onCheatDetected = async (
    reason: "TAB_SWITCH" | "FULLSCREEN_EXIT" = "TAB_SWITCH",
  ) => {
    if (!attemptId || !session || resultOpen || reportingCheat) return;
    if (!session.antiCheat) return;
    if (reason === "TAB_SWITCH" && !session.detectTabSwitch) return;

    const now = Date.now();
    if (now - warningAtRef.current < 1000) return;
    warningAtRef.current = now;

    try {
      setReportingCheat(true);
      const data = await reportExamCheat(attemptId, reason);
      setCheatWarnings(data.cheatWarnings || 0);

      if (data.terminated) {
        setResult({
          attemptId: data.attemptId,
          status: data.status,
          score: data.score || 0,
          passed: Boolean(data.passed),
          totalQuestions: data.totalQuestions || questions.length,
          correctCount: data.correctCount || 0,
          wrongCount: data.wrongCount || 0,
          unansweredCount: data.unansweredCount || 0,
          isFraud: true,
          cheatWarnings: 3,
          details: data.details || [],
        });
        setResultOpen(true);
        message.error(
          "Bạn đã vi phạm chống gian lận 3/3. Hệ thống tự động kết thúc bài thi.",
        );
      } else {
        message.warning(
          `Cảnh báo gian lận ${data.cheatWarnings || 0}/3. Qua 3 lần sẽ bị kết thúc bài thi.`,
        );
      }
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "Không thể ghi nhận vi phạm",
      );
    } finally {
      setReportingCheat(false);
    }
  };

  const requestExamFullscreen = async (): Promise<boolean> => {
    if (!session?.requireFullscreen) return true;
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch {
      message.error("Không thể vào chế độ toàn màn hình. Vui lòng thử lại.");
      return false;
    }
  };

  const startExamNow = async () => {
    const ok = await requestExamFullscreen();
    if (!ok) return;
    setFullscreenInterrupted(false);
    setExamStarted(true);
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!parsedSessionId || Number.isNaN(parsedSessionId)) {
        message.error("Kỳ thi không hợp lệ");
        navigate("/profile");
        return;
      }
      try {
        setLoading(true);
        const data = await startExam(parsedSessionId, planId);
        setSession(data.session);
        setAttemptId(data.attempt.id);
        setQuestions(data.questions || []);
        setAnswers((data.attempt.answers || {}) as AnswerMap);
        setCheatWarnings(Number(data.attempt.cheatWarnings || 0));

        const startedAt = new Date(data.attempt.startedAt).getTime();
        const durationSeconds = Number(data.session.durationMinutes || 0) * 60;
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setTimeLeft(Math.max(durationSeconds - elapsed, 0));

        if (!data.session.requireFullscreen) {
          setExamStarted(true);
        }
      } catch (error: any) {
        message.error(
          error?.response?.data?.message || "Không thể bắt đầu kỳ thi",
        );
        navigate("/profile");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [parsedSessionId, planId, navigate]);

  useEffect(() => {
    if (!session || !attemptId || resultOpen || !examStarted) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session, attemptId, resultOpen, examStarted]);

  useEffect(() => {
    if (!session || resultOpen || !examStarted) return;
    const onVisibilityChange = () => {
      if (document.hidden) onCheatDetected("TAB_SWITCH");
    };
    const onWindowBlur = () => onCheatDetected("TAB_SWITCH");
    const onFullscreenChange = () => {
      if (!session.requireFullscreen) return;
      if (!document.fullscreenElement) {
        setFullscreenInterrupted(true);
        onCheatDetected("FULLSCREEN_EXIT");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [session, resultOpen, examStarted]);

  const updateAnswer = async (questionId: number, answerValue: unknown) => {
    if (!attemptId) return;
    const nextAnswers = { ...answers, [String(questionId)]: answerValue };
    setAnswers(nextAnswers);
    try {
      await saveExamAnswer(attemptId, questionId, answerValue);
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "Không thể lưu câu trả lời",
      );
    }
  };

  const isAnswered = (questionId: number) => {
    const v = answers[String(questionId)];
    return !(
      v === null ||
      v === undefined ||
      v === "" ||
      (Array.isArray(v) && v.length === 0)
    );
  };

  const renderQuestionInput = (question: ExamQuestion) => {
    const value = answers[String(question.id)];

    if (question.type === "SINGLE_CHOICE") {
      return (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const optionText = getOptionText(option);
            const selected =
              typeof value === "string" && value === optionText;
            return (
              <button
                key={option.id}
                onClick={() => updateAnswer(question.id, optionText)}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                  selected
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-slate-200 hover:bg-slate-50 active:scale-[0.99]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300"
                  }`}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-white block" />
                  )}
                </span>
                <span
                  className={`text-sm leading-snug ${
                    selected
                      ? "text-blue-800 font-medium"
                      : "text-slate-700"
                  }`}
                >
                  {optionText}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "MULTIPLE_CHOICE") {
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const optionText = getOptionText(option);
            const checked = selectedValues.includes(optionText);
            return (
              <button
                key={option.id}
                onClick={() => {
                  const next = checked
                    ? selectedValues.filter((item) => item !== optionText)
                    : [...selectedValues, optionText];
                  updateAnswer(question.id, next);
                }}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                  checked
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    checked
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300"
                  }`}
                >
                  {checked && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-sm leading-snug ${
                    checked ? "text-blue-800 font-medium" : "text-slate-700"
                  }`}
                >
                  {optionText}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "TRUE_FALSE") {
      return (
        <div className="flex gap-3">
          {(["true", "false"] as const).map((val) => {
            const selected = value === val;
            return (
              <button
                key={val}
                onClick={() => updateAnswer(question.id, val)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                  selected
                    ? val === "true"
                      ? "bg-green-50 border-green-400 text-green-800"
                      : "bg-red-50 border-red-400 text-red-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {val === "true" ? "✓ Đúng" : "✗ Sai"}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <input
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
        placeholder="Nhập đáp án..."
        value={typeof value === "string" ? value : ""}
        onChange={(e) => updateAnswer(question.id, e.target.value)}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Card loading />
      </div>
    );
  }

  if (!session || !attemptId || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Alert type="error" message="Không tìm thấy dữ liệu kỳ thi" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="px-3 pt-3 pb-2">
          {/* Row 1: title + timer + submit */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileTextOutlined className="text-blue-600 text-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                  {session.name_vi}
                </p>
                <p className="text-xs text-slate-400 leading-tight">
                  Điểm đạt: {session.passingScore}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Timer pill */}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border transition-colors ${
                  isUrgent
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                <ClockCircleOutlined
                  className={`text-xs ${isUrgent ? "text-red-500" : "text-blue-500"}`}
                />
                {formatSeconds(timeLeft)}
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-full px-4 py-1.5 border-none cursor-pointer transition-all disabled:opacity-60"
              >
                {submitting ? "..." : "Nộp bài"}
              </button>
            </div>
          </div>

          {/* Row 2: progress bar */}
          <div className="flex items-center gap-2 mt-2.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">
              {answeredCount}/{questions.length} câu
            </span>
          </div>
        </div>

        {/* Cheat warnings banner */}
        {cheatWarnings > 0 && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
              cheatWarnings >= 2
                ? "bg-red-500 text-white"
                : "bg-amber-400 text-amber-900"
            }`}
          >
            <SafetyOutlined />
            Cảnh báo gian lận: {cheatWarnings}/3 lần
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="px-3 pt-4 pb-32">
        {/* Pre-exam start card */}
        {!examStarted && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
            <p className="font-semibold text-slate-800 text-base mb-1">
              Sẵn sàng vào bài thi
            </p>
            <p className="text-sm text-slate-500 mb-3">
              {session.requireFullscreen
                ? 'Kỳ thi bắt buộc toàn màn hình. Nhấn "Bắt đầu thi" để kích hoạt.'
                : 'Nhấn "Bắt đầu thi" để vào bài làm.'}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Tag color={session.requireFullscreen ? "blue" : "default"}>
                Toàn màn hình: {session.requireFullscreen ? "Bật" : "Tắt"}
              </Tag>
              <Tag color={session.antiCheat ? "red" : "default"}>
                Chống gian lận: {session.antiCheat ? "Bật" : "Tắt"}
              </Tag>
              <Tag color={session.detectTabSwitch ? "orange" : "default"}>
                Phát hiện đổi tab: {session.detectTabSwitch ? "Bật" : "Tắt"}
              </Tag>
              <Tag color={session.shuffleQuestions ? "purple" : "default"}>
                Xáo trộn: {session.shuffleQuestions ? "Bật" : "Tắt"}
              </Tag>
            </div>
            <button
              onClick={startExamNow}
              className="w-full bg-blue-600 text-white font-semibold rounded-xl py-3 text-sm border-none cursor-pointer hover:bg-blue-700 active:scale-[0.99] transition-all"
            >
              Bắt đầu thi
            </button>
          </div>
        )}

        {/* Fullscreen interrupted alert */}
        {fullscreenInterrupted && session.requireFullscreen && examStarted && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="font-semibold text-red-700 text-sm mb-1">
              Bạn đã thoát toàn màn hình
            </p>
            <p className="text-xs text-red-500 mb-3">
              Vui lòng quay lại toàn màn hình để tiếp tục bài thi.
            </p>
            <button
              onClick={startExamNow}
              className="bg-red-600 text-white text-sm font-medium rounded-xl px-4 py-2 border-none cursor-pointer hover:bg-red-700 transition-all"
            >
              Quay lại toàn màn hình
            </button>
          </div>
        )}

        {/* Question list */}
        {examStarted && !fullscreenInterrupted && (
          <div className="flex flex-col gap-3">
            {questions.map((question, index) => {
              const answered = isAnswered(question.id);
              return (
                <div
                  key={question.id}
                  id={`question-${index}`}
                  className={`bg-white rounded-2xl overflow-hidden border-l-[3px] border border-slate-100 transition-all ${
                    answered
                      ? "border-l-green-400"
                      : "border-l-amber-400"
                  }`}
                >
                  <div className="p-4">
                    {/* Question header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold ${
                            answered ? "text-green-600" : "text-amber-600"
                          }`}
                        >
                          Câu {index + 1}
                        </span>
                        {answered && (
                          <CheckCircleOutlined className="text-green-500 text-xs" />
                        )}
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-700 font-semibold rounded-lg px-2 py-0.5 shrink-0">
                        +{Math.round(100 / questions.length)} điểm
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="text-sm font-medium text-slate-800 leading-relaxed mb-3">
                      {getQuestionText(question)}
                    </p>

                    {/* Answer input */}
                    {renderQuestionInput(question)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Mobile Bottom Navigator ── */}
      {examStarted && !fullscreenInterrupted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-3 pt-2.5 pb-4 z-40">
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 block" />
              <span className="text-xs text-slate-500">
                {answeredCount} đã trả lời
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
              <span className="text-xs text-slate-500">
                {questions.length - answeredCount} còn lại
              </span>
            </div>
          </div>

          {/* Number buttons */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {questions.map((question, index) => {
              const answered = isAnswered(question.id);
              return (
                <button
                  key={question.id}
                  onClick={() =>
                    document
                      .getElementById(`question-${index}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className={`w-9 h-9 rounded-xl text-xs font-semibold shrink-0 border-[1.5px] transition-all active:scale-95 ${
                    answered
                      ? "bg-green-50 text-green-700 border-green-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Result Modal ── */}
      <Modal
        title="Kết quả bài thi"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        width={520}
        footer={[
          <Button key="profile" onClick={() => navigate("/profile")}>
            Về hồ sơ của tôi
          </Button>,
        ]}
      >
        {result && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Alert
              type={result.passed && !result.isFraud ? "success" : "error"}
              message={
                result.isFraud
                  ? "Bài thi bị đánh dấu gian lận"
                  : result.passed
                    ? "Bạn đã vượt qua kỳ thi!"
                    : "Bạn chưa đạt điểm qua"
              }
              description={
                `Điểm: ${result.score} · Đúng: ${result.correctCount} · Sai: ${result.wrongCount} · Bỏ trống: ${result.unansweredCount}`
              }
            />

            <div
              style={{
                maxHeight: 420,
                overflow: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                {result.details.map((detail, index) => (
                  <Card
                    key={detail.questionId}
                    size="small"
                    style={{
                      borderColor: detail.correct
                        ? "#86efac"
                        : detail.answered
                          ? "#fecaca"
                          : "#fcd34d",
                      borderRadius: 10,
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      Câu {index + 1}: {detail.question}
                    </Text>
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Trả lời:{" "}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        {Array.isArray(detail.userAnswer)
                          ? detail.userAnswer.join(", ")
                          : String(detail.userAnswer ?? "Bỏ trống")}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Đáp án đúng:{" "}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        {Array.isArray(detail.correctAnswer)
                          ? detail.correctAnswer.join(", ")
                          : String(detail.correctAnswer ?? "")}
                      </Text>
                    </div>
                    <Tag
                      color={
                        detail.correct
                          ? "success"
                          : detail.answered
                            ? "error"
                            : "warning"
                      }
                      style={{ marginTop: 6 }}
                    >
                      {detail.correct
                        ? "Đúng"
                        : detail.answered
                          ? "Sai"
                          : "Bỏ trống"}
                    </Tag>
                  </Card>
                ))}
              </Space>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}