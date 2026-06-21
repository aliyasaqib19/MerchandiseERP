const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');

const USER_SELECT = { id: true, fullName: true };

const REPORT_INCLUDE = {
  generatedByUser: { select: USER_SELECT },
  activities:      { orderBy: { sortOrder: 'asc' } },
  project: {
    select: {
      id: true, projectNumber: true, title: true, status: true,
      client: { select: { id: true, companyName: true } },
      manager: { select: USER_SELECT },
    },
  },
};

// ─── List Reports for a Project ───────────────────────────────────────────────

async function listReports(req, res) {
  const projectId = Number(req.params.projectId);
  const reports = await prisma.serviceReport.findMany({
    where:   { projectId },
    include: REPORT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(reports);
}

// ─── Get Single Report ────────────────────────────────────────────────────────

async function getReport(req, res) {
  const id     = Number(req.params.id);
  const report = await prisma.serviceReport.findUnique({ where: { id }, include: REPORT_INCLUDE });
  if (!report) return res.status(404).json({ message: 'Report not found' });
  res.json(report);
}

// ─── Create Report ────────────────────────────────────────────────────────────

async function createReport(req, res) {
  const projectId = Number(req.params.projectId);
  const { summary, recommendations, activities = [], autoPopulate } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const reportNumber = await generateDocNumber('serviceReport', 'reportNumber', 'SR');

  let activitiesToCreate = activities.map((a, i) => ({
    category:    a.category    || 'General',
    description: a.description,
    completedAt: a.completedAt ? new Date(a.completedAt) : null,
    sortOrder:   a.sortOrder   ?? i,
  }));

  // Auto-populate from work logs if requested
  if (autoPopulate) {
    const logs = await prisma.workLog.findMany({
      where:   { projectId },
      include: { items: true },
      orderBy: { logDate: 'asc' },
    });
    let order = activitiesToCreate.length;
    for (const log of logs) {
      for (const item of log.items) {
        activitiesToCreate.push({
          category:    item.taskType.replace(/_/g, ' '),
          description: item.description,
          completedAt: log.logDate,
          sortOrder:   order++,
        });
      }
    }
  }

  const report = await prisma.serviceReport.create({
    data: {
      reportNumber,
      projectId,
      generatedBy:    req.user.id,
      summary:        summary         || null,
      recommendations:recommendations || null,
      activities:     { create: activitiesToCreate },
    },
    include: REPORT_INCLUDE,
  });

  res.status(201).json(report);
}

// ─── Update Report ────────────────────────────────────────────────────────────

async function updateReport(req, res) {
  const id = Number(req.params.id);
  const { summary, recommendations, activities } = req.body;

  const data = {};
  if (summary         !== undefined) data.summary         = summary;
  if (recommendations !== undefined) data.recommendations = recommendations;

  if (activities !== undefined) {
    await prisma.reportActivity.deleteMany({ where: { reportId: id } });
    data.activities = {
      create: activities.map((a, i) => ({
        category:    a.category    || 'General',
        description: a.description,
        completedAt: a.completedAt ? new Date(a.completedAt) : null,
        sortOrder:   a.sortOrder   ?? i,
      })),
    };
  }

  const report = await prisma.serviceReport.update({ where: { id }, data, include: REPORT_INCLUDE });
  res.json(report);
}

// ─── Upload Signature ─────────────────────────────────────────────────────────

async function addSignature(req, res) {
  const id   = Number(req.params.id);
  const { signatureType, signatureUrl } = req.body;
  // signatureType: 'client' | 'manager'

  if (!['client','manager'].includes(signatureType)) {
    return res.status(400).json({ message: 'signatureType must be client or manager' });
  }

  const now = new Date();
  const data = signatureType === 'client'
    ? { clientSignatureUrl: signatureUrl, clientSignedAt: now }
    : { managerSignatureUrl: signatureUrl, managerSignedAt: now };

  // Auto-advance to PENDING_SIGNATURES if still DRAFT
  const current = await prisma.serviceReport.findUnique({ where: { id } });
  if (current?.status === 'DRAFT') data.status = 'PENDING_SIGNATURES';

  const report = await prisma.serviceReport.update({ where: { id }, data, include: REPORT_INCLUDE });
  res.json(report);
}

// ─── Approve Report & Close Project ──────────────────────────────────────────

async function approveReport(req, res) {
  const id = Number(req.params.id);

  const report = await prisma.serviceReport.findUnique({ where: { id }, include: { project: true } });
  if (!report) return res.status(404).json({ message: 'Report not found' });

  if (!report.clientSignatureUrl || !report.managerSignatureUrl) {
    return res.status(400).json({ message: 'Both client and manager signatures are required before approval' });
  }

  const now = new Date();
  const [updatedReport] = await prisma.$transaction([
    prisma.serviceReport.update({
      where: { id },
      data:  { status: 'APPROVED', approvedAt: now },
      include: REPORT_INCLUDE,
    }),
    prisma.project.update({
      where: { id: report.projectId },
      data:  { status: 'CLOSED', completedAt: now },
    }),
  ]);

  res.json(updatedReport);
}

// ─── Reject Report ────────────────────────────────────────────────────────────

async function rejectReport(req, res) {
  const id = Number(req.params.id);
  const report = await prisma.serviceReport.update({
    where: { id },
    data:  { status: 'REJECTED' },
    include: REPORT_INCLUDE,
  });
  res.json(report);
}

module.exports = {
  listReports, getReport, createReport, updateReport,
  addSignature, approveReport, rejectReport,
};
