import { Request, Response } from "express";
import { prisma } from "../../config/db";
import multer from "multer";
import * as path from "path";
import { randomUUID } from "crypto";

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
    const academyId = req.query.academyId ? parseInt(req.query.academyId as string) : null;

    // Build where clause
    const where: any = {};
    if (academyId && !isNaN(academyId)) {
      where.academyId = academyId;
    }

    const courses = await prisma.course.findMany({
      where,
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
 * Get featured public courses sorted by popularity
 * Popularity = enrollments count (desc), then rating (desc)
 */
export const getFeaturedCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const academyId = req.query.academyId ? parseInt(req.query.academyId as string) : null;

    const where: any = {
      isPublic: true,
    };

    if (academyId && !isNaN(academyId)) {
      where.academyId = academyId;
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        academy: true,
        category: true,
        courseVideos: {
          include: {
            video: {
              select: {
                _count: {
                  select: { likes: true },
                },
              },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: [
        { enrollments: { _count: "desc" } },
        { rating: "desc" },
        { id: "desc" },
      ],
    });

    const coursesWithLikes = courses.map((course) => ({
      ...course,
      likeCount: course.courseVideos.reduce((total, courseVideo) => {
        return total + (courseVideo.video?._count?.likes || 0);
      }, 0),
    }));

    res.json({
      success: true,
      data: coursesWithLikes,
    });
  } catch (error) {
    console.error("Get featured courses error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get featured courses",
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
          include: {
            video: true,
          },
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

    // Use Prisma transaction to ensure all queries run on the same connection
    // This prevents the deprecation warning about concurrent queries
    const course = await prisma.$transaction(async (tx) => {
      // Check if course exists
      const existingCourse = await tx.course.findUnique({
        where: { id: courseId },
        include: { rule: true },
      });

      if (!existingCourse) {
        throw new Error("Course not found");
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
          await tx.courseRule.update({
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
          await tx.courseRule.create({
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

      // Update the course
      return await tx.course.update({
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
    });

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    // Handle not found error specifically
    if (error instanceof Error && error.message === "Course not found") {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }
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

    // First, delete all related records that have foreign keys to this course
    // 1. Delete course videos (must be done first due to FK constraint)
    await prisma.courseVideo.deleteMany({
      where: { courseId },
    });

    // 2. Delete enrollments
    await prisma.enrollment.deleteMany({
      where: { courseId },
    });

    // 3. Delete lessons (which will also delete related learning progress)
    const lessons = await prisma.lesson.findMany({
      where: { courseId },
      select: { id: true },
    });
    if (lessons.length > 0) {
      const lessonIds = lessons.map((l) => l.id);
      await prisma.learningProgress.deleteMany({
        where: { lessonId: { in: lessonIds } },
      });
      await prisma.lesson.deleteMany({
        where: { courseId },
      });
    }

    // 4. Delete course rule
    await prisma.courseRule.deleteMany({
      where: { courseId },
    });

    // 5. Finally delete the course
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
 * Optional filter by academyId
 */
export const getCourseCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const academyId = req.query.academyId ? parseInt(req.query.academyId as string) : null;
    const rawParentId = req.query.parentId as string | undefined;

    const where: any = {};
    if (academyId && !isNaN(academyId)) {
      where.academyId = academyId;
    }
    if (rawParentId !== undefined) {
      if (rawParentId === "" || rawParentId === "null") {
        where.parentId = null;
      } else {
        const parsedParentId = parseInt(rawParentId, 10);
        if (isNaN(parsedParentId)) {
          res.status(400).json({
            success: false,
            message: "Invalid parent ID",
          });
          return;
        }
        where.parentId = parsedParentId;
      }
    }

    const categories = await prisma.courseCategory.findMany({
      where,
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        parent: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        children: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        _count: {
          select: { courses: true, children: true },
        },
      },
      orderBy: [{ name_vi: "asc" }, { id: "asc" }],
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
 * Requires: academyId, code
 * Optional: name_vi, name_en, name_zh, description, parentId (for sub-category)
 */
export const createCourseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name_vi, name_en, name_zh, code, description, academyId, parentId } = req.body;
    const normalizedAcademyId = Number(academyId);

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

    if (!academyId) {
      res.status(400).json({
        success: false,
        message: "Academy ID is required",
      });
      return;
    }

    if (!Number.isInteger(normalizedAcademyId) || normalizedAcademyId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid academy ID",
      });
      return;
    }

    const academy = await prisma.academy.findUnique({
      where: { id: normalizedAcademyId },
      select: { id: true },
    });

    if (!academy) {
      res.status(400).json({
        success: false,
        message: "Academy not found",
      });
      return;
    }

    const normalizedParentId = parentId !== undefined && parentId !== null && parentId !== ""
      ? Number(parentId)
      : null;

    if (normalizedParentId !== null && (!Number.isInteger(normalizedParentId) || normalizedParentId <= 0)) {
      res.status(400).json({
        success: false,
        message: "Invalid parent category ID",
      });
      return;
    }

    // Validate parentId belongs to the same academy if provided
    if (normalizedParentId !== null) {
      const parentCategory = await prisma.courseCategory.findUnique({
        where: { id: normalizedParentId },
      });
      if (!parentCategory) {
        res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
        return;
      }
      if (parentCategory.academyId !== normalizedAcademyId) {
        res.status(400).json({
          success: false,
          message: "Parent category must belong to the same academy",
        });
        return;
      }
    }

    const category = await prisma.courseCategory.create({
      data: {
        name_vi,
        name_en,
        name_zh,
        code,
        description,
        academyId: normalizedAcademyId,
        parentId: normalizedParentId,
      },
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        parent: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
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

    const { name_vi, name_en, name_zh, code, description, parentId } = req.body;

    // Check if category exists
    const existingCategory = await prisma.courseCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    let normalizedParentId: number | null | undefined = undefined;

    // Validate parentId if provided (can't be self or create cycle)
    if (parentId !== undefined) {
      if (parentId === null || parentId === "") {
        normalizedParentId = null;
      } else {
        const parsedParentId = Number(parentId);

        if (!Number.isInteger(parsedParentId) || parsedParentId <= 0) {
          res.status(400).json({
            success: false,
            message: "Invalid parent category ID",
          });
          return;
        }

        if (parsedParentId === categoryId) {
          res.status(400).json({
            success: false,
            message: "Category cannot be its own parent",
          });
          return;
        }

        // Check if parent exists
        const parentCategory = await prisma.courseCategory.findUnique({
          where: { id: parsedParentId },
          select: { id: true, academyId: true, parentId: true },
        });

        if (!parentCategory) {
          res.status(400).json({
            success: false,
            message: "Parent category not found",
          });
          return;
        }

        // Check if parent belongs to same academy
        if (parentCategory.academyId !== existingCategory.academyId) {
          res.status(400).json({
            success: false,
            message: "Parent category must belong to the same academy",
          });
          return;
        }

        // Prevent cycles by traversing parent chain
        let currentParentId: number | null = parentCategory.parentId;
        while (currentParentId !== null) {
          if (currentParentId === categoryId) {
            res.status(400).json({
              success: false,
              message: "Invalid parent category: circular hierarchy detected",
            });
            return;
          }

          const ancestor = await prisma.courseCategory.findUnique({
            where: { id: currentParentId },
            select: { parentId: true },
          });

          if (!ancestor) {
            break;
          }

          currentParentId = ancestor.parentId;
        }

        normalizedParentId = parsedParentId;
      }
    }

    const category = await prisma.courseCategory.update({
      where: { id: categoryId },
      data: {
        name_vi,
        name_en,
        name_zh,
        code,
        description,
        parentId: normalizedParentId,
      },
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        parent: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        children: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
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

    // Check if category has children
    const childCategories = await prisma.courseCategory.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });

    if (childCategories.length > 0) {
      res.status(400).json({
        success: false,
        message: "Cannot delete category with sub-categories. Please delete sub-categories first.",
      });
      return;
    }

    // Check if category has courses
    const coursesCount = await prisma.course.count({
      where: { categoryId },
    });

    if (coursesCount > 0) {
      res.status(400).json({
        success: false,
        message: "Cannot delete category with courses. Please remove courses from this category first.",
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

/**
 * Get courses by category ID
 */
export const getCoursesByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseId(req.params.categoryId);

    if (categoryId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const courses = await prisma.course.findMany({
      where: { categoryId },
      include: {
        academy: {
          select: { id: true, name_vi: true },
        },
        category: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true },
        },
        instructor: {
          select: { id: true, fullName: true },
        },
        _count: {
          select: { enrollments: true, lessons: true },
        },
      },
      orderBy: { title_vi: "asc" },
    });

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error("Get courses by category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get courses by category",
    });
  }
};

/**
 * Add course to category
 */
export const addCourseToCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseId(req.params.categoryId);
    const { courseId } = req.body;
    const parsedCourseId = Number(courseId);

    if (categoryId === null || !Number.isInteger(parsedCourseId) || parsedCourseId <= 0) {
      res.status(400).json({
        success: false,
        message: "Category ID and Course ID are required",
      });
      return;
    }

    // Check if category exists
    const category = await prisma.courseCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { id: true, academyId: true, categoryId: true },
    });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    // Ensure course and category belong to the same academy
    if (course.academyId !== category.academyId) {
      res.status(400).json({
        success: false,
        message: "Course must belong to the same academy as the category",
      });
      return;
    }

    // Update course with category
    const updatedCourse = await prisma.course.update({
      where: { id: parsedCourseId },
      data: { categoryId },
      include: {
        academy: true,
        category: true,
        instructor: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({
      success: true,
      data: updatedCourse,
    });
  } catch (error) {
    console.error("Add course to category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add course to category",
    });
  }
};

/**
 * Remove course from category
 */
export const removeCourseFromCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = parseId(req.params.categoryId);
    const { courseId } = req.body;
    const parsedCourseId = Number(courseId);

    if (categoryId === null || !Number.isInteger(parsedCourseId) || parsedCourseId <= 0) {
      res.status(400).json({
        success: false,
        message: "Category ID and Course ID are required",
      });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { id: true, categoryId: true },
    });

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found",
      });
      return;
    }

    if (course.categoryId !== categoryId) {
      res.status(400).json({
        success: false,
        message: "Course does not belong to this category",
      });
      return;
    }

    // Update course to remove category
    const updatedCourse = await prisma.course.update({
      where: { id: parsedCourseId },
      data: { categoryId: null },
      include: {
        academy: true,
        category: true,
      },
    });

    res.json({
      success: true,
      data: updatedCourse,
    });
  } catch (error) {
    console.error("Remove course from category error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove course from category",
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

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

    // Get max order for course videos to auto-increment
    const lastCourseVideo = await prisma.courseVideo.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
    });
    const newOrder = order ?? (lastCourseVideo ? lastCourseVideo.order + 1 : 0);

    const courseVideo = await prisma.courseVideo.create({
      data: {
        courseId,
        videoId,
        order: newOrder,
      },
      include: {
        video: true,
      },
    });

    // Auto-create a Lesson record for progress tracking
    const lessonTitle = video.name || `Video ${newOrder + 1}`;
    const lesson = await prisma.lesson.create({
      data: {
        title: lessonTitle,
        order: newOrder,
        courseId,
        videoId: videoId,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...courseVideo,
        lessonId: lesson.id,
      },
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

// ===== Course Cover Image Upload =====

const storageCover = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const uuid = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `cover_${uuid}${ext}`);
  },
});

export const coverMiddleware = multer({
  storage: storageCover,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only image files are allowed."));
    }
  },
});

