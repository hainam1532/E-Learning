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

let trainingResourceProgressTableReady = false;
let classReportExamAttemptsTableReady = false;

const ensureTrainingResourceProgressTable = async () => {
  if (trainingResourceProgressTableReady) return;

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

  trainingResourceProgressTableReady = true;
};

const ensureClassReportExamAttemptsTable = async () => {
  if (classReportExamAttemptsTableReady) return;

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

  classReportExamAttemptsTableReady = true;
};

// Helper function to auto-update training plan status based on endDate
// Returns true if status was changed
const autoUpdatePlanStatus = async (planId: number): Promise<boolean> => {
  try {
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
      select: { status: true, endDate: true }
    });
    
    if (!plan) return false;
    
    // If plan is ACTIVE and endDate has passed, mark as COMPLETED
    if (plan.status === 'ACTIVE' && plan.endDate && new Date(plan.endDate) < new Date()) {
      await prisma.trainingPlan.update({
        where: { id: planId },
        data: { status: 'COMPLETED' }
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error auto-updating plan status:', error);
    return false;
  }
};

// Helper function to get computed status based on endDate
const getComputedPlanStatus = (status: string, endDate: Date | null): string => {
  if (status === 'ACTIVE' && endDate && new Date(endDate) < new Date()) {
    return 'COMPLETED';
  }
  return status;
};

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
    const description_vi = safeBodyString(req.body.description_vi);
    const description_en = safeBodyString(req.body.description_en);
    const description_zh = safeBodyString(req.body.description_zh);
    const content_vi = safeBodyString(req.body.content_vi);
    const content_en = safeBodyString(req.body.content_en);
    const content_zh = safeBodyString(req.body.content_zh);
    const objectives_vi = safeBodyString(req.body.objectives_vi);
    const objectives_en = safeBodyString(req.body.objectives_en);
    const objectives_zh = safeBodyString(req.body.objectives_zh);
    const targetAudience = safeBodyString(req.body.targetAudience);
    const academyId = req.body.academyId !== undefined 
      ? (req.body.academyId ? parseInt(String(req.body.academyId)) : null)
      : undefined;
    const lecturerId = req.body.lecturerId !== undefined 
      ? (req.body.lecturerId ? parseInt(String(req.body.lecturerId)) : null)
      : undefined;
    const startDate = req.body.startDate !== undefined 
      ? (req.body.startDate ? new Date(req.body.startDate) : null)
      : undefined;
    const endDate = req.body.endDate !== undefined 
      ? (req.body.endDate ? new Date(req.body.endDate) : null)
      : undefined;

    const trainingClass = await prisma.trainingClass.update({
      where: { id },
      data: { 
        name_vi, 
        name_en, 
        name_zh, 
        description, 
        description_vi,
        description_en,
        description_zh,
        content_vi,
        content_en,
        content_zh,
        objectives_vi,
        objectives_en,
        objectives_zh,
        targetAudience,
        academyId, 
        lecturerId,
        startDate,
        endDate,
      },
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

// Helper function to get current status based on endDate
const getStatusBasedOnDate = (status: string, endDate: Date | null): string => {
  if (status !== 'ACTIVE') return status;
  if (!endDate) return status;
  
  const now = new Date();
  const end = new Date(endDate);
  
  if (now > end) {
    return 'COMPLETED';
  }
  return status;
};

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
            startDate: true,
            endDate: true,
          },
        },
        resources: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-update status based on endDate and add startDate/endDate
    const plansWithAutoStatus = trainingPlans.map((plan: any) => ({
      ...plan,
      status: getStatusBasedOnDate(plan.status, plan.endDate),
      startDate: plan.startDate,
      endDate: plan.endDate,
    }));

    res.status(200).json({ success: true, data: plansWithAutoStatus });
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

    if (!['COURSE', 'EXAM', 'DOCUMENT'].includes(type)) {
      res.status(400).json({ message: 'Invalid resource type' });
      return;
    }

    if (type === 'COURSE') {
      const course = await prisma.course.findUnique({ where: { id: refId }, select: { id: true } });
      if (!course) {
        res.status(404).json({ message: 'Course not found' });
        return;
      }
    }

    if (type === 'EXAM') {
      const session = await prisma.examSession.findUnique({ where: { id: refId }, select: { id: true } });
      if (!session) {
        res.status(404).json({ message: 'Exam session not found' });
        return;
      }
    }

    if (type === 'DOCUMENT') {
      const document = await prisma.document.findUnique({ where: { id: refId }, select: { id: true } });
      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }
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

// Mark a training resource as completed for current user (used for DOCUMENT resources on /learn)
export const markTrainingResourceCompleted = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: req.t('UNAUTHORIZED') });
      return;
    }

    const resourceId = parseInt(safeParamString(req.params.resourceId));
    if (isNaN(resourceId)) {
      res.status(400).json({ success: false, message: req.t('INVALID_ID') });
      return;
    }

    const resource = await prisma.trainingResource.findUnique({
      where: { id: resourceId },
      include: {
        trainingPlan: {
          select: {
            id: true,
            trainingClassId: true,
          },
        },
      },
    });
    if (!resource) {
      res.status(404).json({ success: false, message: 'Training resource not found' });
      return;
    }

    if (!resource.trainingPlan?.trainingClassId) {
      res.status(400).json({ success: false, message: 'Training resource is not linked to any class' });
      return;
    }

    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        classId: resource.trainingPlan.trainingClassId,
        userId: req.user.id,
      },
      select: { id: true },
    });

    if (!enrollment) {
      res.status(403).json({ success: false, message: req.t('FORBIDDEN') });
      return;
    }

    await ensureTrainingResourceProgressTable();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO training_resource_progress (user_id, training_resource_id, completed, completed_at, updated_at)
      VALUES ($1, $2, true, NOW(), NOW())
      ON CONFLICT (user_id, training_resource_id)
      DO UPDATE SET completed = true, completed_at = NOW(), updated_at = NOW()
      `,
      req.user.id,
      resourceId
    );

    res.status(200).json({ success: true, message: 'Training resource marked as completed' });
  } catch (error) {
    console.error('Mark training resource completed error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
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
    // Include startDate and endDate for frontend to display and check expiration
    const trainingPlans = await prisma.trainingPlan.findMany({
      where: {
        trainingClassId: { in: classIds },
      },
      select: {
        id: true,
        title_vi: true,
        title_en: true,
        title_zh: true,
        description_vi: true,
        description_en: true,
        description_zh: true,
        coverImage: true,
        startDate: true,
        endDate: true,
        status: true,
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
            startDate: true,
            endDate: true,
          },
        },
        resources: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;

    await ensureTrainingResourceProgressTable();

// For each plan, get progress for each resource
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

            if (resource.type === 'DOCUMENT' && resource.refId) {
              const [document, completionRows] = await Promise.all([
                prisma.document.findUnique({
                  where: { id: resource.refId },
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    size: true,
                    bucket: true,
                    path: true,
                  },
                }),
                prisma.$queryRawUnsafe<Array<{ completed: boolean }>>(
                  `
                  SELECT completed
                  FROM training_resource_progress
                  WHERE user_id = $1 AND training_resource_id = $2
                  LIMIT 1
                  `,
                  userId,
                  resource.id
                ),
              ]);

              const completed = completionRows.length > 0 && completionRows[0].completed === true;
              const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
              const port = process.env.MINIO_PORT || '9000';
              const url = document
                ? `http://${endpoint}:${port}/${document.bucket}/${document.path}`
                : null;

              return {
                ...resource,
                document: document
                  ? {
                      id: document.id,
                      name: document.name,
                      type: document.type,
                      size: document.size,
                      url,
                    }
                  : undefined,
                completed,
                totalVideos: 1,
                completedVideos: completed ? 1 : 0,
                progressPercent: completed ? 100 : 0,
              };
            }

            if (resource.type === 'EXAM' && resource.refId) {
              const examSession = await prisma.examSession.findUnique({
                where: { id: resource.refId },
                select: {
                  id: true,
                  name_vi: true,
                  name_en: true,
                  name_zh: true,
                  passingScore: true,
                  durationMinutes: true,
                  antiCheat: true,
                  requireFullscreen: true,
                  detectTabSwitch: true,
                  attemptLimit: true,
                  startAt: true,
                  endAt: true,
                },
              });

              let latestAttempt: any = null;
              try {
                const attempts = await prisma.$queryRawUnsafe<Array<any>>(
                  `
                  SELECT id, status, score, passed, is_fraud, cheat_warnings, submitted_at
                  FROM exam_attempts
                  WHERE user_id = $1 AND exam_session_id = $2
                  ORDER BY id DESC
                  LIMIT 1
                  `,
                  userId,
                  resource.refId
                );
                latestAttempt = attempts[0] || null;
              } catch {
                latestAttempt = null;
              }

              const completed = latestAttempt
                ? ['SUBMITTED', 'AUTO_SUBMITTED', 'FRAUD_TERMINATED'].includes(String(latestAttempt.status || ''))
                : false;

              return {
                ...resource,
                exam: examSession
                  ? {
                      id: examSession.id,
                      name_vi: examSession.name_vi,
                      name_en: examSession.name_en,
                      name_zh: examSession.name_zh,
                      passingScore: examSession.passingScore,
                      durationMinutes: examSession.durationMinutes,
                      antiCheat: examSession.antiCheat,
                      requireFullscreen: examSession.requireFullscreen,
                      detectTabSwitch: examSession.detectTabSwitch,
                      attemptLimit: examSession.attemptLimit,
                      startAt: examSession.startAt,
                      endAt: examSession.endAt,
                    }
                  : undefined,
                latestAttempt: latestAttempt
                  ? {
                      id: latestAttempt.id,
                      status: latestAttempt.status,
                      score: latestAttempt.score,
                      passed: latestAttempt.passed,
                      isFraud: latestAttempt.is_fraud,
                      cheatWarnings: latestAttempt.cheat_warnings,
                      submittedAt: latestAttempt.submitted_at,
                    }
                  : undefined,
                completed,
                totalVideos: 1,
                completedVideos: completed ? 1 : 0,
                progressPercent: completed ? 100 : 0,
              };
            }

            return {
              ...resource,
              completed: false,
              totalVideos: 0,
              completedVideos: 0,
              progressPercent: 0,
            };
          })
        );

