const check = (user, action, data) => {
	const userPermissions = user?.permissions || [];
	const profile = user?.profile || user?.role; // Fallback for legacy calls passing role directly in user prop? No, user prop is object. 

	// If the component received 'role' prop instead of 'user', we might need to handle it in the component props, not here inside check.
	// But let's check check's first arg.

	// Standardize profile check
	if (["admin", "superadmin"].includes(user?.profile)) return true;

	if (userPermissions.includes(action)) {
		return true;
	}

	return false;
};

const Can = ({ user, role, perform, data, yes, no }) => {
	// Adapter: if 'role' is passed but 'user' is missing or doesn't have profile, try to construct a partial user
	const effectiveUser = user || { profile: role, permissions: [] };

	return check(effectiveUser, perform, data) ? yes() : no();
};

Can.defaultProps = {
	user: null,
	role: null,
	yes: () => null,
	no: () => null,
};

export { Can };
