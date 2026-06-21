const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { listDocuments, getDocument, createDocument, updateDocument, uploadVersion, deleteDocument, getCategories } = require('../controllers/document.controller');

router.use(auth);

router.get('/categories', getCategories);
router.get('/',         listDocuments);
router.get('/:id',      getDocument);
router.post('/',        createDocument);
router.put('/:id',      updateDocument);
router.post('/:id/versions', uploadVersion);
router.delete('/:id',   deleteDocument);

module.exports = router;