export const uploadCover = async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = parseId(req.params.id);
    const file = req.file;

    if (courseId === null) {
      res.status(400).json({ success: false, message: "Invalid course ID" });
      return;
    }
    if (!file) {
      res.status(400).json({ success: false, message: "No cover file provided" });
      return;
    }

    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existingCourse) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    const minio = await import("minio");
    let minioClient: any;
    try {
      minioClient = new minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || "localhost",
        port: parseInt(process.env.MINIO_PORT || "9000"),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
      });
    } catch (e) {
      const { minioClient: client } = await import("../../config/minio");
      minioClient = client;
    }

    const THUMBNAIL_BUCKET = "elearning-pictures";
    const bucketExists = await minioClient.bucketExists(THUMBNAIL_BUCKET);
    if (!bucketExists) {
      await minioClient.makeBucket(THUMBNAIL_BUCKET, "us-east-1");
      
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${THUMBNAIL_BUCKET}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(THUMBNAIL_BUCKET, JSON.stringify(policy));
    }

    const objectName = `covers/${courseId}_${Date.now()}${path.extname(file.originalname)}`;
    await minioClient.fPutObject(THUMBNAIL_BUCKET, objectName, file.path, {
      "Content-Type": file.mimetype,
    });

    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const port = process.env.MINIO_PORT || "9000";
    const coverImage = `http://${endpoint}:${port}/${THUMBNAIL_BUCKET}/${objectName}`;

    await prisma.course.update({
      where: { id: courseId },
      data: { coverImage },
    });

    const fs = await import("fs");
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Cover uploaded successfully",
      data: { coverImage },
    });
  } catch (error) {
    console.error("Upload cover error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
};

// ===== Special Topics =====

interface SpecialTopicRow {
  id: number;
  name_vi: string;
  name_en: string | null;
  name_zh: string | null;
  page: string;
  academy_id: number;
  order_index: number;
  created_at: Date;
  updated_at: Date;
  academy_name_vi: string | null;
  academy_name_en: string | null;
  academy_name_zh: string | null;
  courses_count: number;
}

const ensureSpecialTopicTables = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS special_topics (
      id SERIAL PRIMARY KEY,
      name_vi TEXT NOT NULL,
      name_en TEXT,
      name_zh TEXT,
      page TEXT NOT NULL DEFAULT 'home',
      academy_id INTEGER NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE special_topics
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS special_topic_courses (
      topic_id INTEGER NOT NULL REFERENCES special_topics(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (topic_id, course_id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE special_topic_courses
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_special_topics_academy_page
    ON special_topics (academy_id, page);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_special_topics_order
    ON special_topics (academy_id, page, order_index);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_special_topic_courses_order
    ON special_topic_courses (topic_id, order_index);
  `);
};

const mapSpecialTopic = (row: SpecialTopicRow) => ({
  id: Number(row.id),
  name_vi: row.name_vi,
  name_en: row.name_en,
  name_zh: row.name_zh,
  page: row.page,
  academyId: Number(row.academy_id),
  orderIndex: Number(row.order_index || 0),
  academy: {
    id: Number(row.academy_id),
    name_vi: row.academy_name_vi,
    name_en: row.academy_name_en,
    name_zh: row.academy_name_zh,
  },
  _count: {
    courses: Number(row.courses_count || 0),
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getTopicById = async (topicId: number): Promise<any | null> => {
  const rows = await prisma.$queryRawUnsafe<SpecialTopicRow[]>(
    `
      SELECT
        st.id,
        st.name_vi,
        st.name_en,
        st.name_zh,
        st.page,
        st.academy_id,
        st.order_index,
        st.created_at,
        st.updated_at,
        a.name_vi AS academy_name_vi,
        a.name_en AS academy_name_en,
        a.name_zh AS academy_name_zh,
        (
          SELECT COUNT(*)::int
          FROM special_topic_courses stc
          WHERE stc.topic_id = st.id
        ) AS courses_count
      FROM special_topics st
      JOIN academies a ON a.id = st.academy_id
      WHERE st.id = $1
      LIMIT 1
    `,
    topicId
  );

  if (!rows.length) return null;
  return mapSpecialTopic(rows[0]);
};

const syncTopicCourses = async (topicId: number, academyId: number, courseIds: number[]): Promise<void> => {
  const normalizedCourseIds = [...new Set(courseIds.filter((id) => Number.isInteger(id) && id > 0))];

  await prisma.$executeRawUnsafe(`DELETE FROM special_topic_courses WHERE topic_id = $1`, topicId);

  if (!normalizedCourseIds.length) {
    return;
  }

  const validCourses = await prisma.course.findMany({
    where: {
      id: { in: normalizedCourseIds },
      academyId,
    },
    select: { id: true },
  });

  if (validCourses.length !== normalizedCourseIds.length) {
    throw new Error("Some courses do not belong to selected academy");
  }

  const valuesSql = normalizedCourseIds
    .map((courseId, index) => `(${topicId}, ${courseId}, ${index + 1})`)
    .join(",");

  await prisma.$executeRawUnsafe(
    `INSERT INTO special_topic_courses (topic_id, course_id, order_index) VALUES ${valuesSql} ON CONFLICT (topic_id, course_id) DO UPDATE SET order_index = EXCLUDED.order_index`
  );
};

export const getSpecialTopics = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const academyId = req.query.academyId ? Number(req.query.academyId) : null;
    const page = (req.query.page as string) || "home";
    const search = ((req.query.search as string) || "").trim();

    const where: string[] = [];
    const params: any[] = [];

    if (academyId && Number.isInteger(academyId)) {
      params.push(academyId);
      where.push(`st.academy_id = $${params.length}`);
    }

    if (page) {
      params.push(page);
      where.push(`st.page = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(st.name_vi ILIKE $${params.length} OR st.name_en ILIKE $${params.length} OR st.name_zh ILIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe<SpecialTopicRow[]>(
      `
        SELECT
          st.id,
          st.name_vi,
          st.name_en,
          st.name_zh,
          st.page,
          st.academy_id,
          st.order_index,
          st.created_at,
          st.updated_at,
          a.name_vi AS academy_name_vi,
          a.name_en AS academy_name_en,
          a.name_zh AS academy_name_zh,
          (
            SELECT COUNT(*)::int
            FROM special_topic_courses stc
            WHERE stc.topic_id = st.id
          ) AS courses_count
        FROM special_topics st
        JOIN academies a ON a.id = st.academy_id
        ${whereSql}
        ORDER BY st.order_index ASC, st.id DESC
      `,
      ...params
    );

    res.json({
      success: true,
      data: rows.map(mapSpecialTopic),
    });
  } catch (error) {
    console.error("Get special topics error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get special topics",
    });
  }
};

export const createSpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const { name_vi, name_en, name_zh, academyId, page, courseIds } = req.body;

    if (!name_vi) {
      res.status(400).json({ success: false, message: "Name (VN) is required" });
      return;
    }

    const parsedAcademyId = Number(academyId);
    if (!Number.isInteger(parsedAcademyId) || parsedAcademyId <= 0) {
      res.status(400).json({ success: false, message: "Academy ID is required" });
      return;
    }

    const academy = await prisma.academy.findUnique({ where: { id: parsedAcademyId }, select: { id: true } });
    if (!academy) {
      res.status(400).json({ success: false, message: "Academy not found" });
      return;
    }

    const nextOrderRows = await prisma.$queryRawUnsafe<{ next_order: number }[]>(
      `
        SELECT COALESCE(MAX(order_index), 0)::int + 1 AS next_order
        FROM special_topics
        WHERE academy_id = $1 AND page = $2
      `,
      parsedAcademyId,
      page || "home"
    );

    const nextOrder = Number(nextOrderRows[0]?.next_order || 1);

    const insertRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `
        INSERT INTO special_topics (name_vi, name_en, name_zh, page, academy_id, order_index)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      name_vi,
      name_en || null,
      name_zh || null,
      page || "home",
      parsedAcademyId,
      nextOrder
    );

    const topicId = Number(insertRows[0]?.id);

    if (Array.isArray(courseIds)) {
      try {
        await syncTopicCourses(topicId, parsedAcademyId, courseIds.map((id: any) => Number(id)));
      } catch (syncError) {
        await prisma.$executeRawUnsafe(`DELETE FROM special_topics WHERE id = $1`, topicId);
        throw syncError;
      }
    }

    const topic = await getTopicById(topicId);

    res.status(201).json({
      success: true,
      data: topic,
    });
  } catch (error) {
    console.error("Create special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create special topic",
    });
  }
};

export const updateSpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.id);
    if (!topicId) {
      res.status(400).json({ success: false, message: "Invalid topic ID" });
      return;
    }

    const existing = await getTopicById(topicId);
    if (!existing) {
      res.status(404).json({ success: false, message: "Special topic not found" });
      return;
    }

    const { name_vi, name_en, name_zh, page, courseIds } = req.body;

    await prisma.$executeRawUnsafe(
      `
        UPDATE special_topics
        SET
          name_vi = COALESCE($2, name_vi),
          name_en = COALESCE($3, name_en),
          name_zh = COALESCE($4, name_zh),
          page = COALESCE($5, page),
          updated_at = NOW()
        WHERE id = $1
      `,
      topicId,
      name_vi ?? null,
      name_en ?? null,
      name_zh ?? null,
      page ?? null
    );

    if (Array.isArray(courseIds)) {
      await syncTopicCourses(topicId, existing.academyId, courseIds.map((id: any) => Number(id)));
    }

    const topic = await getTopicById(topicId);

    res.json({ success: true, data: topic });
  } catch (error) {
    console.error("Update special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update special topic",
    });
  }
};

export const deleteSpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.id);
    if (!topicId) {
      res.status(400).json({ success: false, message: "Invalid topic ID" });
      return;
    }

    await prisma.$executeRawUnsafe(`DELETE FROM special_topics WHERE id = $1`, topicId);

    res.json({ success: true, message: "Special topic deleted successfully" });
  } catch (error) {
    console.error("Delete special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete special topic",
    });
  }
};

export const getCoursesBySpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.topicId);
    if (!topicId) {
      res.status(400).json({ success: false, message: "Invalid topic ID" });
      return;
    }

    const rows = await prisma.$queryRawUnsafe<{ course_id: number }[]>(
      `SELECT course_id FROM special_topic_courses WHERE topic_id = $1 ORDER BY order_index ASC, created_at ASC`,
      topicId
    );

    const courseIds = rows.map((row) => Number(row.course_id));

    if (!courseIds.length) {
      res.json({ success: true, data: [] });
      return;
    }

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      include: {
        academy: { select: { id: true, name_vi: true, name_en: true, name_zh: true } },
        courseVideos: {
          include: {
            video: {
              select: {
                _count: {
                  select: { likes: true },
                },
              },
            },
          },
        },
      },
    });

    const sorted = courseIds.reduce<any[]>((acc, id) => {
      const course = courses.find((item) => item.id === id);
      if (!course) return acc;

      acc.push({
        ...course,
        likeCount: course.courseVideos.reduce((total, courseVideo) => {
          return total + (courseVideo.video?._count?.likes || 0);
        }, 0),
      });

      return acc;
    }, []);

    res.json({ success: true, data: sorted });
  } catch (error) {
    console.error("Get courses by special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get courses by special topic",
    });
  }
};

export const addCourseToSpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.topicId);
    const courseId = Number(req.body.courseId);

    if (!topicId || !Number.isInteger(courseId) || courseId <= 0) {
      res.status(400).json({ success: false, message: "Topic ID and Course ID are required" });
      return;
    }

    const topic = await getTopicById(topicId);
    if (!topic) {
      res.status(404).json({ success: false, message: "Special topic not found" });
      return;
    }

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, academyId: true } });
    if (!course) {
      res.status(404).json({ success: false, message: "Course not found" });
      return;
    }

    if (course.academyId !== topic.academyId) {
      res.status(400).json({ success: false, message: "Course must belong to the same academy as topic" });
      return;
    }

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO special_topic_courses (topic_id, course_id, order_index)
        VALUES (
          $1,
          $2,
          (SELECT COALESCE(MAX(order_index), 0) + 1 FROM special_topic_courses WHERE topic_id = $1)
        )
        ON CONFLICT (topic_id, course_id) DO NOTHING
      `,
      topicId,
      courseId
    );

    res.json({ success: true, message: "Course added to special topic" });
  } catch (error) {
    console.error("Add course to special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add course to special topic",
    });
  }
};

