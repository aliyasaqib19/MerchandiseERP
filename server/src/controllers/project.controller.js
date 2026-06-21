const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');
const { logAudit } = require('./audit.controller');

const USER_SELECT = { id: true, fullName: true, email: true };

const PROJECT_INCLUDE = {
  client:       { select: { id: true, companyName: true, email: true, phone: true } },
  manager:      { select: USER_SELECT },
  createdByUser:{ select: USER_SELECT },
  assignments: {
    include: { user: { select: USER_SELECT } },
    orderBy: { assignedAt: 'asc' },
  },
  sale: { select: { id: true, saleNumber: true, totalAmount: true } },
  _count: { select: { siteVisits: true, workLogs: true, serviceReports: true } },
};

// ─── List Projects ────────────────────────────────────────────────────────────

async function listProjects(req, res) {
  const { status, clientId, managerId, search, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {};
  if (status)   where.status   = status;
  if (clientId) where.clientId = Number(clientId);
  if (managerId)where.managerId= Number(managerId);
  if (search)   where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { projectNumber: { contains: search, mode: 'insensitive' } },
    { location: { contains: search, mode: 'insensitive' } },
  ];

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client:  { select: { id: true, companyName: true } },
        manager: { select: USER_SELECT },
        _count:  { select: { siteVisits: true, workLogs: true, serviceReports: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.project.count({ where }),
  ]);

  res.json({ projects, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

// ─── Get Stats ────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  const [byStatus, total, recentProjects] = await Promise.all([
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.project.count(),
    prisma.project.findMany({
      include: { client: { select: { companyName: true } }, manager: { select: { fullName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));

  res.json({
    total,
    active:    statusMap.ACTIVE    || 0,
    planning:  statusMap.PLANNING  || 0,
    onHold:    statusMap.ON_HOLD   || 0,
    completed: statusMap.COMPLETED || 0,
    closed:    statusMap.CLOSED    || 0,
    cancelled: statusMap.CANCELLED || 0,
    recentProjects,
  });
}

// ─── Get Single Project ───────────────────────────────────────────────────────

async function getProject(req, res) {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
}

// ─── Create Project ───────────────────────────────────────────────────────────

async function createProject(req, res) {
  const {
    title, clientId, saleId, managerId,
    location, address, city, startDate, estimatedEndDate, notes,
  } = req.body;

  const projectNumber = await generateDocNumber('project', 'projectNumber', 'PROJ');

  const project = await prisma.project.create({
    data: {
      projectNumber,
      title,
      clientId:        Number(clientId),
      saleId:          saleId ? Number(saleId) : null,
      managerId:       Number(managerId),
      location:        location || null,
      address:         address  || null,
      city:            city     || null,
      startDate:       startDate        ? new Date(startDate)        : null,
      estimatedEndDate:estimatedEndDate ? new Date(estimatedEndDate) : null,
      notes:           notes || null,
      createdBy:       req.user.id,
    },
    include: PROJECT_INCLUDE,
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'PROJECTS', resourceId: project.id, resourceType: 'Project', newValues: { projectNumber: project.projectNumber, title, clientId }, req });
  res.status(201).json(project);
}

// ─── Update Project ───────────────────────────────────────────────────────────

async function updateProject(req, res) {
  const id = Number(req.params.id);
  const {
    title, managerId, location, address, city,
    startDate, estimatedEndDate, notes, status,
  } = req.body;

  const data = {};
  if (title            !== undefined) data.title            = title;
  if (managerId        !== undefined) data.managerId        = Number(managerId);
  if (location         !== undefined) data.location         = location;
  if (address          !== undefined) data.address          = address;
  if (city             !== undefined) data.city             = city;
  if (notes            !== undefined) data.notes            = notes;
  if (startDate        !== undefined) data.startDate        = startDate ? new Date(startDate) : null;
  if (estimatedEndDate !== undefined) data.estimatedEndDate = estimatedEndDate ? new Date(estimatedEndDate) : null;
  if (status           !== undefined) data.status           = status;

  const project = await prisma.project.update({ where: { id }, data, include: PROJECT_INCLUDE });
  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'PROJECTS', resourceId: id, resourceType: 'Project', newValues: data, req });
  res.json(project);
}

// ─── Update Status ────────────────────────────────────────────────────────────

async function updateStatus(req, res) {
  const id     = Number(req.params.id);
  const { status } = req.body;

  const VALID = ['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CLOSED','CANCELLED'];
  if (!VALID.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  const data = { status };
  if (status === 'COMPLETED' || status === 'CLOSED') data.completedAt = new Date();

  const project = await prisma.project.update({ where: { id }, data, include: PROJECT_INCLUDE });
  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'PROJECTS', resourceId: id, resourceType: 'Project', newValues: { status }, req });
  res.json(project);
}

// ─── Assign / Remove Team Members ─────────────────────────────────────────────

async function assignTeam(req, res) {
  const projectId = Number(req.params.id);
  const { assignments } = req.body;
  // assignments: [{ userId, role }]

  if (!Array.isArray(assignments)) return res.status(400).json({ message: 'assignments must be array' });

  // Upsert each assignment
  const results = await Promise.all(
    assignments.map((a) =>
      prisma.projectAssignment.upsert({
        where:  { projectId_userId: { projectId, userId: Number(a.userId) } },
        create: { projectId, userId: Number(a.userId), role: a.role || 'TECHNICIAN', assignedBy: req.user.id },
        update: { role: a.role || 'TECHNICIAN' },
        include:{ user: { select: USER_SELECT } },
      })
    )
  );

  logAudit({ userId: req.user.id, action: 'ASSIGN_TEAM', module: 'PROJECTS', resourceId: projectId, resourceType: 'Project', newValues: { assignments }, req });
  res.json(results);
}

async function removeAssignment(req, res) {
  const projectId = Number(req.params.id);
  const userId    = Number(req.params.userId);

  await prisma.projectAssignment.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  logAudit({ userId: req.user.id, action: 'REMOVE_ASSIGNMENT', module: 'PROJECTS', resourceId: projectId, resourceType: 'Project', newValues: { removedUserId: userId }, req });
  res.json({ message: 'Removed' });
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

async function getTimeline(req, res) {
  const projectId = Number(req.params.id);

  const [visits, logs, reports] = await Promise.all([
    prisma.siteVisit.findMany({
      where: { projectId },
      include: { visitor: { select: USER_SELECT }, photos: true },
      orderBy: { visitDate: 'desc' },
    }),
    prisma.workLog.findMany({
      where: { projectId },
      include: { user: { select: USER_SELECT }, items: true, photos: true },
      orderBy: { logDate: 'desc' },
    }),
    prisma.serviceReport.findMany({
      where: { projectId },
      include: { generatedByUser: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Merge into a single timeline
  const timeline = [
    ...visits.map((v) => ({ type: 'SITE_VISIT',      date: v.visitDate,  data: v })),
    ...logs.map((l)   => ({ type: 'WORK_LOG',         date: l.logDate,    data: l })),
    ...reports.map((r)=> ({ type: 'SERVICE_REPORT',   date: r.createdAt,  data: r })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(timeline);
}

module.exports = {
  listProjects, getStats, getProject,
  createProject, updateProject, updateStatus,
  assignTeam, removeAssignment, getTimeline,
};