// Calculate overall progress
        const trackableResources = resourcesWithProgress.filter(r => r.totalVideos > 0);
        const totalVideosAll = trackableResources.reduce((sum, r) => sum + r.totalVideos, 0);
        const completedVideosAll = trackableResources.reduce((sum, r) => sum + r.completedVideos, 0);

        // Get the effective status based on endDate
        const effectiveStatus = getStatusBasedOnDate(plan.status, plan.endDate);

        // Cast plan to any to allow adding dynamic fields
        const planWithProgress: any = {
          ...plan,
          status: effectiveStatus,
          startDate: plan.startDate,
          endDate: plan.endDate,
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

    // Check if class has expired (cannot add students to expired classes)
    if (trainingClass.endDate) {
      const now = new Date();
      const end = new Date(trainingClass.endDate);
      if (now > end) {
        res.status(400).json({ message: 'Không thể thêm học viên vào lớp học đã hết hạn' });
        return;
      }
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

// Export student template for class
export const exportStudentTemplate = async (req: Request, res: Response) => {
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

    // Create template with sample data
    const templateData = [
      { usercode: 'HV001' },
      { usercode: 'HV002' },
    ];

    // Create worksheet using XLSX
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Set column width
    worksheet['!cols'] = [{ wch: 15 }];

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=student_template_${trainingClass.code}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('exportStudentTemplate error:', error);
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

    await ensureTrainingResourceProgressTable();
    await ensureClassReportExamAttemptsTable();

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
        trainingPlans: {
          select: {
            id: true,
            title_vi: true,
            title_en: true,
            title_zh: true,
            resources: {
              select: {
                id: true,
                type: true,
                refId: true,
                title_vi: true,
                title_en: true,
                title_zh: true,
              },
            },
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

    const getLocalizedTitle = (item: any, lang: string) => {
      if (lang === 'zh') return item.title_zh || item.title_vi || item.name_zh || item.name_vi || '';
      if (lang === 'en') return item.title_en || item.title_vi || item.name_en || item.name_vi || '';
      return item.title_vi || item.name_vi || item.title_en || item.name_en || '';
    };

const lang = (req.query.lang as string) || 'vi';

    // Type cast for Prisma nested select typing issue
    const classData = trainingClass as any;

    const users = (classData.enrollments || []).map((enrollment: any) => enrollment.user);
    const userIds: number[] = users.map((user: any) => Number(user.id));

    const resources = (classData.trainingPlans || []).flatMap((plan: any) => plan.resources || []);
    const courseResources = resources.filter((resource: any) => resource.type === 'COURSE' && resource.refId);
    const examResources = resources.filter((resource: any) => resource.type === 'EXAM' && resource.refId);
    const courseIds: number[] = Array.from(new Set<number>(courseResources.map((resource: any) => Number(resource.refId))));
    const examIds: number[] = Array.from(new Set<number>(examResources.map((resource: any) => Number(resource.refId))));
    const resourceIds: number[] = resources.map((resource: any) => Number(resource.id));

    const [courses, resourceProgressRows, examAttemptRows] = await Promise.all([
      courseIds.length > 0
        ? prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: {
              id: true,
              title_vi: true,
              title_en: true,
              title_zh: true,
              lessons: {
                select: {
                  id: true,
                },
              },
              courseVideos: {
                select: {
                  id: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      userIds.length > 0 && resourceIds.length > 0
        ? prisma.$queryRawUnsafe<Array<{ user_id: number; training_resource_id: number; completed: boolean }>>(
            `
            SELECT user_id, training_resource_id, completed
            FROM training_resource_progress
            WHERE user_id IN (${userIds.join(',')})
              AND training_resource_id IN (${resourceIds.join(',')})
            `
          )
        : Promise.resolve([]),
      userIds.length > 0 && examIds.length > 0
        ? prisma.$queryRawUnsafe<Array<{
            user_id: number;
            exam_session_id: number;
            status: string;
            score: number | null;
            passed: boolean | null;
            submitted_at: Date | null;
          }>>(
            `
            SELECT user_id, exam_session_id, status, score, passed, submitted_at
            FROM exam_attempts
            WHERE user_id IN (${userIds.join(',')})
              AND exam_session_id IN (${examIds.join(',')})
            `
          )
        : Promise.resolve([]),
    ]);

    const lessonIds = courses.flatMap((course: any) => course.lessons.map((lesson: any) => lesson.id));
    const progressRows = userIds.length > 0 && lessonIds.length > 0
      ? await prisma.learningProgress.findMany({
          where: {
            userId: { in: userIds },
            lessonId: { in: lessonIds },
          },
          select: {
            userId: true,
            lessonId: true,
            completed: true,
            watchedSeconds: true,
            lesson: {
              select: {
                courseId: true,
              },
            },
          },
        })
      : [];

    const courseMeta = courses.map((course: any) => ({
      courseId: course.id,
      courseName: getLocalizedTitle(course, lang),
      totalVideos: Math.max(course.lessons.length, course.courseVideos.length),
      lessonIds: course.lessons.map((lesson: any) => lesson.id),
      resourceIds: courseResources.filter((resource: any) => resource.refId === course.id).map((resource: any) => resource.id),
    }));

    const totalCourseCount = courseMeta.length;
    const totalVideoCount = courseMeta.reduce((sum: number, course: any) => sum + course.totalVideos, 0);
    const totalExamCount = examIds.length;

    const resourceCompletedSet = new Set(
      resourceProgressRows.filter((row) => row.completed).map((row) => `${row.user_id}:${row.training_resource_id}`)
    );

    const userCourseProgress = new Map<string, { completed: number; started: number; watchedSeconds: number }>();
    progressRows.forEach((row: any) => {
      const key = `${row.userId}:${row.lesson.courseId}`;
      const current = userCourseProgress.get(key) || { completed: 0, started: 0, watchedSeconds: 0 };
      current.started += 1;
      current.watchedSeconds += row.watchedSeconds || 0;
      if (row.completed) {
        current.completed += 1;
      }
      userCourseProgress.set(key, current);
    });

    const examBestAttemptMap = new Map<string, { score: number; passed: boolean; completed: boolean }>();
    examAttemptRows.forEach((row) => {
      const key = `${row.user_id}:${row.exam_session_id}`;
      const numericScore = row.score === null ? 0 : Number(row.score);
      const completed = row.submitted_at !== null || row.status !== 'ONGOING';
      const existing = examBestAttemptMap.get(key);
      if (!existing || numericScore > existing.score) {
        examBestAttemptMap.set(key, {
          score: numericScore,
          passed: row.passed === true,
          completed,
        });
        return;
      }

      if (completed && !existing.completed) {
        existing.completed = true;
      }
      if (row.passed === true) {
        existing.passed = true;
      }
    });

    const studentRows = users.map((user: any) => {
      const courseProgress = courseMeta.map((course: any) => {
        const progressKey = `${user.id}:${course.courseId}`;
        const lessonProgress = userCourseProgress.get(progressKey) || { completed: 0, started: 0, watchedSeconds: 0 };
        const completedByResource = course.resourceIds.some((resourceId: number) => resourceCompletedSet.has(`${user.id}:${resourceId}`));
        const completedVideos = course.totalVideos > 0
          ? Math.min(lessonProgress.completed, course.totalVideos)
          : completedByResource
            ? 1
            : 0;
        const progressPercent = course.totalVideos > 0
          ? Math.round((completedVideos / course.totalVideos) * 100)
          : completedByResource
            ? 100
            : 0;

        return {
          courseId: course.courseId,
          courseName: course.courseName,
          totalVideos: course.totalVideos,
          completedVideos,
          incompleteVideos: Math.max(course.totalVideos - completedVideos, 0),
          progressPercent,
          startedVideos: lessonProgress.started,
          watchedSeconds: lessonProgress.watchedSeconds,
          isCompleted: progressPercent >= 100,
        };
      });

      let completedExamCount = 0;
      let passedExamCount = 0;
      let attemptedExamCount = 0;
      let examScoreTotal = 0;
      let examScoreItems = 0;

      examIds.forEach((examId) => {
        const attempt = examBestAttemptMap.get(`${user.id}:${examId}`);
        if (!attempt) {
          return;
        }

        attemptedExamCount += 1;
        if (attempt.completed) {
          completedExamCount += 1;
        }
        if (attempt.passed) {
          passedExamCount += 1;
        }
        examScoreTotal += attempt.score;
        examScoreItems += 1;
      });

      const completedCourseCount = courseProgress.filter((course: any) => course.isCompleted).length;
      const completedVideoCount = courseProgress.reduce((sum: number, course: any) => sum + course.completedVideos, 0);
      const startedVideoCount = courseProgress.reduce((sum: number, course: any) => sum + course.startedVideos, 0);
      const incompleteCourseCount = Math.max(totalCourseCount - completedCourseCount, 0);
      const incompleteVideoCount = Math.max(totalVideoCount - completedVideoCount, 0);
      const incompleteExamCount = Math.max(totalExamCount - completedExamCount, 0);
      const totalTrackableItems = totalVideoCount + totalExamCount;
      const completionRate = totalTrackableItems > 0
        ? Math.round(((completedVideoCount + completedExamCount) / totalTrackableItems) * 100)
        : 0;

      let status = 'CHUA_BAT_DAU';
      let statusLabel = 'Chưa bắt đầu';

      if (completionRate >= 100 && totalTrackableItems > 0) {
        status = 'HOAN_THANH';
        statusLabel = 'Hoàn thành';
      } else if (startedVideoCount === 0 && attemptedExamCount === 0 && completedVideoCount === 0 && completedExamCount === 0) {
        status = 'CHUA_BAT_DAU';
        statusLabel = 'Chưa bắt đầu';
      } else if (completionRate < 30) {
        status = 'MOI_BAT_DAU';
        statusLabel = 'Mới bắt đầu';
      } else {
        status = 'DANG_HOC';
        statusLabel = 'Đang học';
      }

      return {
        id: user.id,
        usercode: user.usercode,
        fullName: user.fullName,
        email: user.email,
        departmentId: user.department?.id || null,
        department: user.department
          ? {
              id: user.department.id,
              name: getLocalizedName(user.department, lang),
              name_vi: user.department.name_vi,
              code: user.department.code,
            }
          : null,
        positionId: user.position?.id || null,
        position: user.position
          ? {
              id: user.position.id,
              name: getLocalizedName(user.position, lang),
              name_vi: user.position.name_vi,
              code: user.position.code,
            }
          : null,
        totalCourses: totalCourseCount,
        completedCourses: completedCourseCount,
        incompleteCourses: incompleteCourseCount,
        totalVideos: totalVideoCount,
        completedVideos: completedVideoCount,
        incompleteVideos: incompleteVideoCount,
        totalExams: totalExamCount,
        completedExams: completedExamCount,
        incompleteExams: incompleteExamCount,
        passedExams: passedExamCount,
        attemptedExams: attemptedExamCount,
        averageExamScore: examScoreItems > 0 ? Number((examScoreTotal / examScoreItems).toFixed(2)) : null,
        completionRate,
        status,
        statusLabel,
        courseProgress,
      };
    });

    const averageCompletionRate = studentRows.length > 0
      ? Number((studentRows.reduce((sum: number, student: any) => sum + student.completionRate, 0) / studentRows.length).toFixed(2))
      : 0;

    const completedUsers = studentRows.filter((student: any) => student.status === 'HOAN_THANH').length;
    const passedExamUsers = studentRows.filter((student: any) => student.passedExams > 0).length;

    const statusBuckets = [
      { key: 'HOAN_THANH', label: 'Hoàn thành' },
      { key: 'DANG_HOC', label: 'Đang học' },
      { key: 'MOI_BAT_DAU', label: 'Mới bắt đầu' },
      { key: 'CHUA_BAT_DAU', label: 'Chưa bắt đầu' },
    ];

    const statusDistribution = statusBuckets.map((bucket) => {
      const count = studentRows.filter((student: any) => student.status === bucket.key).length;
      const percent = studentRows.length > 0 ? Number(((count / studentRows.length) * 100).toFixed(2)) : 0;
      return {
        key: bucket.key,
        label: bucket.label,
        count,
        percent,
      };
    });

    const topExamScorers = studentRows
      .filter((student: any) => student.averageExamScore !== null)
      .sort((left: any, right: any) => (right.averageExamScore || 0) - (left.averageExamScore || 0))
      .slice(0, 10)
      .map((student: any, index: number) => ({
        rank: index + 1,
        userId: student.id,
        usercode: student.usercode,
        fullName: student.fullName,
        department: student.department?.name || '-',
        position: student.position?.name || '-',
        averageExamScore: student.averageExamScore,
        passedExams: student.passedExams,
      }));

    const departmentMap = new Map<string, any>();
    studentRows.forEach((student: any) => {
      const deptKey = student.department?.id ? String(student.department.id) : 'unknown';
      if (!departmentMap.has(deptKey)) {
        departmentMap.set(deptKey, {
          departmentId: student.department?.id || null,
          departmentName: student.department?.name || 'Chưa có phòng ban',
          totalStudents: 0,
          completedUsers: 0,
          incompleteUsers: 0,
          completedVideos: 0,
          passedExams: 0,
        });
      }

      const department = departmentMap.get(deptKey);
      department.totalStudents += 1;
      if (student.completedCourses === student.totalCourses && student.totalCourses > 0) {
        department.completedUsers += 1;
      } else {
        department.incompleteUsers += 1;
      }
      department.completedVideos += student.completedVideos;
      department.passedExams += student.passedExams;
    });

    const departmentProgress = Array.from(departmentMap.values());

    const courseProgress = courseMeta.map((course: any) => {
      const studentItems = studentRows.map((student: any) => {
        const item = student.courseProgress.find((progress: any) => progress.courseId === course.courseId);
        return {
          userId: student.id,
          usercode: student.usercode,
          fullName: student.fullName,
          department: student.department?.name || '-',
          departmentId: student.departmentId,
          position: student.position?.name || '-',
          positionId: student.positionId,
          progressPercent: item?.progressPercent || 0,
          completedVideos: item?.completedVideos || 0,
          totalVideos: item?.totalVideos || course.totalVideos,
          videoStatus: `${item?.completedVideos || 0}/${item?.totalVideos || course.totalVideos} video`,
          examStatus: `${student.completedExams}/${student.totalExams} bài thi`,
          statusLabel: item?.isCompleted ? 'Hoàn thành' : item?.progressPercent > 0 ? 'Đang học' : 'Chưa bắt đầu',
        };
      });

      return {
        courseId: course.courseId,
        courseName: course.courseName,
        totalVideos: course.totalVideos,
        completedStudents: studentItems.filter((student: any) => student.progressPercent >= 100).length,
        students: studentItems,
      };
    });

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
        studentCount: studentRows.length,
        totalCourses: totalCourseCount,
        totalVideos: totalVideoCount,
        totalExams: totalExamCount,
        trainingPlans: (classData.trainingPlans || []).map((plan: any) => ({
          id: plan.id,
          title: getLocalizedTitle(plan, lang),
        })),
        summary: {
          totalStudents: studentRows.length,
          averageCompletionRate,
          completedUsers,
          passedExamUsers,
          totalCourses: totalCourseCount,
          totalVideos: totalVideoCount,
          totalExams: totalExamCount,
        },
        statusDistribution,
        topExamScorers,
        departmentProgress,
        courseProgress,
        students: studentRows,
      },
    });
  } catch (error) {
    console.error('generateClassReport error:', error);
    res.status(500).json({ success: false, message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