export const removeCourseFromSpecialTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.topicId);
    const courseId = Number(req.body.courseId);

    if (!topicId || !Number.isInteger(courseId) || courseId <= 0) {
      res.status(400).json({ success: false, message: "Topic ID and Course ID are required" });
      return;
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM special_topic_courses WHERE topic_id = $1 AND course_id = $2`,
      topicId,
      courseId
    );

    res.json({ success: true, message: "Course removed from special topic" });
  } catch (error) {
    console.error("Remove course from special topic error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove course from special topic",
    });
  }
};

export const getHomeSpecialTopics = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const academyId = req.query.academyId ? Number(req.query.academyId) : null;
    const page = (req.query.page as string) || "home";

    const where: string[] = [];
    const params: any[] = [];

    if (academyId && Number.isInteger(academyId)) {
      params.push(academyId);
      where.push(`st.academy_id = $${params.length}`);
    }

    params.push(page);
    where.push(`st.page = $${params.length}`);

    const rows = await prisma.$queryRawUnsafe<SpecialTopicRow[]>(
      `
        SELECT
          st.id,
          st.name_vi,
          st.name_en,
          st.name_zh,
          st.page,
          st.academy_id,
          st.order_index,
          st.created_at,
          st.updated_at,
          a.name_vi AS academy_name_vi,
          a.name_en AS academy_name_en,
          a.name_zh AS academy_name_zh,
          (
            SELECT COUNT(*)::int
            FROM special_topic_courses stc
            WHERE stc.topic_id = st.id
          ) AS courses_count
        FROM special_topics st
        JOIN academies a ON a.id = st.academy_id
        WHERE ${where.join(" AND ")}
        ORDER BY st.order_index ASC, st.id DESC
      `,
      ...params
    );

    const topics = await Promise.all(
      rows.map(async (row) => {
        const courseIdRows = await prisma.$queryRawUnsafe<{ course_id: number }[]>(
          `SELECT course_id FROM special_topic_courses WHERE topic_id = $1 ORDER BY order_index ASC, created_at ASC`,
          Number(row.id)
        );

        const courseIds = courseIdRows.map((item) => Number(item.course_id));

        let courses: any[] = [];
        if (courseIds.length) {
          const dbCourses = await prisma.course.findMany({
            where: { id: { in: courseIds } },
            include: {
              academy: { select: { id: true, name_vi: true, name_en: true, name_zh: true } },
              courseVideos: {
                include: {
                  video: {
                    select: {
                      _count: {
                        select: { likes: true },
                      },
                    },
                  },
                },
              },
            },
          });
          courses = courseIds.reduce<any[]>((acc, id) => {
            const course = dbCourses.find((item) => item.id === id);
            if (!course) return acc;

            acc.push({
              ...course,
              likeCount: course.courseVideos.reduce((total, courseVideo) => {
                return total + (courseVideo.video?._count?.likes || 0);
              }, 0),
            });

            return acc;
          }, []);
        }

        return {
          ...mapSpecialTopic(row),
          courses,
        };
      })
    );

    res.json({ success: true, data: topics });
  } catch (error) {
    console.error("Get home special topics error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get home special topics",
    });
  }
};

export const reorderSpecialTopics = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const { topicIds } = req.body as { topicIds?: number[] };
    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      res.status(400).json({ success: false, message: "topicIds is required" });
      return;
    }

    const normalizedIds = topicIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
    if (normalizedIds.length !== topicIds.length) {
      res.status(400).json({ success: false, message: "Invalid topic IDs" });
      return;
    }

    const placeholders = normalizedIds.map((_, index) => `$${index + 1}`).join(",");
    const existing = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM special_topics WHERE id IN (${placeholders})`,
      ...normalizedIds
    );

    if (existing.length !== normalizedIds.length) {
      res.status(400).json({ success: false, message: "Some topics do not exist" });
      return;
    }

    for (let i = 0; i < normalizedIds.length; i += 1) {
      await prisma.$executeRawUnsafe(
        `UPDATE special_topics SET order_index = $2, updated_at = NOW() WHERE id = $1`,
        normalizedIds[i],
        i + 1
      );
    }

    res.json({ success: true, message: "Special topics reordered successfully" });
  } catch (error) {
    console.error("Reorder special topics error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reorder special topics",
    });
  }
};

