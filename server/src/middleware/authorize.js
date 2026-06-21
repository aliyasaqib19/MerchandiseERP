function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const userPerms = new Set(req.user.permissions);
    const hasAll = requiredPermissions.every((p) => userPerms.has(p));

    if (!hasAll) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }

    next();
  };
}

module.exports = authorize;
