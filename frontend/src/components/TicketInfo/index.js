import React, { useState } from "react";

import { Avatar, CardHeader, Box, makeStyles, Typography } from "@material-ui/core";
import { blue } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";
import { getBackendUrl } from "../../helpers/urlUtils";
import WalletButton from "../WalletButton";

const useStyles = makeStyles((theme) => ({
	cardHeader: {
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		"&:hover": {
			backgroundColor: "rgba(0, 0, 0, 0.02)",
		},
	},
	avatar: {
		width: 48,
		height: 48,
		border: `2px solid ${theme.palette.primary.main}`,
		boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
	},
	titleContainer: {
		display: "flex",
		alignItems: "center",
		gap: 8,
	},
	ticketId: {
		fontSize: "0.8rem",
		color: theme.palette.text.secondary,
		fontWeight: 500,
		backgroundColor: "rgba(0, 0, 0, 0.05)",
		padding: "2px 6px",
		borderRadius: "4px",
	},
	contactName: {
		fontWeight: "bold",
		fontSize: "1.1rem",
		color: theme.palette.text.primary,
	},
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
	const classes = useStyles();
	const [localContact, setLocalContact] = useState(contact);

	// Handle wallet update to avoid full page refresh
	const handleWalletUpdate = (updatedContact) => {
		setLocalContact(updatedContact);
	};

	// Use local state if available, otherwise use prop
	const displayContact = localContact || contact;

	return (
		<CardHeader
			onClick={onClick}
			className={classes.cardHeader}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true }}
			avatar={
				<Avatar
					src={getBackendUrl(displayContact.profilePicUrl)}
					alt="contact_image"
					className={classes.avatar}
				/>
			}
			title={
				<Box className={classes.titleContainer}>
					<Typography variant="body1" component="span" className={classes.contactName}>
						{displayContact.name}
					</Typography>
					<Typography variant="body2" component="span" className={classes.ticketId}>
						#{ticket.id}
					</Typography>
					<WalletButton
						contact={displayContact}
						onWalletUpdate={handleWalletUpdate}
					/>
				</Box>
			}
			subheader={
				ticket.user &&
				`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
			}
		/>
	);
};

export default TicketInfo;

