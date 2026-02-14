import React from "react";

import { Avatar, CardHeader } from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import { getBackendUrl } from "../../helpers/urlUtils";

const TicketInfo = ({ contact, ticket, onClick }) => {
	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true }}
			avatar={<Avatar src={getBackendUrl(contact.profilePicUrl)} alt="contact_image" />}
			title={`${contact.name} #${ticket.id}`}
			subheader={
				ticket.user &&
				`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
			}
		/>
	);
};

export default TicketInfo;
