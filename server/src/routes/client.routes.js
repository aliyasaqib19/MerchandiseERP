const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/client.controller');

const router = Router();
router.use(authenticate);

// ─── Stats & Meta ─────────────────────────────────────────────────────────────
router.get('/stats',        authorize('CLIENTS_VIEW'), ctrl.getStats);
router.get('/industries',   authorize('CLIENTS_VIEW'), ctrl.getIndustries);
router.get('/all-contacts', authorize('CLIENTS_VIEW'), ctrl.getAllContacts);

// ─── Clients CRUD ─────────────────────────────────────────────────────────────
router.get('/', authorize('CLIENTS_VIEW'), ctrl.getClients);
router.get('/:id', authorize('CLIENTS_VIEW'), ctrl.getClient);

router.post('/',
  authorize('CLIENTS_CREATE'),
  [body('companyName').notEmpty().trim()],
  validate,
  ctrl.createClient
);

router.put('/:id', authorize('CLIENTS_UPDATE'), ctrl.updateClient);
router.delete('/:id', authorize('CLIENTS_DELETE'), ctrl.deleteClient);

// ─── Contacts ─────────────────────────────────────────────────────────────────
router.get('/:id/contacts', authorize('CLIENTS_VIEW'), ctrl.getContacts);

router.post('/:id/contacts',
  authorize('CLIENTS_UPDATE'),
  [body('fullName').notEmpty().trim()],
  validate,
  ctrl.createContact
);

router.put('/:id/contacts/:contactId', authorize('CLIENTS_UPDATE'), ctrl.updateContact);
router.delete('/:id/contacts/:contactId', authorize('CLIENTS_UPDATE'), ctrl.deleteContact);

// ─── Notes ────────────────────────────────────────────────────────────────────
router.get('/:id/notes', authorize('CLIENTS_VIEW'), ctrl.getNotes);

router.post('/:id/notes',
  authorize('CLIENTS_UPDATE'),
  ctrl.createNote
);

router.delete('/:id/notes/:noteId', authorize('CLIENTS_UPDATE'), ctrl.deleteNote);

// ─── Item history ─────────────────────────────────────────────────────────────
router.get('/:id/items', authorize('CLIENTS_VIEW'), ctrl.getClientItems);

// ─── Ledger ───────────────────────────────────────────────────────────────────
router.get('/:id/ledger', authorize('CLIENTS_VIEW'), ctrl.getLedger);

const txValidation = [
  body('type').isIn(['INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE']),
  body('amount').isFloat({ min: 0.01 }),
  body('description').notEmpty().trim(),
];

router.post('/:id/ledger',      authorize('CLIENTS_CREATE'), txValidation, validate, ctrl.createTransaction);
router.post('/:id/transactions', authorize('CLIENTS_CREATE'), txValidation, validate, ctrl.createTransaction);

router.delete('/:id/ledger/:txId', authorize('CLIENTS_DELETE'), ctrl.deleteTransaction);

module.exports = router;
