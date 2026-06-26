import { Request, Response } from 'express';
import { prisma } from '../../config/db';

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toIntValue = (value: unknown, fallback?: number): number => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return fallback ?? NaN;
  }
  return num;
};

const toBoolValue = (value: unknown, fallback = false): boolean => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return Boolean(value);
};

const ensureAdmin = (req: Request, res: Response): boolean => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ message: req.t('FORBIDDEN') });
    return false;
  }
  return true;
};

export const getExamSessions = async (req: Request, res: Response) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const academyId = req.query.academyId ? toIntValue(req.query.academyId) : undefined;
    const search = toStringValue(req.query.search);

    const where: any = {};

    if (academyId && !Number.isNaN(academyId)) {
      where.academyId = academyId;
    }

    if (search) {
      where.OR = [
        { name_vi: { contains: search, mode: 'insensitive' } },
        { name_en: { contains: search, mode: 'insensitive' } },
        { name_zh: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sessions = await prisma.examSession.findMany({
      where,
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true, code: true },
        },
        paperCategory: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ sessions });
  } catch {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const createExamSession = async (req: Request, res: Response) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const name_vi = toStringValue(req.body.name_vi);
    const name_en = toStringValue(req.body.name_en) || null;
    const name_zh = toStringValue(req.body.name_zh) || null;
    const academyId = toIntValue(req.body.academyId);
    const paperCategoryId = toIntValue(req.body.paperCategoryId);
    const startAtRaw = toStringValue(req.body.startAt);
    const endAtRaw = toStringValue(req.body.endAt);

    const attemptLimit = toIntValue(req.body.attemptLimit, 1);
    const passingScore = toIntValue(req.body.passingScore, 70);
    const durationMinutes = toIntValue(req.body.durationMinutes, 60);

    const antiCheat = toBoolValue(req.body.antiCheat, true);
    const requireFullscreen = toBoolValue(req.body.requireFullscreen, true);
    const detectTabSwitch = toBoolValue(req.body.detectTabSwitch, true);
    const shuffleQuestions = toBoolValue(req.body.shuffleQuestions, true);

    if (!name_vi || Number.isNaN(academyId) || Number.isNaN(paperCategoryId) || !startAtRaw || !endAtRaw) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      res.status(400).json({ message: 'Invalid start/end time' });
      return;
    }

    if (endAt.getTime() <= startAt.getTime()) {
      res.status(400).json({ message: 'End time must be after start time' });
      return;
    }

    const academy = await prisma.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      res.status(404).json({ message: 'Academy not found' });
      return;
    }

    const category = await prisma.questionCategory.findUnique({ where: { id: paperCategoryId } });
    if (!category) {
      res.status(404).json({ message: 'Linked paper category not found' });
      return;
    }

    if (category.academyId !== academyId) {
      res.status(400).json({ message: 'Paper category does not belong to selected academy' });
      return;
    }

    const session = await prisma.examSession.create({
      data: {
        name_vi,
        name_en,
        name_zh,
        academyId,
        paperCategoryId,
        startAt,
        endAt,
        attemptLimit,
        passingScore,
        durationMinutes,
        antiCheat,
        requireFullscreen,
        detectTabSwitch,
        shuffleQuestions,
      },
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true, code: true },
        },
        paperCategory: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            _count: { select: { questions: true } },
          },
        },
      },
    });

    res.status(201).json({ message: 'Exam session created successfully', session });
  } catch {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const updateExamSession = async (req: Request, res: Response) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = toIntValue(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const name_vi = toStringValue(req.body.name_vi);
    const name_en = toStringValue(req.body.name_en) || null;
    const name_zh = toStringValue(req.body.name_zh) || null;
    const academyId = toIntValue(req.body.academyId);
    const paperCategoryId = toIntValue(req.body.paperCategoryId);
    const startAtRaw = toStringValue(req.body.startAt);
    const endAtRaw = toStringValue(req.body.endAt);

    const attemptLimit = toIntValue(req.body.attemptLimit, 1);
    const passingScore = toIntValue(req.body.passingScore, 70);
    const durationMinutes = toIntValue(req.body.durationMinutes, 60);

    const antiCheat = toBoolValue(req.body.antiCheat, true);
    const requireFullscreen = toBoolValue(req.body.requireFullscreen, true);
    const detectTabSwitch = toBoolValue(req.body.detectTabSwitch, true);
    const shuffleQuestions = toBoolValue(req.body.shuffleQuestions, true);

    if (!name_vi || Number.isNaN(academyId) || Number.isNaN(paperCategoryId) || !startAtRaw || !endAtRaw) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      res.status(400).json({ message: 'Invalid start/end time' });
      return;
    }

    if (endAt.getTime() <= startAt.getTime()) {
      res.status(400).json({ message: 'End time must be after start time' });
      return;
    }

    const category = await prisma.questionCategory.findUnique({ where: { id: paperCategoryId } });
    if (!category) {
      res.status(404).json({ message: 'Linked paper category not found' });
      return;
    }

    if (category.academyId !== academyId) {
      res.status(400).json({ message: 'Paper category does not belong to selected academy' });
      return;
    }

    const session = await prisma.examSession.update({
      where: { id },
      data: {
        name_vi,
        name_en,
        name_zh,
        academyId,
        paperCategoryId,
        startAt,
        endAt,
        attemptLimit,
        passingScore,
        durationMinutes,
        antiCheat,
        requireFullscreen,
        detectTabSwitch,
        shuffleQuestions,
      },
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true, code: true },
        },
        paperCategory: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            _count: { select: { questions: true } },
          },
        },
      },
    });

    res.status(200).json({ message: 'Exam session updated successfully', session });
  } catch {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const deleteExamSession = async (req: Request, res: Response) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = toIntValue(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    await prisma.examSession.delete({ where: { id } });

    res.status(200).json({ message: 'Exam session deleted successfully' });
  } catch {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
