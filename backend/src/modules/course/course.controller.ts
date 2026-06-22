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
 * Get all courses
 */
export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        academy: true,
        category: true,
        instructor: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
        courseVideos: {
          include: {
            video: true,
          },
          orderBy: { order: "asc" },
        },
        rule: true,
      },
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get courses",
    });
  }
};

/**
 * Get course by ID
 */
export const getCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);

    if (courseId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        academy: true,
        category: true,
        instructor: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
        courseVideos: {
          include: {
            video: true,
          },
          orderBy: { order: "asc" },
        },
        rule: true,
        lessons: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get course",
    });
  }
};

/**
 * Create course
 */
export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title_vi,
      title_en,
      title_zh,
      description_vi,
      description_en,
      description_zh,
      coverImage,
      isPublic,
      rating,
      language,
      targetAudience,
      benefits,
      tags,
      academyId,
      categoryId,
      instructorId,
      // Course rule fields
      antiFastForward,
      lockSpeed1x,
      showWatermark,
      blockDownload,
      requireFullCompletion,
    } = req.body;

    if (!title_vi) {
      res.status(400).json({
        success: false,
        message: "Title (VN) is required",
      });
      return;
    }

    // Create course with optional rule
    const course = await prisma.course.create({
      data: {
        title_vi,
        title_en,
        title_zh,
        description_vi,
        description_en,
        description_zh,
        coverImage,
        isPublic: isPublic || false,
        rating: rating || 0,
        language,
        targetAudience,
        benefits: benefits ? JSON.stringify(benefits) : undefined,
        tags: tags ? JSON.stringify(tags) : undefined,
        academyId: academyId || null,
        categoryId: categoryId || null,
        instructorId: instructorId || null,
        rule: antiFastForward || lockSpeed1x || showWatermark || blockDownload || requireFullCompletion
          ? {
              create: {
                antiFastForward: antiFastForward || false,
                lockSpeed1x: lockSpeed1x || false,
                showWatermark: showWatermark || false,
                blockDownload: blockDownload || false,
                requireFullCompletion: requireFullCompletion || false,
              },
            }
          : undefined,
      },
      include: {
        academy: true,
        category: true,
        instructor: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
        rule: true,
      },
    });

    res.status(201).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create course",
    });
  }
};

/**
 * Update course
 */
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);

    if (courseId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const {
      title_vi,
      title_en,
      title_zh,
      description_vi,
      description_en,
      description_zh,
      coverImage,
      isPublic,
      rating,
      language,
      targetAudience,
      benefits,
      tags,
      academyId,
      categoryId,
      instructorId,
      // Course rule fields
      antiFastForward,
      lockSpeed1x,
      showWatermark,
      blockDownload,
      requireFullCompletion,
    } = req.body;

    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: { rule: true },
    });

    if (!existingCourse) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    // Build update data
    const updateData: any = {
      title_vi,
      title_en,
      title_zh,
      description_vi,
      description_en,
      description_zh,
      coverImage,
      isPublic,
      rating,
      language,
      targetAudience,
      benefits: benefits ? JSON.stringify(benefits) : undefined,
      tags: tags ? JSON.stringify(tags) : undefined,
      academyId: academyId !== undefined ? academyId : undefined,
      categoryId: categoryId !== undefined ? categoryId : undefined,
      instructorId: instructorId !== undefined ? instructorId : undefined,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update or delete rule
    const hasRuleUpdate =
      antiFastForward !== undefined ||
      lockSpeed1x !== undefined ||
      showWatermark !== undefined ||
      blockDownload !== undefined ||
      requireFullCompletion !== undefined;

    if (hasRuleUpdate) {
      if (existingCourse.rule) {
        // Update existing rule
        await prisma.courseRule.update({
          where: { id: existingCourse.rule.id },
          data: {
            antiFastForward: antiFastForward ?? existingCourse.rule.antiFastForward,
            lockSpeed1x: lockSpeed1x ?? existingCourse.rule.lockSpeed1x,
            showWatermark: showWatermark ?? existingCourse.rule.showWatermark,
            blockDownload: blockDownload ?? existingCourse.rule.blockDownload,
            requireFullCompletion: requireFullCompletion ?? existingCourse.rule.requireFullCompletion,
          },
        });
      } else if (
        antiFastForward ||
        lockSpeed1x ||
        showWatermark ||
        blockDownload ||
        requireFullCompletion
      ) {
        // Create new rule
        await prisma.courseRule.create({
          data: {
            courseId: courseId,
            antiFastForward: antiFastForward || false,
            lockSpeed1x: lockSpeed1x || false,
            showWatermark: showWatermark || false,
            blockDownload: blockDownload || false,
            requireFullCompletion: requireFullCompletion || false,
          },
        });
      }
    }

    const course = await prisma.course.update({
      where: { id: courseId },
      data: updateData,
      include: {
        academy: true,
        category: true,
        instructor: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
        rule: true,
      },
    });

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update course",
    });
  }
};

