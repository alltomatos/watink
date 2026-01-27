import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useThemeContext } from "../../context/DarkMode";
import toastError from "../../errors/toastError";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles(theme => ({
	ticket: {
		position: "relative",
	},

	ticketSaas: {
		paddingTop: "15px",
		paddingBottom: "15px",
		borderBottom: "1px solid #f0f0f0", // Weaker divider
	},

	contactNameSaas: {
		fontWeight: 600,
		fontSize: "1rem", // Slightly larger
	},

	pendingTicket: {
		cursor: "unset",
	},

	noTicketsDiv: {
		display: "flex",
		height: "100px",
		margin: 40,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},

	noTicketsText: {
		textAlign: "center",
		color: "rgb(104, 121, 146)",
		fontSize: "14px",
		lineHeight: "1.4",
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "16px",
		fontWeight: "600",
		margin: "0px",
	},

	contactNameWrapper: {
		display: "flex",
		justifyContent: "space-between",
	},

	lastMessageTime: {
		justifySelf: "flex-end",
	},

	closedBadge: {
		alignSelf: "center",
		justifySelf: "flex-end",
		marginRight: 32,
		marginLeft: "auto",
	},

	contactLastMessage: {
		paddingRight: 20,
	},

	newMessagesCount: {
		alignSelf: "center",
		marginRight: 8,
		marginLeft: "auto",
	},

	badgeStyle: {
		color: "white",
		backgroundColor: green[500],
	},

	acceptButton: {
		position: "absolute",
		left: "50%",
	},

	ticketQueueColor: {
		flex: "none",
		width: "8px",
		height: "100%",
		position: "absolute",
		top: "0%",
		left: "0%",
	},

	ticketInfoWrapper: {
		display: "flex",
		justifyContent: "flex-end",
		marginTop: 2,
		alignItems: "center",
		gap: 4,
		flexWrap: "wrap",
	},

	connectionTag: {
		background: "linear-gradient(to right, #6366f1, #4f46e5)",
		color: "#ffffff",
		border: "none",
		boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
		padding: "1px 6px",
		borderRadius: 10,
		fontSize: "0.7em",
		fontWeight: "600",
		whiteSpace: "nowrap"
	},

	tagChip: {
		padding: "1px 6px",
		borderRadius: 10,
		fontSize: "0.7em",
		fontWeight: "600",
		color: "#fff",
		whiteSpace: "nowrap"
	}
}));

const TicketListItem = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [loading, setLoading] = useState(false);
	const { ticketId } = useParams();
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);
	const { appTheme } = useThemeContext();

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleAcceptTicket = async id => {
		setLoading(true);
		try {
			await api.put(`/tickets/${id}`, {
				status: "open",
				userId: user?.id,
			});
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
		if (isMounted.current) {
			setLoading(false);
		}
		history.push(`/tickets/${id}`);
	};

	const handleSelectTicket = id => {
		history.push(`/tickets/${id}`);
	};

	return (
		<React.Fragment key={ticket.id}>
			<ListItem
				dense
				button
				onClick={e => {
					if (ticket.status === "pending" && !ticket?.isGroup && !ticket?.contact?.isGroup) return;
					handleSelectTicket(ticket.id);
				}}
				selected={ticketId && +ticketId === ticket.id}
				className={clsx(classes.ticket, {
					[classes.pendingTicket]: ticket.status === "pending",
					[classes.ticketSaas]: appTheme === "saas",
				})}
			>
				<Tooltip
					arrow
					placement="right"
					title={ticket.queue?.name || "Sem fila"}
				>
					<span
						style={{ backgroundColor: ticket.queue?.color || "#7C7C7C" }}
						className={classes.ticketQueueColor}
					></span>
				</Tooltip>
				<ListItemAvatar>
					<Avatar src={getBackendUrl(ticket?.contact?.profilePicUrl)} />
				</ListItemAvatar>
				<ListItemText
					disableTypography
					primary={
						<span className={classes.contactNameWrapper}>
							<Typography
								noWrap
								component="span"
								variant="body2"
								color="textPrimary"
								className={clsx({ [classes.contactNameSaas]: appTheme === "saas" })}
							>
								{ticket.contact.name}
							</Typography>
							{ticket.status === "closed" && (
								<Badge
									className={classes.closedBadge}
									badgeContent={"closed"}
									color="primary"
								/>
							)}
							{/* Mostrar horário: sempre para grupos, ou se tiver lastMessage */}
							{(ticket.lastMessage || ticket.isGroup || ticket.contact?.isGroup) && (
								<Typography
									className={classes.lastMessageTime}
									component="span"
									variant="body2"
									color="textSecondary"
								>
									{isSameDay(parseISO(ticket.updatedAt), new Date()) ? (
										<>{format(parseISO(ticket.updatedAt), "HH:mm")}</>
									) : (
										<>{format(parseISO(ticket.updatedAt), "dd/MM/yyyy HH:mm")}</>
									)}
								</Typography>
							)}
						</span>
					}
					secondary={
						<span>
							<span className={classes.contactNameWrapper}>
								<Typography
									className={classes.contactLastMessage}
									noWrap
									component="span"
									variant="body2"
									color="textSecondary"
								>
									{ticket.lastMessage ? (
										<MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
									) : (
										<br />
									)}
								</Typography>

								<Badge
									className={classes.newMessagesCount}
									badgeContent={ticket.unreadMessages}
									classes={{
										badge: classes.badgeStyle,
									}}
								/>
							</span>
							<span className={classes.ticketInfoWrapper}>
								{ticket.tags && ticket.tags.length > 0 && (
									<>
										{ticket.tags.map(tag => (
											<span
												key={tag.id}
												className={classes.tagChip}
												style={{ backgroundColor: tag.color }}
											>
												{tag.name}
											</span>
										))}
									</>
								)}
								{ticket.whatsappId && (
									<div className={classes.connectionTag} title={i18n.t("ticketsList.connectionTitle")}>
										{ticket.whatsapp?.name}
									</div>
								)}
							</span>
						</span>
					}
				/>
				{/* Ocultar botão Aceitar para grupos - grupos não são tickets normais */}
				{ticket.status === "pending" && !ticket.isGroup && !ticket.contact?.isGroup && (
					<ButtonWithSpinner
						color="primary"
						variant="contained"
						className={classes.acceptButton}
						size="small"
						loading={loading}
						onClick={e => handleAcceptTicket(ticket.id)}
					>
						{i18n.t("ticketsList.buttons.accept")}
					</ButtonWithSpinner>
				)}
			</ListItem>
			{appTheme !== "saas" && <Divider variant="inset" component="li" />}
		</React.Fragment>
	);
};

export default TicketListItem;
