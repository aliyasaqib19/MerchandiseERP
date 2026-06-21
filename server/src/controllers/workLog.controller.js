const prisma = require('../utils/prisma');

const USER_SELECT = { id: true, fullName: true };

const LOG_INCLUDE = {
  user:    { select: USER_SELECT },
  items:   true,
  photos:  true,
  project: { select: { id: true, projectNumber: true, title: true } },
};

// ─── List Logs for a Project ──────────────────────────────────────────────────

async function listLogs(req, res) {
  const projectId = Number(req.params.projectId);
  const logs = await prisma.workLog.findMany({
    where:   { projectId },
    include: LOG_INCLUDE,
    orderBy: { logDate: 'desc' },
  });
  res.json(logs);
}

// ─── Get Single Log ───────────────────────────────────────────────────────────

async function getLog(req, res) {
  const id  = Number(req.params.id);
  const log = await prisma.workLog.findUnique({ where: { id }, include: LOG_INCLUDE });
  if (!log) return res.status(404).json({ message: 'Work log not found' });
  res.json(log);
}

// ─── Create Log ───────────────────────────────────────────────────────────────

async function createLog(req, res) {
  const projectId = Number(req.params.projectId);
  const { logDate, hoursWorked, notes, items = [], photos = [] } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const log = await prisma.workLog.create({
    data: {
      projectId,
      userId:     req.user.id,
      logDate:    logDate ? new Date(logDate) : new Date(),
      hoursWorked:Number(hoursWorked) || 0,
      notes:      notes || null,
      items: {
        create: items.map((item) => ({
          taskType:   item.taskType   || 'OTHER',
          description:item.description,
          quantity:   item.quantity != null ? Number(item.quantity) : null,
          unit:       item.unit       || null,
          completed:  item.completed  !== false,
        })),
      },
      photos: {
        create: photos.map((p) => ({
          url:        p.url,
          caption:    p.caption || null,
          uploadedBy: req.user.id,
        })),
      },
    },
    include: LOG_INCLUDE,
  });

  res.status(201).json(log);
}

// ─── Update Log ───────────────────────────────────────────────────────────────

async function updateLog(req, res) {
  const id = Number(req.params.id);
  const { logDate, hoursWorked, notes, items } = req.body;

  const data = {};
  if (logDate     !== undefined) data.logDate     = logDate ? new Date(logDate) : new Date();
  if (hoursWorked !== undefined) data.hoursWorked = Number(hoursWorked);
  if (notes       !== undefined) data.notes       = notes;

  // Replace items if provided
  if (items !== undefined) {
    await prisma.workLogItem.deleteMany({ where: { workLogId: id } });
    data.items = {
      create: items.map((item) => ({
        taskType:   item.taskType   || 'OTHER',
        description:item.description,
        quantity:   item.quantity != null ? Number(item.quantity) : null,
        unit:       item.unit       || null,
        completed:  item.completed  !== false,
      })),
    };
  }

  const log = await prisma.workLog.update({ where: { id }, data, include: LOG_INCLUDE });
  res.json(log);
}

// ─── Add Photos to Log ────────────────────────────────────────────────────────

async function addPhotosToLog(req, res) {
  const workLogId = Number(req.params.id);
  const { photos = [] } = req.body;

  const created = await prisma.sitePhoto.createMany({
    data: photos.map((p) => ({
      workLogId,
      url:        p.url,
      caption:    p.caption || null,
      uploadedBy: req.user.id,
    })),
  });

  res.status(201).json({ count: created.count });
}

module.exports = { listLogs, getLog, createLog, updateLog, addPhotosToLog };
