import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { WhatsappOption } from "../groupTypes";

/**
 * Shared connection-selection state for Groups/Communities pages (plan §6.3
 * — a WhatsApp group cannot exist without a connection, so every screen is
 * scoped by whatsappId, persisted across visits).
 */
export function useGroupsConnection() {
    const [whatsapps, setWhatsapps] = useState<WhatsappOption[]>([]);
    const [loadingConnections, setLoadingConnections] = useState(true);
    const [whatsappId, setWhatsappId] = useLocalStorage<number | null>("groupsWhatsappId", null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await api.get("/whatsapp");
                const list: WhatsappOption[] = Array.isArray(data) ? data : [];
                if (!active) return;
                setWhatsapps(list);
                if (whatsappId === null && list.length > 0) {
                    setWhatsappId(list[0].id);
                } else if (whatsappId !== null && !list.some((w) => w.id === whatsappId)) {
                    setWhatsappId(list.length > 0 ? list[0].id : null);
                }
            } finally {
                if (active) setLoadingConnections(false);
            }
        })();
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { whatsapps, whatsappId, setWhatsappId, loadingConnections };
}
