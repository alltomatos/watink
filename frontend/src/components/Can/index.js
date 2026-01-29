const check = (user, action, data) => {
	const userPermissions = user?.permissions || [];

	if (userPermissions.includes(action)) {
		return true;
	}

	return false;
};

const Can = ({ user, perform, data, yes, no }) => {
	return check(user, perform, data) ? yes() : no();
};

Can.defaultProps = {
	user: null,
	role: null,
	yes: () => null,
	no: () => null,
};

export { Can };
