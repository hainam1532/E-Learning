import { Request, Response } from 'express';
import { prisma } from '../../config/db';

type ResourceRow = {
  id: number;
  type: string;
  refId: number;
  trainingPlanId: number;
};

type PlanRow = {
  id: number;
  title_vi: string | null;
  title_en: string | null;
  title_zh: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  trainingClassId: number | null;
  resources: ResourceRow[];
};

type CourseRow = {
  id: number;
  title_vi: string | null;
  title_en: string | null;
  title_zh: string | null;
};

let dashboardTablesReady = false;

const ensureDashboardTables = async () => {
  if (dashboardTablesReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS training_resource_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_resource_id INTEGER NOT NULL REFERENCES training_resources(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, training_resource_id)
    );
  `);

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

  dashboardTablesReady = true;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const isActiveByDate = (endDate: Date | null, now: Date) => !endDate || endDate >= startOfDay(now);

const getPlanTitle = (plan: { title_vi: string | null; title_en: string | null; title_zh: string | null }) =>
  plan.title_vi || plan.title_en || plan.title_zh || `Ke hoach #${plan as any}`;

export const getAdminDashboardReport = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    await ensureDashboardTables();

    const now = new Date();
    const today = startOfDay(now);
    const sevenDaysLater = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    const sevenDaysBefore = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));

    const learners = await prisma.user.findMany({
      select: {
        id: true,
        usercode: true,
        fullName: true,
        department: { select: { name_vi: true, code: true } },
        position: { select: { name_vi: true, code: true } },
      },
    });

    const learnerIds = learners.map((u) => u.id);
    const learnerMap = new Map<number, (typeof learners)[number]>();
    learners.forEach((u) => {
      learnerMap.set(u.id, u);
    });

    if (!learnerIds.length) {
      res.status(200).json({
        summary: {
          totalLearners: 0,
          activeLearners: 0,
          completionRate: 0,
          totalStudyHours: 0,
        },
        topLearnersThisMonth: [],
        lowestCompletionCourses: [],
        monthlyStudyHours: [],
        expiringPlans: [],
        openExams: [],
        notStartedLearners: [],
      });
      return;
    }

    const classEnrollments = await prisma.classEnrollment.findMany({
      where: { userId: { in: learnerIds } },
      select: { userId: true, classId: true },
    });

    const classIds = Array.from(new Set(classEnrollments.map((e) => e.classId)));
    const classUsersMap = new Map<number, number[]>();
    classEnrollments.forEach((enrollment) => {
      const list = classUsersMap.get(enrollment.classId) || [];
      list.push(enrollment.userId);
      classUsersMap.set(enrollment.classId, list);
    });

    const plans: PlanRow[] = classIds.length
      ? await prisma.trainingPlan.findMany({
          where: {
            trainingClassId: { in: classIds },
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
          select: {
            id: true,
            title_vi: true,
            title_en: true,
            title_zh: true,
            status: true,
            startDate: true,
            endDate: true,
            trainingClassId: true,
            resources: {
              select: {
                id: true,
                type: true,
                refId: true,
                trainingPlanId: true,
              },
            },
          },
        })
      : [];

    const activePlans = plans.filter((p) => p.status === 'ACTIVE' && isActiveByDate(p.endDate, now));
    const activeClassIds = new Set(activePlans.map((p) => p.trainingClassId).filter((id): id is number => typeof id === 'number'));
    const activeLearnerSet = new Set<number>();
    classEnrollments.forEach((e) => {
      if (activeClassIds.has(e.classId)) activeLearnerSet.add(e.userId);
    });

    const allPlanResources = plans.flatMap((p) => p.resources);
    const planIds = plans.map((p) => p.id);
    const resourceIds = allPlanResources.map((r) => r.id);
    const courseIds = Array.from(new Set(allPlanResources.filter((r) => r.type === 'COURSE').map((r) => r.refId)));
    const examIds = Array.from(new Set(allPlanResources.filter((r) => r.type === 'EXAM').map((r) => r.refId)));

    const [lessonRows, learningProgressRows, resourceProgressRows, examAttemptRows, allProgressRows, courses, openExamRows] = await Promise.all([
      courseIds.length
        ? prisma.lesson.findMany({
            where: { courseId: { in: courseIds } },
            select: { id: true, courseId: true },
          })
        : Promise.resolve([]),
      courseIds.length
        ? prisma.learningProgress.findMany({
            where: {
              userId: { in: learnerIds },
              lesson: { courseId: { in: courseIds } },
            },
            select: {
              userId: true,
              completed: true,
              watchedSeconds: true,
              updatedAt: true,
              lesson: { select: { courseId: true } },
            },
          })
        : Promise.resolve([]),
      learnerIds.length > 0 && resourceIds.length > 0
        ? prisma.$queryRawUnsafe<Array<{ user_id: number; training_resource_id: number; completed: boolean }>>(
            `
              SELECT user_id, training_resource_id, completed
              FROM training_resource_progress
              WHERE user_id IN (${learnerIds.join(',')})
                AND training_resource_id IN (${resourceIds.join(',')})
            `
          )
        : Promise.resolve([]),
      learnerIds.length > 0 && examIds.length > 0 && planIds.length > 0
        ? prisma.$queryRawUnsafe<Array<{ user_id: number; exam_session_id: number; training_plan_id: number | null; submitted_at: Date | null; status: string }>>(
            `
              SELECT user_id, exam_session_id, training_plan_id, submitted_at, status
              FROM exam_attempts
              WHERE user_id IN (${learnerIds.join(',')})
                AND exam_session_id IN (${examIds.join(',')})
                AND training_plan_id IN (${planIds.join(',')})
            `
          )
        : Promise.resolve([]),
      prisma.learningProgress.findMany({
        where: { userId: { in: learnerIds } },
        select: {
          userId: true,
          watchedSeconds: true,
          updatedAt: true,
        },
      }),
      courseIds.length
        ? prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, title_vi: true, title_en: true, title_zh: true },
          })
        : Promise.resolve([]),
      prisma.examSession.findMany({
        where: {
          OR: [
            { startAt: { lte: now }, endAt: { gte: now } },
            { startAt: { gt: now, lte: sevenDaysLater } },
            { endAt: { gte: sevenDaysBefore, lt: now } },
          ],
        },
        orderBy: { startAt: 'desc' },
        select: {
          id: true,
          name_vi: true,
          name_en: true,
          name_zh: true,
          startAt: true,
          endAt: true,
          durationMinutes: true,
        },
      }),
    ]);

    const totalLessonsByCourse = new Map<number, number>();
    lessonRows.forEach((lesson) => {
      totalLessonsByCourse.set(lesson.courseId, (totalLessonsByCourse.get(lesson.courseId) || 0) + 1);
    });

    const completedLessonsByUserCourse = new Map<string, number>();
    learningProgressRows.forEach((row) => {
      if (!row.completed) return;
      const key = `${row.userId}:${row.lesson.courseId}`;
      completedLessonsByUserCourse.set(key, (completedLessonsByUserCourse.get(key) || 0) + 1);
    });

    const resourceCompletedSet = new Set(
      resourceProgressRows.filter((r) => r.completed).map((r) => `${r.user_id}:${r.training_resource_id}`)
    );

    const examCompletedSet = new Set(
      examAttemptRows
        .filter((r) => Boolean(r.submitted_at) || r.status !== 'ONGOING')
        .map((r) => `${r.user_id}:${r.training_plan_id}:${r.exam_session_id}`)
    );

    const userPlansMap = new Map<number, PlanRow[]>();
    plans.forEach((plan) => {
      if (!plan.trainingClassId) return;
      const users = classUsersMap.get(plan.trainingClassId) || [];
      users.forEach((userId) => {
        const list = userPlansMap.get(userId) || [];
        list.push(plan);
        userPlansMap.set(userId, list);
      });
    });

    const getResourceCompleted = (userId: number, planId: number, resource: ResourceRow): boolean => {
      if (resource.type === 'COURSE') {
        const total = totalLessonsByCourse.get(resource.refId) || 0;
        const completed = completedLessonsByUserCourse.get(`${userId}:${resource.refId}`) || 0;
        return total > 0 && completed >= total;
      }
      if (resource.type === 'DOCUMENT') {
        return resourceCompletedSet.has(`${userId}:${resource.id}`);
      }
      if (resource.type === 'EXAM') {
        return examCompletedSet.has(`${userId}:${planId}:${resource.refId}`);
      }
      return false;
    };

    let assignedLearners = 0;
    let completedLearners = 0;

    const activePlanIdsSet = new Set(activePlans.map((p) => p.id));

    const notStartedRows: Array<{
      userId: number;
      usercode: string;
      fullName: string;
      department: string;
      position: string;
      activePlanCount: number;
      nearestDeadline: string | null;
    }> = [];

    userPlansMap.forEach((userPlans, userId) => {
      if (!userPlans.length) return;
      assignedLearners += 1;

      const allPlansCompleted = userPlans.every((plan) => {
        if (!plan.resources.length) return false;
        return plan.resources.every((resource) => getResourceCompleted(userId, plan.id, resource));
      });
      if (allPlansCompleted) completedLearners += 1;

      const userActivePlans = userPlans.filter((plan) => activePlanIdsSet.has(plan.id));
      if (!userActivePlans.length) return;

      let started = false;
      userActivePlans.forEach((plan) => {
        plan.resources.forEach((resource) => {
          if (started) return;
          if (resource.type === 'COURSE') {
            const progressRows = learningProgressRows.filter((row) => row.userId === userId && row.lesson.courseId === resource.refId);
            if (progressRows.some((row) => Number(row.watchedSeconds || 0) > 0 || row.completed)) {
              started = true;
            }
            return;
          }
          if (resource.type === 'DOCUMENT') {
            if (resourceCompletedSet.has(`${userId}:${resource.id}`)) {
              started = true;
            }
            return;
          }
          if (resource.type === 'EXAM') {
            const hasAttempt = examAttemptRows.some(
              (row) => row.user_id === userId && row.training_plan_id === plan.id && row.exam_session_id === resource.refId
            );
            if (hasAttempt) {
              started = true;
            }
          }
        });
      });

      if (!started) {
        const user = learnerMap.get(userId);
        if (!user) return;
        const nearestDeadline = userActivePlans
          .map((p) => p.endDate)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        notStartedRows.push({
          userId,
          usercode: user.usercode,
          fullName: user.fullName || '',
          department: user.department?.name_vi || user.department?.code || '-',
          position: user.position?.name_vi || user.position?.code || '-',
          activePlanCount: userActivePlans.length,
          nearestDeadline: nearestDeadline ? nearestDeadline.toISOString() : null,
        });
      }
    });

    const totalWatchedSeconds = allProgressRows.reduce((sum, row) => sum + Number(row.watchedSeconds || 0), 0);

    const monthBuckets: Array<{ month: string; year: number; monthIndex: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
      });
    }

    const monthlyStudyHours = monthBuckets.map((bucket) => {
      const seconds = allProgressRows
        .filter((row) => {
          const d = new Date(row.updatedAt);
          return d.getFullYear() === bucket.year && d.getMonth() === bucket.monthIndex;
        })
        .reduce((sum, row) => sum + Number(row.watchedSeconds || 0), 0);

      return {
        month: bucket.month,
        hours: Number((seconds / 3600).toFixed(2)),
      };
    });

    const currentMonthSecondsByUser = new Map<number, number>();
    allProgressRows.forEach((row) => {
      const d = new Date(row.updatedAt);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      currentMonthSecondsByUser.set(row.userId, (currentMonthSecondsByUser.get(row.userId) || 0) + Number(row.watchedSeconds || 0));
    });

    const topLearnersThisMonth = Array.from(currentMonthSecondsByUser.entries())
      .map(([userId, seconds]) => {
        const user = learnerMap.get(userId);
        if (!user) return null;
        return {
          userId,
          usercode: user.usercode,
          fullName: user.fullName || '',
          department: user.department?.name_vi || user.department?.code || '-',
          hours: Number((seconds / 3600).toFixed(2)),
        };
      })
      .filter((row): row is { userId: number; usercode: string; fullName: string; department: string; hours: number } => Boolean(row))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);

    const courseMap = new Map<number, CourseRow>();
    (courses as CourseRow[]).forEach((course) => {
      courseMap.set(course.id, course);
    });
    const activeCourseResources = activePlans.flatMap((plan) => plan.resources.filter((r) => r.type === 'COURSE').map((r) => ({ planId: plan.id, resource: r, classId: plan.trainingClassId })));

    const courseAssignMap = new Map<number, Set<number>>();
    activeCourseResources.forEach((entry) => {
      if (!entry.classId) return;
      const users = classUsersMap.get(entry.classId) || [];
      const set = courseAssignMap.get(entry.resource.refId) || new Set<number>();
      users.forEach((userId) => set.add(userId));
      courseAssignMap.set(entry.resource.refId, set);
    });

    const lowestCompletionCourses = Array.from(courseAssignMap.entries())
      .map(([courseId, usersSet]) => {
        const totalUsers = usersSet.size;
        if (totalUsers === 0) return null;
        let completedUsers = 0;
        usersSet.forEach((userId) => {
          const total = totalLessonsByCourse.get(courseId) || 0;
          const completed = completedLessonsByUserCourse.get(`${userId}:${courseId}`) || 0;
          if (total > 0 && completed >= total) completedUsers += 1;
        });
        const rate = Number(((completedUsers / totalUsers) * 100).toFixed(2));
        const c = courseMap.get(courseId);
        return {
          courseId,
          courseName: c ? (c.title_vi || c.title_en || c.title_zh || `Khoa hoc ${courseId}`) : `Khoa hoc ${courseId}`,
          completionRate: rate,
          assignedLearners: totalUsers,
        };
      })
      .filter((row): row is { courseId: number; courseName: string; completionRate: number; assignedLearners: number } => Boolean(row))
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 8);

    const expiringPlans = activePlans
      .filter((plan) => plan.endDate && plan.endDate >= today && plan.endDate <= sevenDaysLater)
      .flatMap((plan) => {
        if (!plan.trainingClassId) return [];
        const users = classUsersMap.get(plan.trainingClassId) || [];
        return users.map((userId) => {
          const user = learnerMap.get(userId);
          if (!user) return null;
          const total = plan.resources.length;
          const completed = plan.resources.filter((resource) => getResourceCompleted(userId, plan.id, resource)).length;
          const percent = total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0;
          const daysRemaining = Math.ceil((startOfDay(plan.endDate as Date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          return {
            userId,
            usercode: user.usercode,
            fullName: user.fullName || '',
            department: user.department?.name_vi || user.department?.code || '-',
            planId: plan.id,
            planName: getPlanTitle(plan),
            deadline: (plan.endDate as Date).toISOString(),
            daysRemaining,
            progressPercent: percent,
          };
        });
      })
      .filter((row): row is {
        userId: number;
        usercode: string;
        fullName: string;
        department: string;
        planId: number;
        planName: string;
        deadline: string;
        daysRemaining: number;
        progressPercent: number;
      } => Boolean(row))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 12);

    const openExams = openExamRows
      .map((exam) => {
        const isOpen = exam.startAt <= now && exam.endAt >= now;
        const isUpcoming = exam.startAt > now;
        return {
          id: exam.id,
          name: exam.name_vi || exam.name_en || exam.name_zh || `Exam ${exam.id}`,
          startAt: exam.startAt.toISOString(),
          endAt: exam.endAt.toISOString(),
          durationMinutes: exam.durationMinutes,
          status: isOpen ? 'OPEN' : isUpcoming ? 'UPCOMING' : 'CLOSED',
        };
      })
      .sort((a, b) => {
        const priority = { OPEN: 0, UPCOMING: 1, CLOSED: 2 } as const;
        const p = priority[a.status] - priority[b.status];
        if (p !== 0) return p;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      })
      .slice(0, 8);

    res.status(200).json({
      summary: {
        totalLearners: learners.length,
        activeLearners: activeLearnerSet.size,
        completionRate: assignedLearners > 0 ? Number(((completedLearners / assignedLearners) * 100).toFixed(2)) : 0,
        totalStudyHours: Number((totalWatchedSeconds / 3600).toFixed(2)),
      },
      topLearnersThisMonth,
      lowestCompletionCourses,
      monthlyStudyHours,
      expiringPlans,
      openExams,
      notStartedLearners: notStartedRows
        .sort((a, b) => {
          if (!a.nearestDeadline && !b.nearestDeadline) return 0;
          if (!a.nearestDeadline) return 1;
          if (!b.nearestDeadline) return -1;
          return new Date(a.nearestDeadline).getTime() - new Date(b.nearestDeadline).getTime();
        })
        .slice(0, 12),
    });
  } catch (error) {
    console.error('getAdminDashboardReport error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
