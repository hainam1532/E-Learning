import { Request, Response } from 'express';
import { prisma } from '../../config/db';

type AttemptStatus = 'ONGOING' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'FRAUD_TERMINATED';

let examAttemptsTableReady = false;

const ensureExamAttemptsTable = async () => {
  if (examAttemptsTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exam_session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
      training_plan_id INTEGER REFERENCES training_plans(id) ON DELETE SET NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ONGOING',
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMP,
      score NUMERIC(5,2),
      passed BOOLEAN,
      total_questions INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      unanswered_count INTEGER NOT NULL DEFAULT 0,
      cheat_warnings INTEGER NOT NULL DEFAULT 0,
      is_fraud BOOLEAN NOT NULL DEFAULT false,
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  examAttemptsTableReady = true;
};

const safeParam = (value: string | string[] | undefined): string => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
};

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const normalizeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0)
    .sort();
};

const isCorrectAnswer = (type: string, correctAnswer: unknown, userAnswer: unknown): boolean => {
  if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
    return false;
  }

  if (type === 'MULTIPLE_CHOICE') {
    const correct = normalizeArray(correctAnswer);
    const answer = normalizeArray(userAnswer);
    if (correct.length === 0 || answer.length === 0) return false;
    if (correct.length !== answer.length) return false;
    return correct.every((item, index) => item === answer[index]);
  }

  if (type === 'TRUE_FALSE') {
    return normalizeText(correctAnswer) === normalizeText(userAnswer);
  }

  if (type === 'FILL_BLANK') {
    if (Array.isArray(correctAnswer)) {
      const validAnswers = normalizeArray(correctAnswer);
      return validAnswers.includes(normalizeText(userAnswer));
    }
    return normalizeText(correctAnswer) === normalizeText(userAnswer);
  }

  return normalizeText(correctAnswer) === normalizeText(userAnswer);
};

const hasActiveEnrollmentForPlan = async (planId: number, userId: number) => {
  const plan = await prisma.trainingPlan.findFirst({
    where: {
      id: planId,
      trainingClass: {
        enrollments: {
          some: {
            userId,
          },
        },
      },
    },
    select: {
      id: true,
      status: true,
      endDate: true,
    },
  });

  if (!plan) return null;
  if (plan.status === 'CANCELLED' || plan.status === 'COMPLETED') return null;

  if (plan.endDate && new Date(plan.endDate) < new Date()) {
    return null;
  }

  return plan;
};

