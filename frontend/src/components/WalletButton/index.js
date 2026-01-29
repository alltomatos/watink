import React, { useState, useContext } from "react";

import { makeStyles, withStyles } from "@material-ui/core/styles";
import {
    IconButton,
    Tooltip,
    CircularProgress,
    Avatar,
    Badge,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box
} from "@material-ui/core";
import {
    Star,
    StarBorder,
    PersonOutline
} from "@material-ui/icons";
import { amber, grey, blue } from "@material-ui/core/colors";
import { toast } from "react-toastify";

import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Custom styled badge for wallet owner avatar
const WalletBadge = withStyles((theme) => ({
    badge: {
        backgroundColor: amber[500],
        color: "#fff",
        width: 12,
        height: 12,
        minWidth: 12,
        borderRadius: "50%",
        border: `1.5px solid ${theme.palette.background.paper}`,
    },
}))(Badge);

const useStyles = makeStyles((theme) => ({
    walletButton: {
        padding: 6,
        transition: "all 0.2s ease",
        "&:hover": {
            backgroundColor: "rgba(255, 193, 7, 0.08)",
            transform: "scale(1.1)",
        },
    },
    myClientIcon: {
        color: amber[500],
        filter: "drop-shadow(0 2px 4px rgba(255, 193, 7, 0.3))",
    },
    noOwnerIcon: {
        color: grey[400],
        "&:hover": {
            color: amber[400],
        },
    },
    otherOwnerIcon: {
        color: grey[500],
    },
    ownerAvatar: {
        width: 28,
        height: 28,
        fontSize: "0.75rem",
        backgroundColor: grey[400],
        cursor: "pointer",
    },
    loadingIcon: {
        color: amber[500],
    },
    confirmDialog: {
        "& .MuiDialog-paper": {
            borderRadius: 12,
        },
    },
    confirmDialogTitle: {
        backgroundColor: amber[50],
        borderBottom: `1px solid ${amber[100]}`,
    },
    confirmDialogActions: {
        padding: theme.spacing(2),
    },
    stealButton: {
        backgroundColor: amber[500],
        color: "#fff",
        "&:hover": {
            backgroundColor: amber[600],
        },
    },
}));

/**
 * WalletButton Component
 * 
 * Displays an icon indicating the wallet ownership status of a contact.
 * Allows users to add/remove contacts from their wallet.
 * 
 * @param {Object} contact - The contact object with walletUserId and walletUser info
 * @param {Function} onWalletUpdate - Callback when wallet is updated
 */
const WalletButton = ({ contact, onWalletUpdate }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [stealDialogOpen, setStealDialogOpen] = useState(false);

    if (!contact) return null;

    const isMyClient = contact.walletUserId === user.id;
    const hasOwner = !!contact.walletUserId;
    const ownerName = contact.walletUser?.name || "";

    // Instead of isAdmin = profile === "admin", we'll check for transfer permission
    const canSteal = user.permissions?.includes("contacts:transfer");

    const handleAddToWallet = async () => {
        setLoading(true);
        try {
            await api.put(`/contacts/${contact.id}`, {
                walletUserId: user.id
            });
            toast.success(i18n.t("wallet.toasts.added") || "Contato adicionado à sua carteira!");
            if (onWalletUpdate) {
                onWalletUpdate({ ...contact, walletUserId: user.id, walletUser: { id: user.id, name: user.name } });
            }
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFromWallet = async () => {
        setLoading(true);
        try {
            await api.put(`/contacts/${contact.id}`, {
                walletUserId: null
            });
            toast.success(i18n.t("wallet.toasts.removed") || "Contato removido da sua carteira!");
            if (onWalletUpdate) {
                onWalletUpdate({ ...contact, walletUserId: null, walletUser: null });
            }
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStealClient = async () => {
        setLoading(true);
        setStealDialogOpen(false);
        try {
            await api.put(`/contacts/${contact.id}`, {
                walletUserId: user.id
            });
            toast.success(i18n.t("wallet.toasts.transferred") || "Contato transferido para sua carteira!");
            if (onWalletUpdate) {
                onWalletUpdate({ ...contact, walletUserId: user.id, walletUser: { id: user.id, name: user.name } });
            }
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = () => {
        if (loading) return;

        if (isMyClient) {
            handleRemoveFromWallet();
        } else if (!hasOwner) {
            handleAddToWallet();
        } else if (canSteal) {
            setStealDialogOpen(true);
        }
        // For non-admin users with other's client, do nothing
    };

    const getTooltipTitle = () => {
        if (isMyClient) {
            return i18n.t("wallet.tooltips.myClient") || "Remover da minha carteira";
        }
        if (!hasOwner) {
            return i18n.t("wallet.tooltips.addToWallet") || "Adicionar à minha carteira";
        }
        return `${i18n.t("wallet.tooltips.belongsTo") || "Pertence a"} ${ownerName}`;
    };

    const renderIcon = () => {
        if (loading) {
            return <CircularProgress size={20} className={classes.loadingIcon} />;
        }

        if (isMyClient) {
            return <Star className={classes.myClientIcon} />;
        }

        if (!hasOwner) {
            return <StarBorder className={classes.noOwnerIcon} />;
        }

        // Other owner - show avatar or grey star
        if (contact.walletUser?.profilePicUrl) {
            return (
                <WalletBadge
                    overlap="circle"
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    variant="dot"
                >
                    <Avatar
                        src={contact.walletUser.profilePicUrl}
                        className={classes.ownerAvatar}
                        alt={ownerName}
                    >
                        {ownerName.charAt(0).toUpperCase()}
                    </Avatar>
                </WalletBadge>
            );
        }

        return <Star className={classes.otherOwnerIcon} />;
    };

    return (
        <>
            <Tooltip title={getTooltipTitle()} arrow placement="top">
                <span>
                    <IconButton
                        className={classes.walletButton}
                        onClick={handleClick}
                        disabled={loading || (!isMyClient && hasOwner && !canSteal)}
                        size="small"
                    >
                        {renderIcon()}
                    </IconButton>
                </span>
            </Tooltip>

            {/* Steal Confirmation Dialog (Admin only) */}
            <Dialog
                open={stealDialogOpen}
                onClose={() => setStealDialogOpen(false)}
                className={classes.confirmDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle className={classes.confirmDialogTitle}>
                    {i18n.t("wallet.confirmDialog.title") || "Transferir Cliente?"}
                </DialogTitle>
                <DialogContent>
                    <Box py={2}>
                        <Typography variant="body1">
                            {i18n.t("wallet.confirmDialog.message") ||
                                `Este contato pertence a ${ownerName}. Deseja transferi-lo para sua carteira?`}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: "block" }}>
                            {i18n.t("wallet.confirmDialog.warning") ||
                                "O agente atual será notificado sobre a transferência."}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions className={classes.confirmDialogActions}>
                    <Button
                        onClick={() => setStealDialogOpen(false)}
                        variant="outlined"
                    >
                        {i18n.t("wallet.confirmDialog.cancel") || "Cancelar"}
                    </Button>
                    <Button
                        onClick={handleStealClient}
                        variant="contained"
                        className={classes.stealButton}
                        disabled={loading}
                    >
                        {i18n.t("wallet.confirmDialog.confirm") || "Transferir"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default WalletButton;