/**
 * Delete course
 */
export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);

    if (courseId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    // Delete course (rule will be cascade deleted)
    await prisma.course.delete({
      where: { id: courseId },
    });

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete course",
    });
  }
};

// ===== Course Categories =====

/**
 * Get all course categories
 */
export const getCourseCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get course categories error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get course categories",
    });
  }
};

/**
 * Create course category
 */
export const createCourseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name_vi, name_en, name_zh, code, description } = req.body;

    if (!name_vi) {
      res.status(400).json({
        success: false,
        message: "Name (VN) is required",
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        success: false,
        message: "Code is required",
      });
      return;
    }

    const category = await prisma.courseCategory.create({
      data: {
        name_vi,
        name_en,
        name_zh,
        code,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Create course category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create course category",
    });
  }
};

/**
 * Update course category
 */
export const updateCourseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseId(req.params.id);

    if (categoryId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const { name_vi, name_en, name_zh, code, description } = req.body;

    const category = await prisma.courseCategory.update({
      where: { id: categoryId },
      data: {
        name_vi,
        name_en,
        name_zh,
        code,
        description,
      },
    });

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Update course category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update course category",
    });
  }
};

/**
 * Delete course category
 */
export const deleteCourseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseId(req.params.id);

    if (categoryId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    await prisma.courseCategory.delete({
      where: { id: categoryId },
    });

    res.json({
      success: true,
      message: "Course category deleted successfully",
    });
  } catch (error) {
    console.error("Delete course category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete course category",
    });
  }
};

// ===== Course Videos =====

/**
 * Add video to course
 */
export const addVideoToCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);
    const { videoId, order } = req.body;

    if (courseId === null || !videoId) {
      res.status(400).json({
        success: false,
        message: "Course ID and Video ID are required",
      });
      return;
    }

    const courseVideo = await prisma.courseVideo.create({
      data: {
        courseId,
        videoId,
        order: order || 0,
      },
      include: {
        video: true,
      },
    });

    res.status(201).json({
      success: true,
      data: courseVideo,
    });
  } catch (error) {
    console.error("Add video to course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add video to course",
    });
  }
};

/**
 * Remove video from course
 */
export const removeVideoFromCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);
    const { videoId } = req.body;

    if (courseId === null || !videoId) {
      res.status(400).json({
        success: false,
        message: "Course ID and Video ID are required",
      });
      return;
    }

    await prisma.courseVideo.delete({
      where: {
        courseId_videoId: {
          courseId,
          videoId,
        },
      },
    });

    res.json({
      success: true,
      message: "Video removed from course successfully",
    });
  } catch (error) {
    console.error("Remove video from course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove video from course",
    });
  }
};

// ===== Lessons (kept for backward compatibility) =====

/**
 * Get all lessons
 */
export const getLessons = async (req: Request, res: Response): Promise<void> => {
  try {
    const lessons = await prisma.lesson.findMany({
      include: {
        course: true,
      },
      orderBy: [{ courseId: "asc" }, { order: "asc" }],
    });

    res.json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get lessons",
    });
  }
};

/**
 * Get lessons by course ID
 */
export const getLessonsByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.courseId);

    if (courseId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      include: {
        course: true,
      },
      orderBy: { order: "asc" },
    });

    res.json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    console.error("Get lessons by course error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get lessons",
    });
  }
};
