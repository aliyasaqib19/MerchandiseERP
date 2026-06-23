function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    // System Administrator bypasses all permission checks (in any assigned role).
    if (req.user.roleName === 'System Administrator' || (req.user.roleNames || []).includes('System Administrator')) {
      return next();
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
