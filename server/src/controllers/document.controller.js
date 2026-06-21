const prisma = require('../utils/prisma');

async function listDocuments(req, res, next) {
  try {
    const { category, status = 'ACTIVE', projectId, clientId, page = 1, limit = 20, search } = req.query;
    const where = { status };
    if (category)  where.category  = category;
    if (projectId) where.projectId = Number(projectId);
    if (clientId)  where.clientId  = Number(clientId);
    if (search)    where.title = { contains: search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: { uploader: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);
    res.json({ total, page: Number(page), limit: Number(limit), items });
  } catch (err) { next(err); }
}

async function getDocument(req, res, next) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        uploader: { select: { id: true, fullName: true } },
        versions: {
          include: { uploader: { select: { id: true, fullName: true } } },
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

async function createDocument(req, res, next) {
  try {
    const { title, description, category, fileUrl, fileName, fileSize, mimeType, projectId, clientId, tags } = req.body;
    const doc = await prisma.document.create({
      data: {
        title, description,
        category: category || 'General',
        fileUrl, fileName,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        projectId: projectId ? Number(projectId) : null,
        clientId:  clientId  ? Number(clientId)  : null,
        tags: tags || null,
        uploadedBy: req.user.id,
        version: 1,
      },
      include: { uploader: { select: { id: true, fullName: true } } },
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

async function updateDocument(req, res, next) {
  try {
    const { title, description, category, tags, status } = req.body;
    const doc = await prisma.document.update({
      where: { id: Number(req.params.id) },
      data: { title, description, category, tags, status },
      include: { uploader: { select: { id: true, fullName: true } } },
    });
    res.json(doc);
  } catch (err) { next(err); }
}

async function uploadVersion(req, res, next) {
  try {
    const docId = Number(req.params.id);
    const { fileUrl, fileName, fileSize, notes } = req.body;
    const existing = await prisma.document.findUnique({ where: { id: docId } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const [version] = await prisma.$transaction([
      prisma.documentVersion.create({
        data: {
          documentId: docId,
          version: existing.version + 1,
          fileUrl, fileName,
          fileSize: fileSize || null,
          notes: notes || null,
          uploadedBy: req.user.id,
        },
      }),
      prisma.document.update({
        where: { id: docId },
        data: { fileUrl, fileName, version: existing.version + 1 },
      }),
    ]);
    res.status(201).json(version);
  } catch (err) { next(err); }
}

async function deleteDocument(req, res, next) {
  try {
    await prisma.document.update({
      where: { id: Number(req.params.id) },
      data: { status: 'DELETED' },
    });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

async function getCategories(req, res, next) {
  try {
    const cats = await prisma.document.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
      orderBy: { category: 'asc' },
    });
    res.json(cats.map((c) => ({ name: c.category, count: c._count.id })));
  } catch (err) { next(err); }
}

module.exports = { listDocuments, getDocument, createDocument, updateDocument, uploadVersion, deleteDocument, getCategories };