export const reorderSpecialTopicCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureSpecialTopicTables();

    const topicId = parseId(req.params.topicId);
    const { courseIds } = req.body as { courseIds?: number[] };

    if (!topicId) {
      res.status(400).json({ success: false, message: "Invalid topic ID" });
      return;
    }

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      res.status(400).json({ success: false, message: "courseIds is required" });
      return;
    }

    const normalizedIds = courseIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
    if (normalizedIds.length !== courseIds.length) {
      res.status(400).json({ success: false, message: "Invalid course IDs" });
      return;
    }

    const placeholders = normalizedIds.map((_, index) => `$${index + 2}`).join(",");
    const existing = await prisma.$queryRawUnsafe<{ course_id: number }[]>(
      `SELECT course_id FROM special_topic_courses WHERE topic_id = $1 AND course_id IN (${placeholders})`,
      topicId,
      ...normalizedIds
    );

    if (existing.length !== normalizedIds.length) {
      res.status(400).json({ success: false, message: "Some courses are not in this topic" });
      return;
    }

    for (let i = 0; i < normalizedIds.length; i += 1) {
      await prisma.$executeRawUnsafe(
        `UPDATE special_topic_courses SET order_index = $3 WHERE topic_id = $1 AND course_id = $2`,
        topicId,
        normalizedIds[i],
        i + 1
      );
    }

    res.json({ success: true, message: "Courses reordered successfully" });
  } catch (error) {
    console.error("Reorder special topic courses error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reorder courses",
    });
  }
};

