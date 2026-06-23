import { Request, Response } from 'express';
import { prisma } from '../../config/db';
import multer from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';

const storageCover = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const uuid = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `plan_cover_${uuid}${ext}`);
  },
});

export const coverMiddleware = multer({
  storage: storageCover,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'));
    }
  },
});


// Use string literals for enum types
type TrainingPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type TrainingResourceType = 'COURSE' | 'EXAM' | 'DOCUMENT';

// Helper to safely extract string from body
const safeBodyString = (val: any): string | undefined => {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  return String(val);
};

// Helper to safely extract param string
const safeParamString = (val: string | string[] | undefined): string => {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
};

// ============ TRAINING CLASS MANAGEMENT ============

// Get all training classes
export const getTrainingClasses = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    const academyId = req.query.academyId ? parseInt(String(req.query.academyId)) : undefined;
    const search = req.query.search as string | undefined;
    
    const where: any = {};
    if (academyId) {
      where.academyId = academyId;
    }
    if (search) {
      where.OR = [
        { name_vi: { contains: search, mode: 'insensitive' } },
        { name_en: { contains: search, mode: 'insensitive' } },
        { name_zh: { contains: search, mode: 'insensitive' } },
      ];
    }

    const trainingClasses = await prisma.trainingClass.findMany({
      where,
      include: {
        academy: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
lecturer: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ success: true, data: trainingClasses });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create training class
export const createTrainingClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const name_vi = safeBodyString(req.body.name_vi);
    const name_en = safeBodyString(req.body.name_en);
    const name_zh = safeBodyString(req.body.name_zh);
    const code = safeBodyString(req.body.code);
    const description = safeBodyString(req.body.description);
    const academyId = req.body.academyId ? parseInt(String(req.body.academyId)) : null;

    if (!name_vi || !code) {
      res.status(400).json({ message: 'name_vi and code are required' });
      return;
    }

    // Check duplicate code
    const existing = await prisma.trainingClass.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ message: 'Training class code already exists' });
      return;
    }

    const trainingClass = await prisma.trainingClass.create({
      data: { name_vi, name_en, name_zh, code, description, academyId },
    });

    res.status(201).json({ message: 'Training class created successfully', trainingClass });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update training class
export const updateTrainingClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const name_vi = safeBodyString(req.body.name_vi);
    const name_en = safeBodyString(req.body.name_en);
    const name_zh = safeBodyString(req.body.name_zh);
    const description = safeBodyString(req.body.description);
    const academyId = req.body.academyId !== undefined 
      ? (req.body.academyId ? parseInt(String(req.body.academyId)) : null)
      : undefined;

    const trainingClass = await prisma.trainingClass.update({
      where: { id },
      data: { name_vi, name_en, name_zh, description, academyId },
    });

    res.status(200).json({ message: 'Training class updated successfully', trainingClass });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete training class
