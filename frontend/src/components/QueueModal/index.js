import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles, withStyles } from "@material-ui/core/styles";
import { green, blue, grey, purple, orange } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ColorPicker from "../ColorPicker";
import { IconButton, InputAdornment, Fade } from "@material-ui/core";
import {
	Colorize,
	HelpOutline,
	AutorenewOutlined,
	PersonOutlined,
	AccountTreeOutlined,
	StarOutline
} from "@material-ui/icons";

// Custom styled switch
const PremiumSwitch = withStyles((theme) => ({
	root: {
		width: 52,
		height: 26,
		padding: 0,
		margin: theme.spacing(1),
	},
	switchBase: {
		padding: 1,
		"&$checked": {
			transform: "translateX(26px)",
			color: theme.palette.common.white,
			"& + $track": {
				backgroundColor: blue[500],
				opacity: 1,
				border: "none",
			},
		},
	},
	thumb: {
		width: 24,
		height: 24,
	},
	track: {
		borderRadius: 26 / 2,
		border: `1px solid ${grey[400]}`,
		backgroundColor: grey[300],
		opacity: 1,
		transition: theme.transitions.create(["background-color", "border"]),
	},
	checked: {},
}))(Switch);

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	dialog: {
		"& .MuiDialog-paper": {
			borderRadius: 16,
			boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
			overflow: "hidden",
		},
	},
	dialogTitle: {
		background: `linear-gradient(135deg, ${blue[600]} 0%, ${purple[600]} 100%)`,
		color: "#fff",
		padding: theme.spacing(2, 3),
		"& h2": {
			fontWeight: 600,
			fontSize: "1.25rem",
		},
	},
	dialogContent: {
		padding: theme.spacing(3),
		backgroundColor: "#fafafa",
	},
	textField: {
		marginBottom: theme.spacing(2),
		"& .MuiOutlinedInput-root": {
			borderRadius: 10,
			backgroundColor: "#fff",
			transition: "all 0.2s ease",
			"&:hover": {
				boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
			},
			"&.Mui-focused": {
				boxShadow: "0 4px 12px rgba(33, 150, 243, 0.15)",
			},
		},
	},
	btnWrapper: {
		position: "relative",
	},
	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	colorAdorment: {
		width: 24,
		height: 24,
		borderRadius: 6,
		boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
	},
	sectionTitle: {
		display: "flex",
		alignItems: "center",
		marginTop: theme.spacing(3),
		marginBottom: theme.spacing(2),
		color: grey[700],
		fontWeight: 600,
		fontSize: "0.875rem",
		textTransform: "uppercase",
		letterSpacing: "0.5px",
	},
	sectionIcon: {
		marginRight: theme.spacing(1),
		color: blue[500],
	},
	configCard: {
		padding: theme.spacing(2),
		marginBottom: theme.spacing(2),
		borderRadius: 12,
		backgroundColor: "#fff",
		border: `1px solid ${grey[200]}`,
		transition: "all 0.2s ease",
		"&:hover": {
			borderColor: blue[200],
			boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
		},
	},
	selectField: {
		"& .MuiOutlinedInput-root": {
			borderRadius: 10,
			backgroundColor: "#fff",
		},
	},
	formControl: {
		width: "100%",
		marginBottom: theme.spacing(2),
	},
	switchContainer: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: theme.spacing(1.5, 2),
		borderRadius: 12,
		backgroundColor: "#fff",
		border: `1px solid ${grey[200]}`,
		marginBottom: theme.spacing(2),
		transition: "all 0.2s ease",
		"&:hover": {
			borderColor: blue[200],
			boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
		},
	},
	switchLabel: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	switchLabelIcon: {
		color: orange[500],
	},
	helpIcon: {
		color: grey[400],
		fontSize: 18,
		cursor: "pointer",
		marginLeft: theme.spacing(0.5),
		"&:hover": {
			color: blue[400],
		},
	},
	strategyOption: {
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-start",
	},
	strategyLabel: {
		fontWeight: 500,
	},
	strategyDescription: {
		fontSize: "0.75rem",
		color: grey[500],
	},
	dialogActions: {
		padding: theme.spacing(2, 3),
		backgroundColor: "#fff",
		borderTop: `1px solid ${grey[200]}`,
	},
	cancelButton: {
		borderRadius: 10,
		padding: theme.spacing(1, 3),
		textTransform: "none",
		fontWeight: 500,
	},
	submitButton: {
		borderRadius: 10,
		padding: theme.spacing(1, 3),
		textTransform: "none",
		fontWeight: 600,
		background: `linear-gradient(135deg, ${blue[500]} 0%, ${blue[700]} 100%)`,
		boxShadow: "0 4px 12px rgba(33, 150, 243, 0.3)",
		"&:hover": {
			background: `linear-gradient(135deg, ${blue[600]} 0%, ${blue[800]} 100%)`,
			boxShadow: "0 6px 16px rgba(33, 150, 243, 0.4)",
		},
	},
}));

const QueueSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	color: Yup.string().min(3, "Too Short!").max(9, "Too Long!").required(),
	greetingMessage: Yup.string(),
	distributionStrategy: Yup.string().oneOf(["MANUAL", "AUTO_ROUND_ROBIN", "AUTO_BALANCED"]),
	prioritizeWallet: Yup.boolean(),
});

// Strategy options with descriptions
const STRATEGY_OPTIONS = [
	{
		value: "MANUAL",
		label: "Manual (Pesca)",
		description: "Agentes escolhem quais tickets atender",
		icon: <PersonOutlined style={{ color: grey[500] }} />,
	},
	{
		value: "AUTO_ROUND_ROBIN",
		label: "Automático (Circular)",
		description: "Distribui igualmente entre agentes disponíveis",
		icon: <AutorenewOutlined style={{ color: blue[500] }} />,
	},
	{
		value: "AUTO_BALANCED",
		label: "Automático (Balanceado)",
		description: "Prioriza agentes com menos tickets em aberto",
		icon: <AccountTreeOutlined style={{ color: green[500] }} />,
	},
];

const QueueModal = ({ open, onClose, queueId }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		color: "",
		greetingMessage: "",
		distributionStrategy: "MANUAL",
		prioritizeWallet: false,
	};

	const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
	const [queue, setQueue] = useState(initialState);
	const greetingRef = useRef();

	useEffect(() => {
		(async () => {
			if (!queueId) return;
			try {
				const { data } = await api.get(`/queue/${queueId}`);
				setQueue(prevState => {
					return { ...prevState, ...data };
				});
			} catch (err) {
				toastError(err);
			}
		})();

		return () => {
			setQueue(initialState);
		};
	}, [queueId, open]);

	const handleClose = () => {
		onClose();
		setQueue(initialState);
	};

	const handleSaveQueue = async values => {
		try {
			if (queueId) {
				await api.put(`/queue/${queueId}`, values);
			} else {
				await api.post("/queue", values);
			}
			toast.success(i18n.t("queueModal.toasts.success") || "Fila salva com sucesso!");
			handleClose();
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				scroll="paper"
				className={classes.dialog}
				maxWidth="sm"
				fullWidth
				TransitionComponent={Fade}
				transitionDuration={300}
			>
				<DialogTitle className={classes.dialogTitle}>
					{queueId
						? `${i18n.t("queueModal.title.edit")}`
						: `${i18n.t("queueModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={queue}
					enableReinitialize={true}
					validationSchema={QueueSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveQueue(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form>
							<DialogContent className={classes.dialogContent}>
								{/* Basic Info Section */}
								<Field
									as={TextField}
									label={i18n.t("queueModal.form.name")}
									autoFocus
									name="name"
									error={touched.name && Boolean(errors.name)}
									helperText={touched.name && errors.name}
									variant="outlined"
									margin="dense"
									fullWidth
									className={classes.textField}
								/>
								<Field
									as={TextField}
									label={i18n.t("queueModal.form.color")}
									name="color"
									id="color"
									onFocus={() => {
										setColorPickerModalOpen(true);
										greetingRef.current.focus();
									}}
									error={touched.color && Boolean(errors.color)}
									helperText={touched.color && errors.color}
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<div
													style={{ backgroundColor: values.color }}
													className={classes.colorAdorment}
												></div>
											</InputAdornment>
										),
										endAdornment: (
											<IconButton
												size="small"
												color="default"
												onClick={() => setColorPickerModalOpen(true)}
											>
												<Colorize />
											</IconButton>
										),
									}}
									variant="outlined"
									margin="dense"
									fullWidth
									className={classes.textField}
								/>
								<ColorPicker
									open={colorPickerModalOpen}
									handleClose={() => setColorPickerModalOpen(false)}
									onChange={color => {
										setFieldValue("color", color);
										setQueue(prev => ({ ...prev, color }));
									}}
								/>
								<Field
									as={TextField}
									label={i18n.t("queueModal.form.greetingMessage")}
									type="greetingMessage"
									multiline
									inputRef={greetingRef}
									rows={4}
									fullWidth
									name="greetingMessage"
									error={
										touched.greetingMessage && Boolean(errors.greetingMessage)
									}
									helperText={
										touched.greetingMessage && errors.greetingMessage
									}
									variant="outlined"
									margin="dense"
									className={classes.textField}
								/>

								<Divider style={{ margin: "16px 0" }} />

								{/* Distribution Strategy Section */}
								<Typography className={classes.sectionTitle}>
									<AutorenewOutlined className={classes.sectionIcon} />
									{i18n.t("queueModal.form.distributionSection") || "Distribuição de Tickets"}
								</Typography>

								<Paper elevation={0} className={classes.configCard}>
									<FormControl
										variant="outlined"
										fullWidth
										className={classes.formControl}
									>
										<InputLabel id="distribution-strategy-label">
											{i18n.t("queueModal.form.distributionStrategy") || "Estratégia de Distribuição"}
										</InputLabel>
										<Select
											labelId="distribution-strategy-label"
											id="distributionStrategy"
											name="distributionStrategy"
											value={values.distributionStrategy}
											onChange={(e) => setFieldValue("distributionStrategy", e.target.value)}
											label={i18n.t("queueModal.form.distributionStrategy") || "Estratégia de Distribuição"}
											className={classes.selectField}
										>
											{STRATEGY_OPTIONS.map((option) => (
												<MenuItem key={option.value} value={option.value}>
													<Box display="flex" alignItems="center" gap={1}>
														<Box mr={1} display="flex" alignItems="center">
															{option.icon}
														</Box>
														<Box className={classes.strategyOption}>
															<span className={classes.strategyLabel}>{option.label}</span>
															<span className={classes.strategyDescription}>{option.description}</span>
														</Box>
													</Box>
												</MenuItem>
											))}
										</Select>
									</FormControl>
								</Paper>

								{/* Wallet Priority Section */}
								<Box className={classes.switchContainer}>
									<Box className={classes.switchLabel}>
										<StarOutline className={classes.switchLabelIcon} />
										<Box>
											<Typography variant="body1" style={{ fontWeight: 500 }}>
												{i18n.t("queueModal.form.prioritizeWallet") || "Priorizar Carteira"}
											</Typography>
											<Typography variant="caption" color="textSecondary">
												{i18n.t("queueModal.form.prioritizeWalletHelp") || "Tickets são direcionados preferencialmente ao dono da carteira do contato"}
											</Typography>
										</Box>
										<Tooltip
											title={i18n.t("queueModal.form.prioritizeWalletTooltip") || "Quando ativo, o sistema verifica se o contato tem um vendedor/agente responsável atribuído à sua carteira. Se esse agente estiver online e nesta fila, o ticket é direcionado a ele automaticamente."}
											arrow
											placement="top"
										>
											<HelpOutline className={classes.helpIcon} />
										</Tooltip>
									</Box>
									<PremiumSwitch
										checked={values.prioritizeWallet}
										onChange={(e) => setFieldValue("prioritizeWallet", e.target.checked)}
										name="prioritizeWallet"
									/>
								</Box>

							</DialogContent>
							<DialogActions className={classes.dialogActions}>
								<Button
									onClick={handleClose}
									color="default"
									disabled={isSubmitting}
									variant="outlined"
									className={classes.cancelButton}
								>
									{i18n.t("queueModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.submitButton}
								>
									{queueId
										? `${i18n.t("queueModal.buttons.okEdit")}`
										: `${i18n.t("queueModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default QueueModal;

