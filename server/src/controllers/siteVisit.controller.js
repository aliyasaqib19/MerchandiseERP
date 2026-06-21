const prisma = require('../utils/prisma');

const USER_SELECT = { id: true, fullName: true };

const VISIT_INCLUDE = {
  visitor: { select: USER_SELECT },
  photos:  true,
  project: { select: { id: true, projectNumber: true, title: true } },
};

// ─── List Visits for a Project ────────────────────────────────────────────────

async function listVisits(req, res) {
  const projectId = Number(req.params.projectId);
  const visits = await prisma.siteVisit.findMany({
    where:   { projectId },
    include: VISIT_INCLUDE,
    orderBy: { visitDate: 'desc' },
  });
  res.json(visits);
}

// ─── Get Single Visit ─────────────────────────────────────────────────────────

async function getVisit(req, res) {
  const id = Number(req.params.id);
  const visit = await prisma.siteVisit.findUnique({ where: { id }, include: VISIT_INCLUDE });
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  res.json(visit);
}

// ─── Create Visit ─────────────────────────────────────────────────────────────

async function createVisit(req, res) {
  const projectId = Number(req.params.projectId);
  const { visitDate, purpose, requirements, observations, notes, photos = [] } = req.body;

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const visit = await prisma.siteVisit.create({
    data: {
      projectId,
      visitedBy:    req.user.id,
      visitDate:    visitDate ? new Date(visitDate) : new Date(),
      purpose:      purpose      || null,
      requirements: requirements || null,
      observations: observations || null,
      notes:        notes        || null,
      photos: {
        create: photos.map((p) => ({
          url:       p.url,
          caption:   p.caption || null,
          uploadedBy: req.user.id,
        })),
      },
    },
    include: VISIT_INCLUDE,
  });

  res.status(201).json(visit);
}

// ─── Update Visit ─────────────────────────────────────────────────────────────

async function updateVisit(req, res) {
  const id = Number(req.params.id);
  const { visitDate, purpose, requirements, observations, notes } = req.body;

  const data = {};
  if (visitDate    !== undefined) data.visitDate    = visitDate ? new Date(visitDate) : new Date();
  if (purpose      !== undefined) data.purpose      = purpose;
  if (requirements !== undefined) data.requirements = requirements;
  if (observations !== undefined) data.observations = observations;
  if (notes        !== undefined) data.notes        = notes;

  const visit = await prisma.siteVisit.update({ where: { id }, data, include: VISIT_INCLUDE });
  res.json(visit);
}

// ─── Add Photos to Visit ──────────────────────────────────────────────────────

async function addPhotos(req, res) {
  const siteVisitId = Number(req.params.id);
  const { photos = [] } = req.body;

  const created = await prisma.sitePhoto.createMany({
    data: photos.map((p) => ({
      siteVisitId,
      url:        p.url,
      caption:    p.caption || null,
      uploadedBy: req.user.id,
    })),
  });

  res.status(201).json({ count: created.count });
}

// ─── Delete Photo ─────────────────────────────────────────────────────────────

async function deletePhoto(req, res) {
  const id = Number(req.params.photoId);
  await prisma.sitePhoto.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}

module.exports = { listVisits, getVisit, createVisit, updateVisit, addPhotos, deletePhoto };
