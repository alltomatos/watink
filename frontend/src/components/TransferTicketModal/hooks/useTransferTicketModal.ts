import { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import useQueues from "../../../hooks/useQueues";
import useWhatsApps from "../../../hooks/useWhatsApps";
import { AuthContext } from "../../../context/Auth/AuthContext";
import type { UserOption, QueueOption } from "../transferTicketModalTypes";

interface UseTransferTicketModalParams {
  modalOpen: boolean;
  onClose: () => void;
  ticketid: number | string;
  ticketWhatsappId?: number | string;
}

export function useTransferTicketModal({
  modalOpen,
  onClose,
  ticketid,
  ticketWhatsappId,
}: UseTransferTicketModalParams) {
  const navigate = useNavigate();
  const [options, setOptions] = useState<UserOption[]>([]);
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [allQueues, setAllQueues] = useState<QueueOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState(
    ticketWhatsappId ? String(ticketWhatsappId) : ""
  );

  const { data: queuesData } = useQueues();
  const { loading: loadingWhatsapps, whatsApps } = useWhatsApps();
  const { user: loggedInUser } = useContext(AuthContext);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (queuesData) {
      setAllQueues(queuesData);
      setQueues(queuesData);
    }
  }, [queuesData]);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setOptions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/users/", { params: { searchParam } });
        setOptions(data.users);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchParam, modalOpen]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedUser(null);
    setOptions([]);
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketid) return;
    setLoading(true);
    try {
      const data: Record<string, unknown> = {};

      if (selectedUser) data.userId = selectedUser.id;

      if (selectedQueue && selectedQueue !== "none") {
        data.queueId = selectedQueue;
        if (!selectedUser) {
          data.status = "pending";
          data.userId = null;
        }
      }

      if (selectedWhatsapp && selectedWhatsapp !== "none") {
        data.whatsappId = selectedWhatsapp;
      }

      await api.put(`/tickets/${ticketid}`, data);
      navigate(`/tickets`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      handleClose();
    }
  };

  const handleSelectUser = (opt: UserOption) => {
    setSelectedUser(opt);
    setSearchParam(opt.name);
    setOptions([]);
    if (opt.queues && Array.isArray(opt.queues) && opt.queues.length > 0) {
      setQueues(opt.queues);
    } else {
      setQueues(allQueues);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchParam(value);
    if (selectedUser && value !== selectedUser.name) {
      setSelectedUser(null);
    }
  };

  const isSubmitDisabled =
    loading || (!selectedUser && !selectedQueue && !selectedWhatsapp);

  return {
    options,
    queues,
    loading,
    loadingWhatsapps,
    whatsApps,
    loggedInUser,
    searchParam,
    selectedUser,
    selectedQueue,
    selectedWhatsapp,
    isSubmitDisabled,
    handleClose,
    handleSaveTicket,
    handleSelectUser,
    handleSearchChange,
    setSelectedQueue,
    setSelectedWhatsapp,
  };
}