export const deleteTrainingClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    await prisma.trainingClass.delete({ where: { id } });

    res.status(200).json({ message: 'Training class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ TRAINING PLAN MANAGEMENT ============

// Get all training plans
export const getTrainingPlans = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    const academyId = req.query.academyId ? parseInt(String(req.query.academyId)) : undefined;
    const search = req.query.search as string | undefined;
    
    const where: any = {};
    
    if (academyId) {
      where.academyId = academyId;
    }
    
    if (search) {
      where.OR = [
        { title_vi: { contains: search, mode: 'insensitive' } },
        { title_en: { contains: search, mode: 'insensitive' } },
        { title_zh: { contains: search, mode: 'insensitive' } },
      ];
    }

    const trainingPlans = await prisma.trainingPlan.findMany({
      where,
      include: {
        academy: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        trainingClass: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        resources: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, data: trainingPlans });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get single training plan
export const getTrainingPlan = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    if (isNaN(id)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const trainingPlan = await prisma.trainingPlan.findUnique({
      where: { id },
      include: {
        academy: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        trainingClass: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        resources: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!trainingPlan) {
      res.status(404).json({ success: false, message: 'Training plan not found' });
      return;
    }

    res.status(200).json({ success: true, data: trainingPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create training plan
export const createTrainingPlan = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const title_vi = safeBodyString(req.body.title_vi);
    const title_en = safeBodyString(req.body.title_en);
    const title_zh = safeBodyString(req.body.title_zh);
    const description_vi = safeBodyString(req.body.description_vi);
    const description_en = safeBodyString(req.body.description_en);
    const description_zh = safeBodyString(req.body.description_zh);
    const coverImage = safeBodyString(req.body.coverImage);
    const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    const status = req.body.status as TrainingPlanStatus || 'DRAFT';
    const academyId = req.body.academyId ? parseInt(String(req.body.academyId)) : null;
    const trainingClassId = req.body.trainingClassId ? parseInt(String(req.body.trainingClassId)) : null;

const trainingPlan = await prisma.trainingPlan.create({
      data: {
        title_vi,
        title_en,
        title_zh,
        description_vi,
        description_en,
        description_zh,
        coverImage,
        startDate,
        endDate,
        status,
        academyId,
        trainingClassId,
      },
    });

    res.status(201).json({ success: true, data: trainingPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update training plan
export const updateTrainingPlan = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const title_vi = safeBodyString(req.body.title_vi);
    const title_en = safeBodyString(req.body.title_en);
    const title_zh = safeBodyString(req.body.title_zh);
    const description_vi = safeBodyString(req.body.description_vi);
    const description_en = safeBodyString(req.body.description_en);
    const description_zh = safeBodyString(req.body.description_zh);
    const coverImage = safeBodyString(req.body.coverImage);
    const startDate = req.body.startDate !== undefined 
      ? (req.body.startDate ? new Date(req.body.startDate) : null)
      : undefined;
    const endDate = req.body.endDate !== undefined 
      ? (req.body.endDate ? new Date(req.body.endDate) : null)
      : undefined;
    const status = req.body.status as TrainingPlanStatus;
    const academyId = req.body.academyId !== undefined 
      ? (req.body.academyId ? parseInt(String(req.body.academyId)) : null)
      : undefined;
    const trainingClassId = req.body.trainingClassId !== undefined 
      ? (req.body.trainingClassId ? parseInt(String(req.body.trainingClassId)) : null)
      : undefined;

    // Check if exists
    const existing = await prisma.trainingPlan.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Training plan not found' });
      return;
    }

const trainingPlan = await prisma.trainingPlan.update({
      where: { id },
      data: {
        title_vi,
        title_en,
        title_zh,
        description_vi,
        description_en,
        description_zh,
        coverImage,
        startDate,
        endDate,
        status,
        academyId,
        trainingClassId,
      },
    });

    res.status(200).json({ success: true, data: trainingPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete training plan
export const deleteTrainingPlan = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    // Delete resources first
    await prisma.trainingResource.deleteMany({ where: { trainingPlanId: id } });

    // Then delete plan
    await prisma.trainingPlan.delete({ where: { id } });

    res.status(200).json({ message: 'Training plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Upload cover image
export const uploadTrainingPlanCover = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const file = req.file;

    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid plan ID' });
      return;
    }

    if (!file) {
      res.status(400).json({ message: 'No cover file provided' });
      return;
    }

    const existingPlan = await prisma.trainingPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      res.status(404).json({ message: 'Training plan not found' });
      return;
    }

    const minio = await import('minio');
    let minioClient: any;
    try {
      minioClient = new minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      });
    } catch (e) {
      const { minioClient: client } = await import('../../config/minio');
      minioClient = client;
    }

    const THUMBNAIL_BUCKET = 'elearning-pictures';
    const bucketExists = await minioClient.bucketExists(THUMBNAIL_BUCKET);
    if (!bucketExists) {
      await minioClient.makeBucket(THUMBNAIL_BUCKET, 'us-east-1');
      
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${THUMBNAIL_BUCKET}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(THUMBNAIL_BUCKET, JSON.stringify(policy));
    }

    const objectName = `plans/covers/${id}_${Date.now()}${path.extname(file.originalname)}`;
    await minioClient.fPutObject(THUMBNAIL_BUCKET, objectName, file.path, {
      'Content-Type': file.mimetype,
    });

    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const coverImage = `http://${endpoint}:${port}/${THUMBNAIL_BUCKET}/${objectName}`;

    await prisma.trainingPlan.update({
      where: { id },
      data: { coverImage },
    });

    const fs = await import('fs');
    fs.unlinkSync(file.path);

    res.status(200).json({
      success: true,
      message: 'Cover image uploaded successfully',
      data: { coverImage },
    });
  } catch (error) {
    console.error('Upload cover error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ TRAINING RESOURCE MANAGEMENT ============

// Add resource to training plan
export const addTrainingResource = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const trainingPlanId = parseInt(safeParamString(req.params.id));
    const type = req.body.type as TrainingResourceType;
    const refId = req.body.refId ? parseInt(String(req.body.refId)) : null;
    const title_vi = safeBodyString(req.body.title_vi);
    const title_en = safeBodyString(req.body.title_en);
    const title_zh = safeBodyString(req.body.title_zh);
    const order = req.body.order ? parseInt(String(req.body.order)) : 0;

    if (!trainingPlanId || !type || !refId) {
      res.status(400).json({ message: 'trainingPlanId, type, and refId are required' });
      return;
    }

    // Check if training plan exists
    const plan = await prisma.trainingPlan.findUnique({ where: { id: trainingPlanId } });
    if (!plan) {
      res.status(404).json({ message: 'Training plan not found' });
      return;
    }

    // Check if resource already exists for this plan
    const existingResource = await prisma.trainingResource.findFirst({
      where: { trainingPlanId, type, refId },
    });
    if (existingResource) {
      res.status(400).json({ message: 'Resource already exists in this plan' });
      return;
    }

    const resource = await prisma.trainingResource.create({
      data: {
        trainingPlanId,
        type,
        refId,
        title_vi,
        title_en,
        title_zh,
        order,
      },
    });

    res.status(201).json({ message: 'Resource added successfully', resource });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Resource already exists in this plan' });
      return;
    }
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Remove resource from training plan
export const removeTrainingResource = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const trainingPlanId = parseInt(safeParamString(req.params.id));
    const resourceId = req.body.resourceId ? parseInt(String(req.body.resourceId)) : null;

    if (!trainingPlanId || !resourceId) {
      res.status(400).json({ message: 'trainingPlanId and resourceId are required' });
      return;
    }

    await prisma.trainingResource.deleteMany({
      where: { id: resourceId, trainingPlanId },
    });

    res.status(200).json({ message: 'Resource removed successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ TRAINING CLASS ENROLLMENT MANAGEMENT ============

// Get current user's training enrollments (which classes is user enrolled in)
export const getMyTrainingEnrollments = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    const userId = req.user.id;

    // Get user's class enrollments
    const enrollments = await prisma.classEnrollment.findMany({
      where: { userId },
      include: {
        class: {
          include: {
            academy: {
              select: {
                id: true,
                name_vi: true,
                name_en: true,
                name_zh: true,
                code: true,
              },
            },
            lecturer: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: enrollments });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get current user's training plans (plans linked to classes user is enrolled in)
export const getMyTrainingPlans = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    const userId = req.user.id;

    // Get user's class enrollments first
    const enrollments = await prisma.classEnrollment.findMany({
      where: { userId },
      select: { classId: true },
    });

    const classIds = enrollments.map((e) => e.classId);

// Get training plans linked to those classes
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: {
        trainingClassId: { in: classIds },
      },
      select: {
        id: true,
        title_vi: true,
        title_en: true,
        title_zh: true,
        coverImage: true,
        academy: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        trainingClass: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        resources: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;

// For each plan, get progress for each resource (course) that's a video course
    const plansWithProgress = await Promise.all(
      trainingPlans.map(async (plan) => {
        // Get progress for each resource in the plan
        const resourcesWithProgress = await Promise.all(
          plan.resources.map(async (resource) => {
            if (resource.type === 'COURSE' && resource.refId) {
              // Get course info
              const course = await prisma.course.findUnique({
                where: { id: resource.refId },
                select: {
                  id: true,
                  title_vi: true,
                  title_en: true,
                  title_zh: true,
                  coverImage: true,
                },
              });

              // Get course progress
              const lessons = await prisma.lesson.findMany({
                where: { courseId: resource.refId },
                include: {
                  progresses: {
                    where: { userId },
                  },
                },
              });

              const totalVideos = lessons.length;
              const completedVideos = lessons.filter(
                (l) => l.progresses.length > 0 && l.progresses[0].completed
              ).length;

              return {
                ...resource,
                course: course || undefined,
                totalVideos,
                completedVideos,
                progressPercent: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
              };
            }
            return {
              ...resource,
              totalVideos: 0,
              completedVideos: 0,
              progressPercent: 0,
            };
          })
        );

// Calculate overall progress
        const allResourcesWithVideos = resourcesWithProgress.filter(r => r.totalVideos > 0);
        const totalVideosAll = allResourcesWithVideos.reduce((sum, r) => sum + r.totalVideos, 0);
        const completedVideosAll = allResourcesWithVideos.reduce((sum, r) => sum + r.completedVideos, 0);

        // Cast plan to any to allow adding dynamic fields
        const planWithProgress: any = {
          ...plan,
          resources: resourcesWithProgress,
          totalVideos: totalVideosAll,
          completedVideos: completedVideosAll,
          progressPercent: totalVideosAll > 0 ? Math.round((completedVideosAll / totalVideosAll) * 100) : 0,
        };

        return planWithProgress;
      })
    );

    res.status(200).json({ success: true, data: plansWithProgress });
  } catch (error) {
    console.error('Get my training plans error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get students in a training class
export const getClassStudents = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    const classId = parseInt(safeParamString(req.params.id));
    const search = req.query.search as string | undefined;
    const departmentId = req.query.departmentId ? parseInt(String(req.query.departmentId)) : undefined;

    if (isNaN(classId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    // Build where clause for enrollments
    const where: any = { classId };

    const enrollments = await prisma.classEnrollment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
            email: true,
            departmentId: true,
            positionId: true,
            department: {
              select: {
                id: true,
                name_vi: true,
                name_en: true,
                name_zh: true,
                code: true,
              },
            },
            position: {
              select: {
                id: true,
                name_vi: true,
                name_en: true,
                name_zh: true,
                code: true,
              },
            },
          },
        },
      },
    });

    let students = enrollments.map(e => ({
      id: e.user.id,
      usercode: e.user.usercode,
      fullName: e.user.fullName,
      email: e.user.email,
      departmentId: e.user.departmentId,
      department: e.user.department,
      positionId: e.user.positionId,
      position: e.user.position,
    }));

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      students = students.filter(s => 
        (s.usercode && s.usercode.toLowerCase().includes(searchLower)) ||
        (s.fullName && s.fullName.toLowerCase().includes(searchLower))
      );
    }

    // Filter by department
    if (departmentId) {
      students = students.filter(s => s.departmentId === departmentId);
    }

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Add student to training class
export const addStudentToClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const classId = parseInt(safeParamString(req.params.id));
    const userId = req.body.userId ? parseInt(String(req.body.userId)) : null;

    if (!classId || !userId) {
      res.status(400).json({ message: 'classId and userId are required' });
      return;
    }

    // Check if class exists
    const trainingClass = await prisma.trainingClass.findUnique({ where: { id: classId } });
    if (!trainingClass) {
      res.status(404).json({ message: 'Training class not found' });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.classEnrollment.findUnique({
      where: { userId_classId: { userId, classId } },
    });
    if (existingEnrollment) {
      res.status(400).json({ message: 'User already enrolled in this class' });
      return;
    }

    const enrollment = await prisma.classEnrollment.create({
      data: { userId, classId },
      include: {
        user: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
      },
    });

    res.status(201).json({ message: 'Student added to class successfully', student: enrollment.user });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'User already enrolled in this class' });
      return;
    }
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Remove student from training class
export const removeStudentFromClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const classId = parseInt(safeParamString(req.params.id));
    const userId = parseInt(safeParamString(req.params.userId));

    if (isNaN(classId) || isNaN(userId)) {
      res.status(400).json({ message: 'classId and userId are required' });
      return;
    }

    await prisma.classEnrollment.deleteMany({
      where: { classId, userId },
    });

    res.status(200).json({ message: 'Student removed from class successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Import students to training class from Excel
export const importStudentsToClass = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const classId = parseInt(safeParamString(req.params.id));

    if (isNaN(classId)) {
      res.status(400).json({ message: 'Invalid class ID' });
      return;
    }

    // Check if class exists
    const trainingClass = await prisma.trainingClass.findUnique({ where: { id: classId } });
    if (!trainingClass) {
      res.status(404).json({ message: 'Training class not found' });
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Parse Excel file
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

    if (!data || data.length === 0) {
      res.status(400).json({ message: 'Excel file is empty' });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Helper to get string value
    const getStringValue = (val: any): string => {
      if (typeof val === 'string') return val.trim();
      if (Array.isArray(val)) return String(val[0] || '').trim();
      if (val) return String(val).trim();
      return '';
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        const usercode = getStringValue(row.usercode || row.Usercode || row['Mã học viên']);

        if (!usercode) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Missing usercode`);
          continue;
        }

        // Find user by usercode
        const user = await prisma.user.findUnique({ where: { usercode } });
        if (!user) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: User with usercode "${usercode}" not found`);
          continue;
        }

        // Check if already enrolled
        const existingEnrollment = await prisma.classEnrollment.findUnique({
          where: { userId_classId: { userId: user.id, classId } },
        });
        if (existingEnrollment) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: User "${usercode}" already enrolled`);
          continue;
        }

        // Create enrollment
        await prisma.classEnrollment.create({
          data: { userId: user.id, classId },
        });

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    res.status(200).json({
      message: `Import completed: ${results.success} success, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Generate class report
export const generateClassReport = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const classId = parseInt(safeParamString(req.params.id));

    if (isNaN(classId)) {
      res.status(400).json({ message: 'Invalid class ID' });
      return;
    }

// Get class with details
    const trainingClass = await prisma.trainingClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        name_vi: true,
        name_en: true,
        name_zh: true,
        description: true,
        description_vi: true,
        description_en: true,
        description_zh: true,
        startDate: true,
        endDate: true,
        academy: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        lecturer: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        enrollments: {
          select: {
            user: {
              select: {
                id: true,
                usercode: true,
                fullName: true,
                email: true,
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    name_vi: true,
                    name_en: true,
                    name_zh: true,
                    code: true,
                  },
                },
                positionId: true,
                position: {
                  select: {
                    id: true,
                    name_vi: true,
                    name_en: true,
                    name_zh: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!trainingClass) {
      res.status(404).json({ message: 'Training class not found' });
      return;
    }

    // Get localized names
    const getLocalizedName = (item: any, lang: string) => {
      if (lang === 'zh') return item.name_zh || item.name_vi || '';
      if (lang === 'en') return item.name_en || item.name_vi || '';
      return item.name_vi || '';
    };

const lang = (req.query.lang as string) || 'vi';

    // Type cast for Prisma nested select typing issue
    const classData = trainingClass as any;

    res.status(200).json({
      success: true,
      data: {
        id: classData.id,
        code: classData.code,
        name: getLocalizedName(classData, lang),
        description: getLocalizedName({ name_vi: classData.description_vi, name_en: classData.description_en, name_zh: classData.description_zh }, lang),
        academy: classData.academy ? {
          id: classData.academy.id,
          name: getLocalizedName(classData.academy, lang),
        } : null,
        lecturer: classData.lecturer ? {
          id: classData.lecturer.id,
          code: classData.lecturer.code,
          name: classData.lecturer.name,
        } : null,
        startDate: classData.startDate,
        endDate: classData.endDate,
        studentCount: classData.enrollments?.length || 0,
        students: (classData.enrollments || []).map((e: any) => ({
          id: e.user.id,
          usercode: e.user.usercode,
          fullName: e.user.fullName,
          email: e.user.email,
          department: e.user.department ? {
            id: e.user.department.id,
            name: getLocalizedName(e.user.department, lang),
            code: e.user.department.code,
          } : null,
          position: e.user.position ? {
            id: e.user.position.id,
            name: getLocalizedName(e.user.position, lang),
            code: e.user.position.code,
          } : null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
