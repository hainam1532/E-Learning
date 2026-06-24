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

// Get all course videos for this course
    const courseVideos = await prisma.courseVideo.findMany({
      where: { courseId },
      include: {
        video: true,
      },
      orderBy: { order: "asc" },
    });

    // Get lessons for this course to check progress (lesson links to video)
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

const totalVideos = courseVideos.length;
    // Count completed lessons (progress tracked via lessons) and get their IDs
    const completedLessonsData = lessons.filter(
      (l) => l.progresses.length > 0 && l.progresses[0].completed
    );
    const completedVideos = completedLessonsData.length;
    const completedLessons = completedLessonsData.map(l => l.id);

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
        completedLessons: completedLessons, // Array of completed lesson IDs
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

    // Use upsert to handle race condition - atomic operation
    const progress = await prisma.learningProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        watchedSeconds: watchedSeconds || 0,
        completed: completed || false,
      },
      update: {
        watchedSeconds: watchedSeconds ?? null,
        completed: completed ?? null,
      },
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

    // Use upsert to handle race condition - atomic operation
    const progress = await prisma.learningProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        watchedSeconds: lesson.video?.duration || 0,
        completed: true,
      },
      update: {
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

/**
 * Get learning statistics for current user (courses completed, in progress, time stats)
 */
export const getMyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate start and end of current month
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Prepare last 6 months data
    const monthlyDurationByMonth: { month: string; duration: number }[] = [];
    const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const yearOffset = currentMonth - i < 0 ? -1 : 0;
      const year = currentYear + yearOffset;
      const monthStr = `${year}-${monthNames[monthIndex]}`;
      
      monthlyDurationByMonth.push({
        month: monthStr,
        duration: 0,
      });
    }

// === GET ALL COURSES FROM MULTIPLE SOURCES ===

    // Source 1: From class enrollments
    const classEnrollments = await prisma.classEnrollment.findMany({
      where: { userId },
      select: { classId: true },
    });
    const classIds = classEnrollments.map(e => e.classId);

    // Get training plans from enrolled classes
    const trainingPlansFromClasses = await prisma.trainingPlan.findMany({
      where: {
        trainingClassId: { in: classIds },
      },
      select: {
        id: true,
        resources: {
          where: { type: 'COURSE' },
          select: {
            id: true,
            refId: true,
          },
        },
      },
    });

    // Source 2: From academy enrollments - GET COURSES DIRECTLY like getMyAcademyCourses
    const academyEnrollments = await prisma.academyEnrollment.findMany({
      where: { userId },
      select: { academyId: true },
    });
    const academyIds = academyEnrollments.map(e => e.academyId);

    // Get ALL courses from enrolled academies
    const coursesFromAcademies = await prisma.course.findMany({
      where: {
        academyId: { in: academyIds },
      },
      select: { id: true },
    });
    const courseIdsFromAcademies = coursesFromAcademies.map(c => c.id);

    // Also get training plans from academies
    const trainingPlansFromAcademies = await prisma.trainingPlan.findMany({
      where: {
        academyId: { in: academyIds },
      },
      select: {
        id: true,
        resources: {
          where: { type: 'COURSE' },
          select: {
            id: true,
            refId: true,
          },
        },
      },
    });

    // Extract all course IDs from training plans
    const courseIdsFromPlans: number[] = [];
    for (const plan of trainingPlansFromClasses) {
      for (const resource of plan.resources) {
        if (resource.refId) {
          courseIdsFromPlans.push(resource.refId);
        }
      }
    }
    for (const plan of trainingPlansFromAcademies) {
      for (const resource of plan.resources) {
        if (resource.refId) {
          courseIdsFromPlans.push(resource.refId);
        }
      }
    }

    // Get all progress entries
    const allProgress = await prisma.learningProgress.findMany({
      where: { userId },
      select: {
        id: true,
        lessonId: true,
        watchedSeconds: true,
        completed: true,
        updatedAt: true,
        lesson: {
          select: {
            courseId: true,
          },
        },
      },
    });

    // Get unique courses the user has watched (from progress)
    const courseIdsWatched = [...new Set(allProgress.map(p => p.lesson.courseId))];

    // Combine: courses from plans + courses from academies + courses with progress
    const allCourseIds = [...new Set([...courseIdsFromPlans, ...courseIdsFromAcademies, ...courseIdsWatched])];

    // Get total videos per course
    const coursesWithVideos = await prisma.course.findMany({
      where: { id: { in: allCourseIds } },
      select: {
        id: true,
        courseVideos: {
          select: { id: true },
        },
      },
    });

    const totalVideosPerCourse = new Map(coursesWithVideos.map(c => [c.id, c.courseVideos.length]));

    // Calculate courses completed (100%) and in progress (< 100%)
    let coursesCompleted = 0;
    let coursesInProgress = 0;

    for (const courseId of allCourseIds) {
      const totalVideos = totalVideosPerCourse.get(courseId) || 0;
      const completedInCourse = allProgress.filter(
        p => p.lesson.courseId === courseId && p.completed
      ).length;

      if (totalVideos > 0) {
        const percent = (completedInCourse / totalVideos) * 100;
        if (percent >= 100) {
          coursesCompleted++;
        } else if (percent > 0) {
          coursesInProgress++;
        }
      }
    }

