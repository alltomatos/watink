import rules from "../../rules";

const check = (role, action, permissions) => {
	const permissionsToCheck = permissions || [];

	if (permissionsToCheck.includes(action) || permissionsToCheck.includes("*:*")) {
		return true;
	}

	// Support for resource:* (e.g. helpdesk:*)
	const [resource] = action.split(":");
	if (resource && permissionsToCheck.includes(`${resource}:*`)) {
		return true;
	}

	const staticPermissions = rules[role]?.static || [];
	if (staticPermissions.includes(action)) {
		return true;
	}

	return false;
};

const Can = ({ role, perform, data, yes, no, user }) => {
	const permissions = user?.permissions || [];
	const userRole = role || user?.profile;

	return check(userRole, perform, permissions) ? yes() : no();
};

Can.defaultProps = {
	user: null,
	role: null,
	yes: () => null,
	no: () => null,
};

export { Can };
