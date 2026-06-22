import { Request, Response } from "express";
import { prisma } from "../../config/db";

// Helper to parse ID safely
function parseId(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const str = Array.isArray(value) ? value[0] : value;
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

/**
 * Get lesson progress for current user
 */
export const getLessonProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const lessonId = parseId(req.params.lessonId);
    const userId = (req as any).user?.id;

    if (!lessonId || !userId) {
      res.status(400).json({
        success: false,
        message: "Invalid lesson ID or user not authenticated",
      });
      return;
    }

    const progress = await prisma.learningProgress.findFirst({
      where: { userId, lessonId },
      include: {
        lesson: {
          include: {
            video: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get lesson progress error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get progress",
    });
  }
};

/**
 * Get course progress for current user
 */
export const getCourseProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.courseId);
    const userId = (req as any).user?.id;

    if (!courseId || !userId) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID or user not authenticated",
      });
      return;
    }

    // Get all lessons for this course
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      include: {
        video: true,
        progresses: {
          where: { userId },
        },
      },
      orderBy: { order: "asc" },
    });

    const totalVideos = lessons.length;
    const completedVideos = lessons.filter(
      (l) => l.progresses.length > 0 && l.progresses[0].completed
    ).length;

    // Get last watched video
    const lastProgress = await prisma.learningProgress.findFirst({
      where: {
        userId,
        lesson: { courseId },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      success: true,
      data: {
        courseId,
        totalVideos,
        completedVideos,
        progressPercent: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
        lastWatchedVideoId: lastProgress?.lessonId || null,
        lastWatchedSeconds: lastProgress?.watchedSeconds || 0,
        updatedAt: lastProgress?.updatedAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get course progress error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get progress",
    });
  }
};

/**
 * Get all progress for current user
 */
export const getMyProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const progresses = await prisma.learningProgress.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            video: true,
            course: {
              select: {
                id: true,
                title_vi: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      success: true,
      data: progresses,
    });
  } catch (error) {
    console.error("Get my progress error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get progress",
    });
  }
};

/**
 * Update progress for a lesson
 */
export const updateProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId, watchedSeconds, completed } = req.body;
    const userId = (req as any).user?.id;

    if (!lessonId || !userId) {
      res.status(400).json({
        success: false,
        message: "Lesson ID and authentication required",
      });
      return;
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    // Check if progress exists
    const existingProgress = await prisma.learningProgress.findFirst({
      where: { userId, lessonId },
    });

    let progress;
    if (existingProgress) {
      // Update existing
      progress = await prisma.learningProgress.update({
        where: { id: existingProgress.id },
        data: {
          watchedSeconds: watchedSeconds ?? existingProgress.watchedSeconds,
          completed: completed ?? existingProgress.completed,
        },
        include: {
          lesson: {
            include: {
              video: true,
            },
          },
        },
      });
    } else {
      // Create new
      progress = await prisma.learningProgress.create({
        data: {
          userId,
          lessonId,
          watchedSeconds: watchedSeconds || 0,
          completed: completed || false,
        },
        include: {
          lesson: {
            include: {
              video: true,
            },
          },
        },
      });
    }

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Update progress error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update progress",
    });
  }
};

/**
 * Mark lesson as completed
 */
export const markLessonCompleted = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.body;
    const userId = (req as any).user?.id;

    if (!lessonId || !userId) {
      res.status(400).json({
        success: false,
        message: "Lesson ID and authentication required",
      });
      return;
    }

    // Get video duration to determine completion
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { video: true },
    });

    if (!lesson) {
      res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
      return;
    }

    // Check if progress exists
    const existingProgress = await prisma.learningProgress.findFirst({
      where: { userId, lessonId },
    });

    let progress;
    if (existingProgress) {
      progress = await prisma.learningProgress.update({
        where: { id: existingProgress.id },
        data: {
          watchedSeconds: lesson.video?.duration || 0,
          completed: true,
        },
        include: {
          lesson: {
            include: {
              video: true,
            },
          },
        },
      });
    } else {
      progress = await prisma.learningProgress.create({
        data: {
          userId,
          lessonId,
          watchedSeconds: lesson.video?.duration || 0,
          completed: true,
        },
        include: {
          lesson: {
            include: {
              video: true,
            },
          },
        },
      });
    }

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Mark completed error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to mark completed",
    });
  }
};

/**
 * Get academy courses with progress for profile
 */
export const getMyAcademyCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Get user's academy enrollments
    const enrollments = await prisma.academyEnrollment.findMany({
      where: { userId },
      select: { academyId: true },
    });

    const academyIds = enrollments.map((e) => e.academyId);

    // Get courses from those academies
    const courses = await prisma.course.findMany({
      where: {
        academyId: { in: academyIds },
      },
      include: {
        academy: true,
        courseVideos: {
          include: {
            video: true,
          },
        },
        lessons: {
          include: {
            progresses: {
              where: { userId },
            },
          },
        },
      },
    });

    // Add progress info to each course
    const coursesWithProgress = courses.map((course) => {
      const totalVideos = course.courseVideos.length;
      const completedVideos = course.lessons.filter(
        (l) => l.progresses.length > 0 && l.progresses[0].completed
      ).length;

      return {
        ...course,
        totalVideos,
        completedVideos,
        progressPercent: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
      };
    });

    res.json({
      success: true,
      data: coursesWithProgress,
    });
  } catch (error) {
    console.error("Get academy courses error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get courses",
    });
  }
};
