import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../config/db';

type TimeReportRow = {
  key: string;
  userId: number;
  usercode: string;
  fullName: string;
  position: string;
  department: string;
  courseId: number;
  courseName: string;
  deadline: string | null;
  daysRemaining: number | null;
  studyHours: number;
  progressPercent: number;
  status: 'CHUA_BAT_DAU' | 'DANG_HOC' | 'HOAN_THANH' | 'QUA_HAN';
  planId: number | null;
};

type TimeReportSummary = {
  totalLearners: number;
  totalCourses: number;
  completionRate: number;
  totalStudyHours: number;
};

type TimeReportPayload = {
  summary: TimeReportSummary;
  rows: TimeReportRow[];
};

let reportTablesReady = false;

const ensureReportTables = async () => {
  if (reportTablesReady) return;

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

  reportTablesReady = true;
};

const safeParamString = (val: string | string[] | undefined): string => {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
};

const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (endDate: Date, startDate: Date) => {
  const ms = toStartOfDay(endDate).getTime() - toStartOfDay(startDate).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const toStatus = (progressPercent: number, studyHours: number, deadline: Date | null): TimeReportRow['status'] => {
  if (progressPercent >= 100) return 'HOAN_THANH';
  if (deadline && diffDays(deadline, new Date()) < 0) return 'QUA_HAN';
  if (progressPercent > 0 || studyHours > 0) return 'DANG_HOC';
  return 'CHUA_BAT_DAU';
};

const statusLabel = (status: TimeReportRow['status']) => {
  if (status === 'HOAN_THANH') return 'Hoan thanh';
  if (status === 'QUA_HAN') return 'Qua han';
  if (status === 'DANG_HOC') return 'Dang hoc';
  return 'Chua bat dau';
};

const getCourseTitle = (course: { title_vi: string | null; title_en: string | null; title_zh: string | null }) => {
  return course.title_vi || course.title_en || course.title_zh || 'Khoa hoc';
};

const buildTimeReportData = async (filters: {
  usercode?: string;
  departmentId?: number;
  courseId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<TimeReportPayload> => {
  const users = await prisma.user.findMany({
    where: {
      ...(filters.usercode
        ? {
            usercode: {
              contains: filters.usercode,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    },
    select: {
      id: true,
      usercode: true,
      fullName: true,
      position: {
        select: {
          name_vi: true,
          code: true,
        },
      },
      department: {
        select: {
          name_vi: true,
          code: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    return {
      summary: {
        totalLearners: 0,
        totalCourses: 0,
        completionRate: 0,
        totalStudyHours: 0,
      },
      rows: [],
    };
  }

  const userIds = users.map((u) => u.id);

  const [directEnrollments, classEnrollments] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        userId: { in: userIds },
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
      },
      select: {
        userId: true,
        courseId: true,
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        classId: true,
      },
    }),
  ]);

  const classIds = Array.from(new Set(classEnrollments.map((e) => e.classId)));

  const plans = classIds.length
    ? await prisma.trainingPlan.findMany({
        where: {
          trainingClassId: { in: classIds },
        },
        select: {
          id: true,
          trainingClassId: true,
          endDate: true,
          resources: {
            where: {
              type: 'COURSE',
              ...(filters.courseId ? { refId: filters.courseId } : {}),
            },
            select: {
              refId: true,
            },
          },
        },
      })
    : [];

  const classUserMap = new Map<number, number[]>();
  classEnrollments.forEach((enrollment) => {
    const list = classUserMap.get(enrollment.classId) || [];
    list.push(enrollment.userId);
    classUserMap.set(enrollment.classId, list);
  });

  const rowSeed = new Map<string, { userId: number; courseId: number; deadline: Date | null; planId: number | null }>();

  directEnrollments.forEach((enrollment) => {
    const key = `${enrollment.userId}:${enrollment.courseId}:0`;
    rowSeed.set(key, {
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      deadline: null,
      planId: null,
    });
  });

  plans.forEach((plan) => {
    const usersInClass = plan.trainingClassId ? classUserMap.get(plan.trainingClassId) || [] : [];
    usersInClass.forEach((userId) => {
      plan.resources.forEach((resource) => {
        const key = `${userId}:${resource.refId}:${plan.id}`;
        rowSeed.set(key, {
          userId,
          courseId: resource.refId,
          deadline: plan.endDate || null,
          planId: plan.id,
        });
      });
    });
  });

  const seeds = Array.from(rowSeed.values());
  if (!seeds.length) {
    return {
      summary: {
        totalLearners: 0,
        totalCourses: 0,
        completionRate: 0,
        totalStudyHours: 0,
      },
      rows: [],
    };
  }

  const courseIds = Array.from(new Set(seeds.map((seed) => seed.courseId)));
  const [courses, lessons, progressRows] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        title_vi: true,
        title_en: true,
        title_zh: true,
      },
    }),
    prisma.lesson.findMany({
      where: { courseId: { in: courseIds } },
      select: {
        id: true,
        courseId: true,
        video: {
          select: {
            duration: true,
          },
        },
      },
    }),
    prisma.learningProgress.findMany({
      where: {
        userId: { in: userIds },
        lesson: {
          courseId: { in: courseIds },
        },
      },
      select: {
        userId: true,
        lessonId: true,
        completed: true,
        watchedSeconds: true,
        lesson: {
          select: {
            courseId: true,
            video: {
              select: {
                duration: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const totalLessonsByCourse = new Map<number, number>();
  lessons.forEach((lesson) => {
    totalLessonsByCourse.set(lesson.courseId, (totalLessonsByCourse.get(lesson.courseId) || 0) + 1);
  });

  const completedLessonsByUserCourse = new Map<string, number>();
  const watchedSecondsByUserCourse = new Map<string, number>();

  progressRows.forEach((row) => {
    const key = `${row.userId}:${row.lesson.courseId}`;
    const duration = row.lesson.video?.duration || 0;
    const watchedSeconds = Number(row.watchedSeconds || 0);
    const safeWatched = duration > 0 ? Math.max(0, Math.min(duration, watchedSeconds)) : Math.max(0, watchedSeconds);

    watchedSecondsByUserCourse.set(key, (watchedSecondsByUserCourse.get(key) || 0) + safeWatched);

    if (row.completed) {
      completedLessonsByUserCourse.set(key, (completedLessonsByUserCourse.get(key) || 0) + 1);
    }
  });

  const planIds = Array.from(
    new Set(
      seeds
        .map((seed) => seed.planId)
        .filter((id): id is number => typeof id === 'number' && !isNaN(id))
    )
  );

  const planResources = planIds.length
    ? await prisma.trainingResource.findMany({
        where: { trainingPlanId: { in: planIds } },
        select: {
          id: true,
          type: true,
          refId: true,
          trainingPlanId: true,
        },
      })
    : [];

  const resourcesByPlan = new Map<number, Array<{ id: number; type: string; refId: number; trainingPlanId: number }>>();
  planResources.forEach((resource) => {
    const list = resourcesByPlan.get(resource.trainingPlanId) || [];
    list.push(resource);
    resourcesByPlan.set(resource.trainingPlanId, list);
  });

  const resourceIds = planResources.map((resource) => resource.id);
  const examIds = Array.from(
    new Set(
      planResources
        .filter((resource) => resource.type === 'EXAM')
        .map((resource) => resource.refId)
    )
  );

  const [resourceProgressRows, examAttemptRows]: [
    Array<{ user_id: number; training_resource_id: number; completed: boolean }>,
    Array<{ user_id: number; exam_session_id: number; training_plan_id: number | null; submitted_at: Date | null; status: string }>
  ] = await Promise.all([
    userIds.length > 0 && resourceIds.length > 0
      ? prisma.$queryRawUnsafe<Array<{ user_id: number; training_resource_id: number; completed: boolean }>>(
          `
            SELECT user_id, training_resource_id, completed
            FROM training_resource_progress
            WHERE user_id IN (${userIds.join(',')})
              AND training_resource_id IN (${resourceIds.join(',')})
          `
        )
      : Promise.resolve<Array<{ user_id: number; training_resource_id: number; completed: boolean }>>([]),
    userIds.length > 0 && examIds.length > 0 && planIds.length > 0
      ? prisma.$queryRawUnsafe<Array<{ user_id: number; exam_session_id: number; training_plan_id: number | null; submitted_at: Date | null; status: string }>>(
          `
            SELECT user_id, exam_session_id, training_plan_id, submitted_at, status
            FROM exam_attempts
            WHERE user_id IN (${userIds.join(',')})
              AND exam_session_id IN (${examIds.join(',')})
              AND training_plan_id IN (${planIds.join(',')})
          `
        )
      : Promise.resolve<Array<{ user_id: number; exam_session_id: number; training_plan_id: number | null; submitted_at: Date | null; status: string }>>([]),
  ]);

  const resourceCompletedSet = new Set(
    resourceProgressRows
      .filter((row) => row.completed)
      .map((row) => `${row.user_id}:${row.training_resource_id}`)
  );

  const examCompletedSet = new Set(
    examAttemptRows
      .filter((row) => Boolean(row.submitted_at) || row.status !== 'ONGOING')
      .map((row) => `${row.user_id}:${row.training_plan_id}:${row.exam_session_id}`)
  );

  let rows = seeds
    .map((seed) => {
      const user = userMap.get(seed.userId);
      const course = courseMap.get(seed.courseId);
      if (!user || !course) return null;

      const progressKey = `${seed.userId}:${seed.courseId}`;
      const totalLessons = totalLessonsByCourse.get(seed.courseId) || 0;
      const completedLessons = completedLessonsByUserCourse.get(progressKey) || 0;
      const watchedSeconds = watchedSecondsByUserCourse.get(progressKey) || 0;
      const studyHours = Number((watchedSeconds / 3600).toFixed(2));
      const courseProgressPercent = totalLessons > 0 ? Number(((completedLessons / totalLessons) * 100).toFixed(2)) : 0;

      let progressPercent = courseProgressPercent;
      if (seed.planId) {
        const planItems = resourcesByPlan.get(seed.planId) || [];
        if (planItems.length > 0) {
          let totalItemUnits = 0;
          let completedItemUnits = 0;

          planItems.forEach((item) => {
            if (item.type === 'COURSE') {
              const itemCourseKey = `${seed.userId}:${item.refId}`;
              const itemTotalLessons = totalLessonsByCourse.get(item.refId) || 0;
              const itemCompletedLessons = completedLessonsByUserCourse.get(itemCourseKey) || 0;
              const unitCount = Math.max(1, itemTotalLessons);
              totalItemUnits += unitCount;
              completedItemUnits += Math.min(itemCompletedLessons, unitCount);
              return;
            }

            if (item.type === 'DOCUMENT') {
              totalItemUnits += 1;
              if (resourceCompletedSet.has(`${seed.userId}:${item.id}`)) {
                completedItemUnits += 1;
              }
              return;
            }

            if (item.type === 'EXAM') {
              totalItemUnits += 1;
              if (examCompletedSet.has(`${seed.userId}:${seed.planId}:${item.refId}`)) {
                completedItemUnits += 1;
              }
            }
          });

          progressPercent = totalItemUnits > 0
            ? Number(((completedItemUnits / totalItemUnits) * 100).toFixed(2))
            : 0;
        }
      }

      const status = toStatus(progressPercent, studyHours, seed.deadline);

      return {
        key: `${seed.userId}-${seed.courseId}-${seed.planId || 0}`,
        userId: seed.userId,
        usercode: user.usercode,
        fullName: user.fullName || '',
        position: user.position?.name_vi || user.position?.code || '-',
        department: user.department?.name_vi || user.department?.code || '-',
        courseId: seed.courseId,
        courseName: getCourseTitle(course),
        deadline: seed.deadline ? seed.deadline.toISOString() : null,
        daysRemaining: seed.deadline ? diffDays(seed.deadline, new Date()) : null,
        studyHours,
        progressPercent,
        status,
        planId: seed.planId,
      } as TimeReportRow;
    })
    .filter((row): row is TimeReportRow => Boolean(row));

  if (filters.startDate || filters.endDate) {
    rows = rows.filter((row) => {
      if (!row.deadline) return false;
      const deadline = toStartOfDay(new Date(row.deadline));
      if (filters.startDate && deadline < toStartOfDay(filters.startDate)) return false;
      if (filters.endDate && deadline > toStartOfDay(filters.endDate)) return false;
      return true;
    });
  }

  const learnerSet = new Set(rows.map((row) => row.userId));
  const courseSet = new Set(rows.map((row) => row.courseId));
  const totalStudyHours = Number(rows.reduce((sum, row) => sum + row.studyHours, 0).toFixed(2));
  const completionRate = rows.length
    ? Number((rows.reduce((sum, row) => sum + row.progressPercent, 0) / rows.length).toFixed(2))
    : 0;

  return {
    summary: {
      totalLearners: learnerSet.size,
      totalCourses: courseSet.size,
      completionRate,
      totalStudyHours,
    },
    rows,
  };
};

export const getLearningTimeReport = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    await ensureReportTables();

    const usercode = safeParamString(req.query.usercode as string | string[] | undefined).trim();
    const departmentIdRaw = safeParamString(req.query.departmentId as string | string[] | undefined).trim();
    const courseIdRaw = safeParamString(req.query.courseId as string | string[] | undefined).trim();
    const startDateRaw = safeParamString(req.query.startDate as string | string[] | undefined).trim();
    const endDateRaw = safeParamString(req.query.endDate as string | string[] | undefined).trim();

    const departmentId = departmentIdRaw ? parseInt(departmentIdRaw, 10) : undefined;
    const courseId = courseIdRaw ? parseInt(courseIdRaw, 10) : undefined;
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    const payload = await buildTimeReportData({
      usercode: usercode || undefined,
      departmentId: departmentId && !isNaN(departmentId) ? departmentId : undefined,
      courseId: courseId && !isNaN(courseId) ? courseId : undefined,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('getLearningTimeReport error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const exportLearningTimeReportExcel = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    await ensureReportTables();

    const usercode = safeParamString(req.query.usercode as string | string[] | undefined).trim();
    const departmentIdRaw = safeParamString(req.query.departmentId as string | string[] | undefined).trim();
    const courseIdRaw = safeParamString(req.query.courseId as string | string[] | undefined).trim();
    const startDateRaw = safeParamString(req.query.startDate as string | string[] | undefined).trim();
    const endDateRaw = safeParamString(req.query.endDate as string | string[] | undefined).trim();

    const departmentId = departmentIdRaw ? parseInt(departmentIdRaw, 10) : undefined;
    const courseId = courseIdRaw ? parseInt(courseIdRaw, 10) : undefined;
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    const payload = await buildTimeReportData({
      usercode: usercode || undefined,
      departmentId: departmentId && !isNaN(departmentId) ? departmentId : undefined,
      courseId: courseId && !isNaN(courseId) ? courseId : undefined,
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Tong-hop');
    const detailSheet = workbook.addWorksheet('Du-lieu');

    summarySheet.columns = [
      { header: 'Chi so', key: 'metric', width: 35 },
      { header: 'Gia tri', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Tong hoc vien', value: payload.summary.totalLearners },
      { metric: 'Tong khoa hoc (khong trung)', value: payload.summary.totalCourses },
      { metric: 'Ty le hoan thanh (%)', value: payload.summary.completionRate },
      { metric: 'So gio hoc', value: payload.summary.totalStudyHours },
    ]);

    detailSheet.columns = [
      { header: 'Ma so', key: 'usercode', width: 15 },
      { header: 'Ho ten', key: 'fullName', width: 26 },
      { header: 'Chuc vu', key: 'position', width: 20 },
      { header: 'Bo phan', key: 'department', width: 20 },
      { header: 'Khoa hoc', key: 'courseName', width: 28 },
      { header: 'Ngay deadline', key: 'deadline', width: 18 },
      { header: 'Ngay con lai', key: 'daysRemaining', width: 14 },
      { header: 'Gio da hoc', key: 'studyHours', width: 12 },
      { header: '% tien trinh', key: 'progressPercent', width: 12 },
      { header: 'Trang thai', key: 'status', width: 16 },
    ];

    detailSheet.addRows(
      payload.rows.map((row) => ({
        usercode: row.usercode,
        fullName: row.fullName,
        position: row.position,
        department: row.department,
        courseName: row.courseName,
        deadline: row.deadline ? new Date(row.deadline).toISOString().slice(0, 10) : '',
        daysRemaining: row.daysRemaining ?? '',
        studyHours: row.studyHours,
        progressPercent: row.progressPercent,
        status: statusLabel(row.status),
      }))
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `learning-time-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('exportLearningTimeReportExcel error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const getLearningTimeReportDetail = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    await ensureReportTables();

    const userId = parseInt(safeParamString(req.query.userId as string | string[] | undefined), 10);
    const courseId = parseInt(safeParamString(req.query.courseId as string | string[] | undefined), 10);
    const planIdRaw = safeParamString(req.query.planId as string | string[] | undefined).trim();
    const planId = planIdRaw ? parseInt(planIdRaw, 10) : undefined;

    if (isNaN(userId) || isNaN(courseId)) {
      res.status(400).json({ message: 'userId and courseId are required' });
      return;
    }

    const [course, user, lessons, lessonProgressRows] = await Promise.all([
      prisma.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title_vi: true,
          title_en: true,
          title_zh: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          usercode: true,
          fullName: true,
          department: {
            select: {
              name_vi: true,
              code: true,
            },
          },
        },
      }),
      prisma.lesson.findMany({
        where: { courseId },
        select: {
          id: true,
          title: true,
          order: true,
          video: {
            select: {
              name: true,
              duration: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      }),
      prisma.learningProgress.findMany({
        where: {
          userId,
          lesson: { courseId },
        },
        select: {
          lessonId: true,
          completed: true,
          watchedSeconds: true,
          updatedAt: true,
          lesson: {
            select: {
              video: {
                select: {
                  duration: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!course || !user) {
      res.status(404).json({ message: 'User or course not found' });
      return;
    }

    const lessonProgressMap = new Map(
      lessonProgressRows.map((row) => [row.lessonId, row])
    );

    const videoItems = lessons.map((lesson) => {
      const progress = lessonProgressMap.get(lesson.id);
      const duration = Number(lesson.video?.duration || progress?.lesson.video?.duration || 0);
      const watched = Number(progress?.watchedSeconds || 0);
      const percent = progress?.completed
        ? 100
        : duration > 0
          ? Number((Math.min(watched, duration) / duration * 100).toFixed(2))
          : 0;

      return {
        key: `video-${lesson.id}`,
        type: 'VIDEO',
        content: lesson.video?.name || lesson.title || `Video ${lesson.order}`,
        progressPercent: percent,
        completed: progress?.completed === true,
        completedAt: progress?.completed ? progress.updatedAt?.toISOString() || null : null,
      };
    });

    let planResources: Array<{ id: number; type: string; refId: number; title_vi: string | null; title_en: string | null; title_zh: string | null; trainingPlanId: number }> = [];

    if (planId && !isNaN(planId)) {
      planResources = await prisma.trainingResource.findMany({
        where: { trainingPlanId: planId },
        select: {
          id: true,
          type: true,
          refId: true,
          title_vi: true,
          title_en: true,
          title_zh: true,
          trainingPlanId: true,
        },
        orderBy: { order: 'asc' },
      });
    } else {
      const userClassEnrollments = await prisma.classEnrollment.findMany({
        where: { userId },
        select: { classId: true },
      });

      const classIds = userClassEnrollments.map((enrollment) => enrollment.classId);
      if (classIds.length) {
        const relatedPlans = await prisma.trainingPlan.findMany({
          where: {
            trainingClassId: { in: classIds },
            resources: {
              some: {
                type: 'COURSE',
                refId: courseId,
              },
            },
          },
          select: { id: true },
        });

        const planIds = relatedPlans.map((plan) => plan.id);
        if (planIds.length) {
          planResources = await prisma.trainingResource.findMany({
            where: { trainingPlanId: { in: planIds } },
            select: {
              id: true,
              type: true,
              refId: true,
              title_vi: true,
              title_en: true,
              title_zh: true,
              trainingPlanId: true,
            },
            orderBy: [{ trainingPlanId: 'asc' }, { order: 'asc' }],
          });
        }
      }
    }

    const resourceIds = planResources.map((resource) => resource.id);
    const examIds = planResources.filter((resource) => resource.type === 'EXAM').map((resource) => resource.refId);
    const planCourseIds = Array.from(
      new Set(planResources.filter((resource) => resource.type === 'COURSE').map((resource) => resource.refId))
    );

    const [planCourseLessonRows, planCourseProgressRows] = planCourseIds.length
      ? await Promise.all([
          prisma.lesson.findMany({
            where: { courseId: { in: planCourseIds } },
            select: {
              id: true,
              courseId: true,
            },
          }),
          prisma.learningProgress.findMany({
            where: {
              userId,
              lesson: {
                courseId: { in: planCourseIds },
              },
            },
            select: {
              lessonId: true,
              completed: true,
              lesson: {
                select: {
                  courseId: true,
                },
              },
            },
          }),
        ])
      : [[], []];

    const examSessions = examIds.length
      ? await prisma.examSession.findMany({
          where: { id: { in: Array.from(new Set(examIds)) } },
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
          },
        })
      : [];

    const examNameMap = new Map<number, string>(
      examSessions.map((session) => [
        session.id,
        session.name_vi || session.name_en || session.name_zh || `Ky thi ${session.id}`,
      ])
    );

    const [resourceProgressRows, examAttemptRows]: [
      Array<{ training_resource_id: number; completed: boolean; completed_at: Date | null }>,
      Array<{ exam_session_id: number; submitted_at: Date | null; status: string }>
    ] = await Promise.all([
      resourceIds.length
        ? prisma.$queryRawUnsafe<Array<{ training_resource_id: number; completed: boolean; completed_at: Date | null }>>(
            `
              SELECT training_resource_id, completed, completed_at
              FROM training_resource_progress
              WHERE user_id = $1
                AND training_resource_id IN (${resourceIds.join(',')})
            `,
            userId
          )
        : Promise.resolve<Array<{ training_resource_id: number; completed: boolean; completed_at: Date | null }>>([]),
      examIds.length
        ? prisma.$queryRawUnsafe<Array<{ exam_session_id: number; submitted_at: Date | null; status: string }>>(
            `
              SELECT exam_session_id, submitted_at, status
              FROM exam_attempts
              WHERE user_id = $1
                AND exam_session_id IN (${examIds.join(',')})
                ${planId && !isNaN(planId) ? 'AND training_plan_id = $2' : ''}
            `,
            ...(planId && !isNaN(planId) ? [userId, planId] : [userId])
          )
        : Promise.resolve<Array<{ exam_session_id: number; submitted_at: Date | null; status: string }>>([]),
    ]);

    const resourceProgressMap = new Map<number, { training_resource_id: number; completed: boolean; completed_at: Date | null }>(
      resourceProgressRows.map(
        (row): [number, { training_resource_id: number; completed: boolean; completed_at: Date | null }] => [
          row.training_resource_id,
          row,
        ]
      )
    );

    const examAttemptMap = new Map<number, { completed: boolean; submittedAt: Date | null }>();
    examAttemptRows.forEach((row) => {
      const current = examAttemptMap.get(row.exam_session_id);
      const completed = Boolean(row.submitted_at) || row.status !== 'ONGOING';
      if (!current || (row.submitted_at && (!current.submittedAt || row.submitted_at > current.submittedAt))) {
        examAttemptMap.set(row.exam_session_id, {
          completed,
          submittedAt: row.submitted_at,
        });
      }
    });

    const totalLessonsByPlanCourse = new Map<number, number>();
    planCourseLessonRows.forEach((lesson) => {
      totalLessonsByPlanCourse.set(lesson.courseId, (totalLessonsByPlanCourse.get(lesson.courseId) || 0) + 1);
    });

    const completedLessonsByPlanCourse = new Map<number, number>();
    planCourseProgressRows.forEach((progress) => {
      if (!progress.completed) return;
      const courseKey = progress.lesson.courseId;
      completedLessonsByPlanCourse.set(courseKey, (completedLessonsByPlanCourse.get(courseKey) || 0) + 1);
    });

    const extraItems = planResources
      .filter((resource) => resource.type === 'DOCUMENT' || resource.type === 'EXAM')
      .map((resource) => {
        if (resource.type === 'DOCUMENT') {
          const progress = resourceProgressMap.get(resource.id);
          return {
            key: `document-${resource.id}`,
            type: 'DOCUMENT',
            content: resource.title_vi || resource.title_en || resource.title_zh || `Tai lieu ${resource.id}`,
            progressPercent: progress?.completed ? 100 : 0,
            completed: progress?.completed === true,
            completedAt: progress?.completed_at ? progress.completed_at.toISOString() : null,
          };
        }

        const exam = examAttemptMap.get(resource.refId);
        return {
          key: `exam-${resource.id}`,
          type: 'EXAM',
          content:
            resource.title_vi ||
            resource.title_en ||
            resource.title_zh ||
            examNameMap.get(resource.refId) ||
            `Ky thi ${resource.refId}`,
          progressPercent: exam?.completed ? 100 : 0,
          completed: exam?.completed === true,
          completedAt: exam?.submittedAt ? exam.submittedAt.toISOString() : null,
        };
      });

    const items = [...videoItems, ...extraItems];

    const completedItems = items.filter((item) => item.completed).length;
    const examItems = items.filter((item) => item.type === 'EXAM');
    const completedExams = examItems.filter((item) => item.completed).length;
    const cardTotalItems = items.length;
    const cardCompletedItems = completedItems;
    const cardTotalExams = examItems.length;
    const cardCompletedExams = completedExams;
    const progressPercent = cardTotalItems > 0 ? Number(((cardCompletedItems / cardTotalItems) * 100).toFixed(2)) : 0;

    const watchedSeconds = lessonProgressRows.reduce((sum, row) => sum + Number(row.watchedSeconds || 0), 0);
    const studyHours = Number((watchedSeconds / 3600).toFixed(2));

    const totalVideos = lessons.length;
    const completedVideos = videoItems.filter((item) => item.completed).length;

    const payload = {
      user: {
        id: user.id,
        usercode: user.usercode,
        fullName: user.fullName || '',
        department: user.department?.name_vi || user.department?.code || '-',
      },
      course: {
        id: course.id,
        name: getCourseTitle(course),
      },
      cards: {
        contentCompleted: {
          percent: progressPercent,
          completed: cardCompletedItems,
          total: cardTotalItems,
        },
        examCompleted: {
          completed: cardCompletedExams,
          total: cardTotalExams,
        },
        completionPercent: progressPercent,
        learningProgressPercent: progressPercent,
        status: toStatus(progressPercent, studyHours, null),
        videoCompleted: {
          completed: completedVideos,
          total: totalVideos,
        },
      },
      items,
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error('getLearningTimeReportDetail error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