// ===== Course Tags =====

/**
 * Get all course tags
 */
export const getCourseTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const tags = await prisma.courseTag.findMany({
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error("Get course tags error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get course tags",
    });
  }
};

/**
 * Create course tag
 */
export const createCourseTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name_vi, name_en, name_zh } = req.body;

    if (!name_vi) {
      res.status(400).json({
        success: false,
        message: "Name (VN) is required",
      });
      return;
    }

    const tag = await prisma.courseTag.create({
      data: {
        name_vi,
        name_en,
        name_zh,
      },
    });

    res.status(201).json({
      success: true,
      data: [tag],
    });
  } catch (error) {
    console.error("Create course tag error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create course tag",
    });
  }
};

/**
 * Update course tag
 */
export const updateCourseTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const tagId = parseId(req.params.id);

    if (tagId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid tag ID",
      });
      return;
    }

    const { name_vi, name_en, name_zh } = req.body;

    const tag = await prisma.courseTag.update({
      where: { id: tagId },
      data: {
        name_vi,
        name_en,
        name_zh,
      },
    });

    res.json({
      success: true,
      data: [tag],
    });
  } catch (error) {
    console.error("Update course tag error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update course tag",
    });
  }
};

/**
 * Delete course tag
 */
export const deleteCourseTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const tagId = parseId(req.params.id);

    if (tagId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid tag ID",
      });
      return;
    }

    await prisma.courseTag.delete({
      where: { id: tagId },
    });

    res.json({
      success: true,
      message: "Course tag deleted successfully",
    });
  } catch (error) {
    console.error("Delete course tag error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete course tag",
    });
  }
};
