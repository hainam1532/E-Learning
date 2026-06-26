import api from './api';

export interface ExamQuestionOption {
  id: number;
  option_vi?: string | null;
  option_en?: string | null;
  option_zh?: string | null;
  order: number;
}

export interface ExamQuestion {
  id: number;
  question_vi?: string | null;
  question_en?: string | null;
  question_zh?: string | null;
  type: 'FILL_BLANK' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string;
  options: ExamQuestionOption[];
}

export interface ExamSessionInfo {
  id: number;
  name_vi: string;
  name_en?: string | null;
  name_zh?: string | null;
  startAt: string;
  endAt: string;
  attemptLimit: number;
  passingScore: number;
  durationMinutes: number;
  antiCheat: boolean;
  requireFullscreen: boolean;
  detectTabSwitch: boolean;
  shuffleQuestions: boolean;
}

export interface ExamAttemptInfo {
  id: number;
  startedAt: string;
  cheatWarnings: number;
  isFraud: boolean;
  answers: Record<string, unknown>;
}

export interface ExamResultDetail {
  questionId: number;
  type: string;
  question: string;
  options: ExamQuestionOption[];
  userAnswer: unknown;
  correctAnswer: unknown;
  answered: boolean;
  correct: boolean;
}

export interface ExamResult {
  attemptId: number;
  status: string;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  isFraud: boolean;
  cheatWarnings: number;
  details: ExamResultDetail[];
}

export interface MyExamAttempt {
  id: number;
  examSessionId: number;
  trainingPlanId?: number | null;
  status: string;
  startedAt: string;
  submittedAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
  passingScore?: number | null;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  cheatWarnings: number;
  isFraud: boolean;
  timeSpentSeconds: number;
  examName: {
    vi?: string | null;
    en?: string | null;
    zh?: string | null;
  };
  planTitle?: {
    vi?: string | null;
    en?: string | null;
    zh?: string | null;
  };
}

export async function startExam(sessionId: number, planId?: number): Promise<{
  session: ExamSessionInfo;
  attempt: ExamAttemptInfo;
  questions: ExamQuestion[];
  resumed: boolean;
}> {
  const response = await api.post('/training/exam/sessions/' + sessionId + '/start', {
    planId,
  });
  return response.data.data;
}

export async function saveExamAnswer(attemptId: number, questionId: number, answer: unknown): Promise<void> {
  await api.post('/training/exam/attempts/' + attemptId + '/answer', {
    questionId,
    answer,
  });
}

export async function submitExam(attemptId: number): Promise<ExamResult> {
  const response = await api.post('/training/exam/attempts/' + attemptId + '/submit');
  return response.data.data;
}

export async function reportExamCheat(attemptId: number, reason: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' = 'TAB_SWITCH'): Promise<{
  attemptId: number;
  status: string;
  terminated: boolean;
  isFraud: boolean;
  cheatWarnings: number;
  score?: number;
  passed?: boolean;
  totalQuestions?: number;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  details?: ExamResultDetail[];
}> {
  const response = await api.post('/training/exam/attempts/' + attemptId + '/cheat', { reason });
  return response.data.data;
}

export async function getExamAttempt(attemptId: number): Promise<any> {
  const response = await api.get('/training/exam/attempts/' + attemptId);
  return response.data.data;
}

export async function getMyExamAttempts(): Promise<MyExamAttempt[]> {
  const response = await api.get('/training/exam/attempts');
  return response.data.data;
}