// Calculate total watching time (all time)
    const totalDuration = allProgress.reduce((sum, p) => sum + (p.watchedSeconds || 0), 0);

    // Calculate current month's watching time using same logic as monthly calculation
    const monthlyDuration = allProgress
      .filter(p => {
        const progressDate = new Date(p.updatedAt);
        return progressDate.getMonth() === currentMonth && progressDate.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + (p.watchedSeconds || 0), 0);

// Calculate duration for each of the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const yearOffset = currentMonth - i < 0 ? -1 : 0;
      const year = currentYear + yearOffset;
      const monthStr = `${year}-${monthNames[monthIndex]}`;
      
      // Filter progress entries that belong to this month
      const monthDuration = allProgress
        .filter(p => {
          const progressDate = new Date(p.updatedAt);
          return progressDate.getMonth() === monthIndex && progressDate.getFullYear() === year;
        })
        .reduce((sum, p) => sum + (p.watchedSeconds || 0), 0);
      
      // Find the matching month entry and update it
      const monthEntry = monthlyDurationByMonth.find(m => m.month === monthStr);
      if (monthEntry) {
        monthEntry.duration = Math.round(monthDuration);
      }
    }

    res.json({
      success: true,
      data: {
        monthlyDuration: Math.round(monthlyDuration), // Keep in seconds for frontend formatting
        totalDuration: Math.round(totalDuration), // Keep in seconds for frontend formatting
        coursesCompleted,
        coursesInProgress,
        totalCourses: allCourseIds.length,
        monthlyDurationByMonth, // Array of last 6 months with duration in seconds
      },
    });
  } catch (error) {
    console.error("Get my stats error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get stats",
    });
  }
};

/**
 * Get watch history for current user
 */
export const getWatchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

// Get all progress entries with lesson, video, and course details
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
                title_en: true,
                title_zh: true,
                coverImage: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50, // Limit to 50 most recent
    });

// Format the response with additional info
    const history = progresses.map((progress) => {
      const video = progress.lesson.video;
      const course = progress.lesson.course;
      const lesson = progress.lesson;
      
      // Get videoId from the joined video object
      const videoId = video?.id || null;
      
      // Calculate progress percentage
      const videoDuration = video?.duration || 0;
      const progressPercent = videoDuration > 0 
        ? Math.round((progress.watchedSeconds / videoDuration) * 100) 
        : 0;

// Fallback: use lesson title as video name when video object is null
      const videoName = video?.name || lesson.title || null;

      return {
        id: progress.id,
        lessonId: progress.lessonId,
        lessonTitle: lesson.title,
        videoId: videoId,
        watchedSeconds: progress.watchedSeconds,
        completed: progress.completed,
        updatedAt: progress.updatedAt,
        progressPercent,
        video: video ? {
          id: video.id,
          name: video.name,
          duration: video.duration,
          thumbnailUrl: video.thumbnailUrl,
        } : null,
        course: course ? {
          id: course.id,
          title_vi: course.title_vi,
          title_en: course.title_en,
          title_zh: course.title_zh,
          coverImage: course.coverImage,
        } : null,
      };
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get watch history error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get history",
    });
  }
};

/**
 * Toggle like on a video (like/unlike)
 */
export const toggleVideoLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.body;
    const userId = (req as any).user?.id;

    if (!videoId || !userId) {
      res.status(400).json({ success: false, message: "Video ID and authentication required" });
      return;
    }

    const existing = await prisma.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });

    if (existing) {
      await prisma.videoLike.delete({ where: { id: existing.id } });
      const likeCount = await prisma.videoLike.count({ where: { videoId } });
      res.json({ success: true, liked: false, likeCount });
    } else {
      await prisma.videoLike.create({ data: { userId, videoId } });
      const likeCount = await prisma.videoLike.count({ where: { videoId } });
      res.json({ success: true, liked: true, likeCount });
    }
  } catch (error) {
    console.error("Toggle video like error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to toggle like",
    });
  }
};

/**
 * Get like status for a specific video
 */
export const getVideoLikeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.videoId);
    const userId = (req as any).user?.id;

    if (!videoId || !userId) {
      res.status(400).json({ success: false, message: "Invalid video ID or not authenticated" });
      return;
    }

    const like = await prisma.videoLike.findUnique({
      where: { userId_videoId: { userId, videoId } },
    });
    const likeCount = await prisma.videoLike.count({ where: { videoId } });

    res.json({ success: true, liked: !!like, likeCount });
  } catch (error) {
    console.error("Get video like status error:", error);
    res.status(500).json({ success: false, message: "Failed to get like status" });
  }
};

/**
 * Get all liked videos for current user (for profile favorites tab)
 */
export const getMyLikedVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: "User not authenticated" });
      return;
    }

    const likes = await prisma.videoLike.findMany({
      where: { userId },
      include: {
        video: {
          include: {
            ownedByLessons: {
              include: {
                course: {
                  select: {
                    id: true,
                    title_vi: true,
                    title_en: true,
                    title_zh: true,
                    coverImage: true,
                  },
                },
              },
              take: 1,
            },
            courseVideos: {
              include: {
                course: {
                  select: {
                    id: true,
                    title_vi: true,
                    title_en: true,
                    title_zh: true,
                    coverImage: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = likes.map((like) => {
      const video = like.video;
      // Get course from lesson (LessonOwnsVideo) or from courseVideos
      const course =
        video.ownedByLessons[0]?.course ||
        video.courseVideos[0]?.course ||
        null;
      const lessonId = video.ownedByLessons[0]?.id || null;
      const courseId = course?.id || null;

      return {
        likeId: like.id,
        likedAt: like.createdAt,
        videoId: video.id,
        videoName: video.name,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        lessonId,
        courseId,
        course,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Get liked videos error:", error);
    res.status(500).json({ success: false, message: "Failed to get liked videos" });
  }
};
