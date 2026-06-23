const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

async function listApprovals(req, res, next) {
  try {
    const { status, type, page = 1, limit = 20, mine } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type)   where.type   = type;
    if (mine === 'true') where.requestedBy = req.user.id;

    const [total, items] = await Promise.all([
      prisma.approvalRequest.count({ where }),
      prisma.approvalRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, fullName: true, email: true } },
          assignee:  { select: { id: true, fullName: true } },
          decider:   { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);
    res.json({ total, page: Number(page), limit: Number(limit), items });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const [pending, approved, rejected, byType] = await Promise.all([
      prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
      prisma.approvalRequest.count({ where: { status: 'APPROVED' } }),
      prisma.approvalRequest.count({ where: { status: 'REJECTED' } }),
      prisma.approvalRequest.groupBy({ by: ['type'], _count: { id: true }, where: { status: 'PENDING' } }),
    ]);
    res.json({ pending, approved, rejected, byType });
  } catch (err) { next(err); }
}

async function getApproval(req, res, next) {
  try {
    const item = await prisma.approvalRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        assignee:  { select: { id: true, fullName: true } },
        decider:   { select: { id: true, fullName: true } },
      },
    });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
}

async function createApproval(req, res, next) {
  try {
    const { type, title, description, referenceId, referenceType, assignedTo, priority, dueDate } = req.body;
    const item = await prisma.approvalRequest.create({
      data: {
        type, title, description, referenceId, referenceType,
        assignedTo: assignedTo || null,
        priority:   priority   || 'NORMAL',
        dueDate:    dueDate    ? new Date(dueDate) : null,
        requestedBy: req.user.id,
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, fullName: true } },
      },
    });

    // Notify assignee
    if (assignedTo) {
      await prisma.notification.create({
        data: {
          userId: assignedTo,
          type: 'APPROVAL_REQUIRED',
          title: 'New Approval Required',
          message: `${req.user.fullName} has submitted: ${title}`,
          link: `/approvals/${item.id}`,
        },
      });
    }

    logAudit({ userId: req.user.id, action: 'CREATE', module: 'APPROVALS', resourceId: item.id, resourceType: 'ApprovalRequest', newValues: { type, title, priority }, req });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

async function decide(req, res, next) {
  try {
    const { decision, decisionNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be APPROVED or REJECTED' });
    }
    const existing = await prisma.approvalRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ message: 'Not found' });
    if (existing.status !== 'PENDING') return res.status(400).json({ message: 'Already decided' });

    const item = await prisma.approvalRequest.update({
      where: { id: Number(req.params.id) },
      data: {
        status: decision,
        decidedBy: req.user.id,
        decidedAt: new Date(),
        decisionNote: decisionNote || null,
      },
      include: {
        requester: { select: { id: true, fullName: true } },
        decider:   { select: { id: true, fullName: true } },
      },
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        userId: existing.requestedBy,
        type: 'APPROVAL_DECIDED',
        title: `Request ${decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your request "${existing.title}" was ${decision.toLowerCase()} by ${req.user.fullName}.`,
        link: `/approvals/${item.id}`,
      },
    });

    logAudit({ userId: req.user.id, action: decision, module: 'APPROVALS', resourceId: item.id, resourceType: 'ApprovalRequest', newValues: { decision, decisionNote }, req });
    res.json(item);
  } catch (err) { next(err); }
}

async function updateApproval(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { title, description, type, priority, dueDate, resubmit } = req.body || {};
    const existing = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });
    if (existing.status === 'APPROVED') return res.status(400).json({ message: 'An approved request cannot be edited.' });

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    // Editing a rejected/cancelled request can re-open it for approval
    if (resubmit && (existing.status === 'REJECTED' || existing.status === 'CANCELLED')) {
      data.status = 'PENDING';
      data.decidedBy = null;
      data.decidedAt = null;
      data.decisionNote = null;
    }

    const item = await prisma.approvalRequest.update({
      where: { id },
      data,
      include: {
        requester: { select: { id: true, fullName: true } },
        decider:   { select: { id: true, fullName: true } },
      },
    });
    logAudit({ userId: req.user.id, action: 'UPDATE', module: 'APPROVALS', resourceId: id, resourceType: 'ApprovalRequest', newValues: { ...data }, req });
    res.json(item);
  } catch (err) { next(err); }
}

async function cancelApproval(req, res, next) {
  try {
    const item = await prisma.approvalRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.requestedBy !== req.user.id) return res.status(403).json({ message: 'Not your request' });
    if (item.status !== 'PENDING') return res.status(400).json({ message: 'Cannot cancel a decided request' });

    const updated = await prisma.approvalRequest.update({
      where: { id: Number(req.params.id) },
      data: { status: 'CANCELLED' },
    });
    logAudit({ userId: req.user.id, action: 'CANCEL', module: 'APPROVALS', resourceId: updated.id, resourceType: 'ApprovalRequest', req });
    res.json(updated);
  } catch (err) { next(err); }
}

module.exports = { listApprovals, getStats, getApproval, createApproval, decide, updateApproval, cancelApproval };