const resolveAccessiblePlan = async (sessionId: number, userId: number, requestedPlanId?: number) => {
  if (requestedPlanId) {
    const requestedPlan = await prisma.trainingPlan.findFirst({
      where: {
        id: requestedPlanId,
        resources: {
          some: {
            type: 'EXAM',
            refId: sessionId,
          },
        },
      },
      select: {
        id: true,
        status: true,
        endDate: true,
        trainingClass: {
          select: {
            enrollments: {
              where: { userId },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (
      requestedPlan &&
      requestedPlan.trainingClass?.enrollments?.length &&
      requestedPlan.status !== 'CANCELLED' &&
      requestedPlan.status !== 'COMPLETED' &&
      (!requestedPlan.endDate || new Date(requestedPlan.endDate) >= new Date())
    ) {
      return requestedPlan.id;
    }
  }

  const fallbackPlan = await prisma.trainingPlan.findFirst({
    where: {
      resources: {
        some: {
          type: 'EXAM',
          refId: sessionId,
        },
      },
      trainingClass: {
        enrollments: {
          some: { userId },
        },
      },
      NOT: {
        status: {
          in: ['COMPLETED', 'CANCELLED'],
        },
      },
    },
    select: {
      id: true,
      endDate: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!fallbackPlan) return null;
  if (fallbackPlan.endDate && new Date(fallbackPlan.endDate) < new Date()) return null;
  return fallbackPlan.id;
};

const getLocalizedQuestionText = (question: any): string => {
  return question.question_vi || question.question_en || question.question_zh || `Question #${question.id}`;
};

const evaluateAttempt = async (attempt: any) => {
  const session = await prisma.examSession.findUnique({
    where: { id: attempt.exam_session_id },
    select: {
      id: true,
      passingScore: true,
      paperCategoryId: true,
    },
  });

  if (!session) {
    throw new Error('Exam session not found');
  }

  const questions = await prisma.question.findMany({
    where: {
      categoryId: session.paperCategoryId,
    },
    include: {
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const questionOrder: number[] = Array.isArray(attempt.question_order) ? attempt.question_order : [];
  const answers = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};

  let totalQuestions = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const details = questionOrder
    .map((questionId) => questionMap.get(Number(questionId)))
    .filter(Boolean)
    .map((question: any) => {
      totalQuestions += 1;
      const answerKey = String(question.id);
      const userAnswer = answers[answerKey];
      const answered = !(userAnswer === null || userAnswer === undefined || userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0));

      let correct = false;
      if (!answered) {
        unansweredCount += 1;
      } else {
        correct = isCorrectAnswer(question.type, question.correctAnswer, userAnswer);
        if (correct) {
          correctCount += 1;
        } else {
          wrongCount += 1;
        }
      }

      return {
        questionId: question.id,
        type: question.type,
        question: getLocalizedQuestionText(question),
        options: question.options.map((opt: any) => ({
          id: opt.id,
          option_vi: opt.option_vi,
          option_en: opt.option_en,
          option_zh: opt.option_zh,
          order: opt.order,
        })),
        userAnswer,
        correctAnswer: question.correctAnswer,
        answered,
        correct,
      };
    });

  const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;
  const passed = score >= session.passingScore;

  return {
    session,
    score,
    passed,
    totalQuestions,
    correctCount,
    wrongCount,
    unansweredCount,
    details,
  };
};

export const startExamSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

    const sessionId = Number(safeParam(req.params.sessionId));
    const planId = req.body.planId ? Number(req.body.planId) : undefined;

    if (Number.isNaN(sessionId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        paperCategory: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Exam session not found' });
      return;
    }

    const linkedPlanId = await resolveAccessiblePlan(sessionId, req.user.id, planId);
    if (!linkedPlanId) {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    const now = new Date();
    if (now < session.startAt || now > session.endAt) {
      res.status(400).json({ success: false, code: 'EXAM_NOT_OPEN', message: 'Exam is not in available time window' });
      return;
    }

    const existingOngoing = await prisma.$queryRawUnsafe<Array<any>>(
      `
      SELECT *
      FROM exam_attempts
      WHERE user_id = $1 AND exam_session_id = $2 AND status = 'ONGOING'
      ORDER BY id DESC
      LIMIT 1
      `,
      req.user.id,
      sessionId
    );

    if (existingOngoing.length > 0) {
      const attempt = existingOngoing[0];

      const questions = await prisma.question.findMany({
        where: {
          categoryId: session.paperCategoryId,
          id: {
            in: Array.isArray(attempt.question_order)
              ? attempt.question_order.map((q: any) => Number(q))
              : [],
          },
        },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      });

      const order = Array.isArray(attempt.question_order) ? attempt.question_order.map((q: any) => Number(q)) : [];
      const questionMap = new Map(questions.map((q) => [q.id, q]));
      const orderedQuestions = order
        .map((id) => questionMap.get(id))
        .filter(Boolean)
        .map((question: any) => ({
          id: question.id,
          question_vi: question.question_vi,
          question_en: question.question_en,
          question_zh: question.question_zh,
          type: question.type,
          difficulty: question.difficulty,
          options: question.options,
        }));

      res.status(200).json({
        success: true,
        data: {
          session,
          attempt: {
            id: attempt.id,
            startedAt: attempt.started_at,
            cheatWarnings: attempt.cheat_warnings,
            isFraud: attempt.is_fraud,
            answers: attempt.answers || {},
          },
          questions: orderedQuestions,
          resumed: true,
        },
      });
      return;
    }

    const attemptsCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text AS count
      FROM exam_attempts
      WHERE user_id = $1 AND exam_session_id = $2 AND status <> 'ONGOING'
      `,
      req.user.id,
      sessionId
    );
    const finishedAttempts = Number(attemptsCountRows[0]?.count || 0);

    if (finishedAttempts >= session.attemptLimit) {
      const latest = await prisma.$queryRawUnsafe<Array<any>>(
        `
        SELECT id
        FROM exam_attempts
        WHERE user_id = $1 AND exam_session_id = $2 AND status <> 'ONGOING'
        ORDER BY id DESC
        LIMIT 1
        `,
        req.user.id,
        sessionId
      );

      res.status(400).json({
        success: false,
        code: 'ATTEMPT_LIMIT_REACHED',
        message: 'Attempt limit reached',
        latestAttemptId: latest[0]?.id || null,
      });
      return;
    }

    const rawQuestions = await prisma.question.findMany({
      where: {
        categoryId: session.paperCategoryId,
      },
      include: {
        options: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (rawQuestions.length === 0) {
      res.status(400).json({ success: false, message: 'No questions found for exam paper' });
      return;
    }

    const questions = session.shuffleQuestions
      ? [...rawQuestions].sort(() => Math.random() - 0.5)
      : rawQuestions;

    const questionOrder = questions.map((q) => q.id);

    const createdRows = await prisma.$queryRawUnsafe<Array<any>>(
      `
      INSERT INTO exam_attempts (
        user_id,
        exam_session_id,
        training_plan_id,
        status,
        question_order,
        answers,
        total_questions,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, 'ONGOING', $4::jsonb, '{}'::jsonb, $5, NOW(), NOW())
      RETURNING *
      `,
      req.user.id,
      sessionId,
      linkedPlanId,
      JSON.stringify(questionOrder),
      questionOrder.length
    );

    const created = createdRows[0];

    res.status(200).json({
      success: true,
      data: {
        session,
        attempt: {
          id: created.id,
          startedAt: created.started_at,
          cheatWarnings: created.cheat_warnings,
          isFraud: created.is_fraud,
          answers: {},
        },
        questions: questions.map((question) => ({
          id: question.id,
          question_vi: question.question_vi,
          question_en: question.question_en,
          question_zh: question.question_zh,
          type: question.type,
          difficulty: question.difficulty,
          options: question.options,
        })),
        resumed: false,
      },
    });
  } catch (error) {
    console.error('startExamSession error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const saveExamAnswer = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

    const attemptId = Number(safeParam(req.params.attemptId));
    const questionId = Number(req.body.questionId);
    const answer = req.body.answer;

    if (Number.isNaN(attemptId) || Number.isNaN(questionId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `
      SELECT *
      FROM exam_attempts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      attemptId,
      req.user.id
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Attempt not found' });
      return;
    }

    const attempt = rows[0];
    if (attempt.status !== 'ONGOING') {
      res.status(400).json({ success: false, message: 'Attempt is already closed' });
      return;
    }

    const questionOrder: number[] = Array.isArray(attempt.question_order)
      ? attempt.question_order.map((q: any) => Number(q))
      : [];
    if (!questionOrder.includes(questionId)) {
      res.status(400).json({ success: false, message: 'Question does not belong to this attempt' });
      return;
    }

    const answers = attempt.answers && typeof attempt.answers === 'object' ? { ...attempt.answers } : {};
    answers[String(questionId)] = answer;

    await prisma.$executeRawUnsafe(
      `
      UPDATE exam_attempts
      SET answers = $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
      `,
      JSON.stringify(answers),
      attemptId
    );

    res.status(200).json({ success: true, message: 'Answer saved' });
  } catch (error) {
    console.error('saveExamAnswer error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

const finalizeAttempt = async (attemptId: number, userId: number, forceFraud = false) => {
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `
    SELECT *
    FROM exam_attempts
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    attemptId,
    userId
  );

  if (rows.length === 0) {
    throw new Error('Attempt not found');
  }

  const attempt = rows[0];
  if (attempt.status !== 'ONGOING') {
    const evaluated = await evaluateAttempt(attempt);
    return {
      attempt,
      status: attempt.status,
      ...evaluated,
    };
  }

  const evaluated = await evaluateAttempt(attempt);
  const status: AttemptStatus = forceFraud ? 'FRAUD_TERMINATED' : 'SUBMITTED';
  const isFraud = forceFraud ? true : Boolean(attempt.is_fraud);

  const startedAt = new Date(attempt.started_at).getTime();
  const now = Date.now();
  const timeSpentSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  await prisma.$executeRawUnsafe(
    `
    UPDATE exam_attempts
    SET status = $1,
        submitted_at = NOW(),
        score = $2,
        passed = $3,
        total_questions = $4,
        correct_count = $5,
        wrong_count = $6,
        unanswered_count = $7,
        is_fraud = $8,
        time_spent_seconds = $9,
        updated_at = NOW()
    WHERE id = $10
    `,
    status,
    evaluated.score,
    evaluated.passed,
    evaluated.totalQuestions,
    evaluated.correctCount,
    evaluated.wrongCount,
    evaluated.unansweredCount,
    isFraud,
    timeSpentSeconds,
    attemptId
  );

  return {
    attempt: {
      ...attempt,
      status,
      is_fraud: isFraud,
      score: evaluated.score,
      passed: evaluated.passed,
      total_questions: evaluated.totalQuestions,
      correct_count: evaluated.correctCount,
      wrong_count: evaluated.wrongCount,
      unanswered_count: evaluated.unansweredCount,
      time_spent_seconds: timeSpentSeconds,
      submitted_at: new Date().toISOString(),
    },
    status,
    ...evaluated,
  };
};

export const submitExamAttempt = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

    const attemptId = Number(safeParam(req.params.attemptId));
    if (Number.isNaN(attemptId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const result = await finalizeAttempt(attemptId, req.user.id, false);

    res.status(200).json({
      success: true,
      data: {
        attemptId,
        status: result.status,
        score: result.score,
        passed: result.passed,
        totalQuestions: result.totalQuestions,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        unansweredCount: result.unansweredCount,
        isFraud: Boolean(result.attempt.is_fraud),
        cheatWarnings: Number(result.attempt.cheat_warnings || 0),
        details: result.details,
      },
    });
  } catch (error) {
    console.error('submitExamAttempt error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const reportExamCheating = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

    const attemptId = Number(safeParam(req.params.attemptId));
    const reason = normalizeText(req.body?.reason || 'TAB_SWITCH');
    if (Number.isNaN(attemptId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `
      SELECT *
      FROM exam_attempts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      attemptId,
      req.user.id
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Attempt not found' });
      return;
    }

    const attempt = rows[0];
    if (attempt.status !== 'ONGOING') {
      res.status(200).json({
        success: true,
        data: {
          attemptId,
          status: attempt.status,
          cheatWarnings: Number(attempt.cheat_warnings || 0),
          terminated: attempt.status === 'FRAUD_TERMINATED',
          isFraud: Boolean(attempt.is_fraud),
        },
      });
      return;
    }

    const examSession = await prisma.examSession.findUnique({
      where: { id: attempt.exam_session_id },
      select: { antiCheat: true, detectTabSwitch: true },
    });

    const allowTracking =
      examSession &&
      examSession.antiCheat &&
      (reason === 'fullscreen_exit' ? true : examSession.detectTabSwitch);

    if (!allowTracking) {
      res.status(200).json({
        success: true,
        data: {
          attemptId,
          status: attempt.status,
          cheatWarnings: Number(attempt.cheat_warnings || 0),
          terminated: false,
          isFraud: Boolean(attempt.is_fraud),
        },
      });
      return;
    }

    const nextWarnings = Number(attempt.cheat_warnings || 0) + 1;
    const terminated = nextWarnings >= 3;

    await prisma.$executeRawUnsafe(
      `
      UPDATE exam_attempts
      SET cheat_warnings = $1,
          is_fraud = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
      nextWarnings,
      terminated ? true : Boolean(attempt.is_fraud),
      attemptId
    );

    if (terminated) {
      const result = await finalizeAttempt(attemptId, req.user.id, true);
      res.status(200).json({
        success: true,
        data: {
          attemptId,
          status: result.status,
          terminated: true,
          isFraud: true,
          cheatWarnings: 3,
          score: result.score,
          passed: result.passed,
          totalQuestions: result.totalQuestions,
          correctCount: result.correctCount,
          wrongCount: result.wrongCount,
          unansweredCount: result.unansweredCount,
          details: result.details,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        attemptId,
        status: 'ONGOING',
        terminated: false,
        isFraud: Boolean(attempt.is_fraud),
        cheatWarnings: nextWarnings,
      },
    });
  } catch (error) {
    console.error('reportExamCheating error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const getExamAttemptDetail = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

    const attemptId = Number(safeParam(req.params.attemptId));
    if (Number.isNaN(attemptId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `
      SELECT *
      FROM exam_attempts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      attemptId,
      req.user.id
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Attempt not found' });
      return;
    }

    const attempt = rows[0];
    const examSession = await prisma.examSession.findUnique({
      where: { id: attempt.exam_session_id },
      select: {
        passingScore: true,
      },
    });
    const evaluated = await evaluateAttempt(attempt);

    res.status(200).json({
      success: true,
      data: {
        id: attempt.id,
        examSessionId: attempt.exam_session_id,
        trainingPlanId: attempt.training_plan_id,
        status: attempt.status,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
        score: attempt.score ?? evaluated.score,
        passed: attempt.passed ?? evaluated.passed,
        passingScore: examSession?.passingScore ?? 0,
        totalQuestions: attempt.total_questions || evaluated.totalQuestions,
        correctCount: attempt.correct_count || evaluated.correctCount,
        wrongCount: attempt.wrong_count || evaluated.wrongCount,
        unansweredCount: attempt.unanswered_count || evaluated.unansweredCount,
        cheatWarnings: attempt.cheat_warnings,
        isFraud: attempt.is_fraud,
        timeSpentSeconds: attempt.time_spent_seconds || 0,
        details: evaluated.details,
      },
    });
  } catch (error) {
    console.error('getExamAttemptDetail error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const getMyExamAttempts = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    await ensureExamAttemptsTable();

const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `
      SELECT
        ea.id,
        ea.exam_session_id,
        ea.training_plan_id,
        ea.status,
        ea.started_at,
        ea.submitted_at,
        ea.score,
        ea.passed,
        ea.total_questions,
        ea.correct_count,
        ea.wrong_count,
        ea.unanswered_count,
        ea.cheat_warnings,
        ea.is_fraud,
        ea.time_spent_seconds,
        es.name_vi AS exam_name_vi,
        es.name_en AS exam_name_en,
        es.name_zh AS exam_name_zh,
        es."passingScore",
        tp.title_vi AS plan_title_vi,
        tp.title_en AS plan_title_en,
        tp.title_zh AS plan_title_zh
      FROM exam_attempts ea
      JOIN exam_sessions es ON es.id = ea.exam_session_id
      LEFT JOIN training_plans tp ON tp.id = ea.training_plan_id
      WHERE ea.user_id = $1
      ORDER BY ea.id DESC
      `,
      req.user.id
    );

res.status(200).json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        examSessionId: row.exam_session_id,
        trainingPlanId: row.training_plan_id,
        status: row.status,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        score: row.score,
        passed: row.passed,
        passingScore: row.passingScore,
        totalQuestions: row.total_questions,
        correctCount: row.correct_count,
        wrongCount: row.wrong_count,
        unansweredCount: row.unanswered_count,
        cheatWarnings: row.cheat_warnings,
        isFraud: row.is_fraud,
        timeSpentSeconds: row.time_spent_seconds,
        examName: {
          vi: row.exam_name_vi,
          en: row.exam_name_en,
          zh: row.exam_name_zh,
        },
        planTitle: {
          vi: row.plan_title_vi,
          en: row.plan_title_en,
          zh: row.plan_title_zh,
        },
      })),
    });
  } catch (error) {
    console.error('getMyExamAttempts error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
