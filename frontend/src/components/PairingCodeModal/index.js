import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    Button,
    TextField,
    Typography,
    Box,
    CircularProgress
} from "@material-ui/core";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const PairingCodeModal = ({ open, onClose, whatsAppId }) => {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [pairingCode, setPairingCode] = useState("");

    useEffect(() => {
        if (!whatsAppId || !open) return;
        const socket = openSocket();

        socket.on("whatsappSession", (data) => {
            if (data.action === "update" && data.session.id === whatsAppId) {
                if (data.session.pairingCode) {
                    setPairingCode(data.session.pairingCode);
                    setLoading(false);
                }
                if (data.session.status === "CONNECTED") {
                    onClose();
                }
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [whatsAppId, open, onClose]);

    const handlePairingCode = async () => {
        setLoading(true);
        try {
            await api.post(`/whatsappsession/${whatsAppId}`, {
                usePairingCode: true,
                phoneNumber: phoneNumber.replace(/\D/g, "")
            });
        } catch (err) {
            toastError(err);
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPairingCode("");
        setPhoneNumber("");
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                {i18n.t("connections.pairingCodeModal.title")}
            </DialogTitle>
            <DialogContent dividers>
                {!pairingCode ? (
                    <Box display="flex" flexDirection="column">
                        <Typography variant="body2" gutterBottom>
                            {i18n.t("connections.pairingCodeModal.instruction")}
                        </Typography>
                        <TextField
                            label={i18n.t("connections.pairingCodeModal.phoneNumber")}
                            variant="outlined"
                            margin="normal"
                            fullWidth
                            value={phoneNumber}
                            placeholder="5511999999999"
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            disabled={loading}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handlePairingCode}
                            disabled={loading || !phoneNumber}
                        >
                            {loading ? <CircularProgress size={24} /> : i18n.t("connections.pairingCodeModal.generate")}
                        </Button>
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" alignItems="center" py={2}>
                        <Typography variant="h4" color="primary" style={{ fontWeight: 'bold', letterSpacing: '2px' }}>
                            {pairingCode}
                        </Typography>
                        <Typography variant="body2" style={{ marginTop: '16px' }}>
                            {i18n.t("connections.pairingCodeModal.codeInstruction")}
                        </Typography>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PairingCodeModal;
