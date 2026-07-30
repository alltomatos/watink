import { useState, useRef, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router";
import { format } from "date-fns";
import { toast } from "react-toastify";
import React from "react";

import { subscribeToSocket } from "../../../services/sse-client";
import { i18n } from "../../../translate/i18n";
import alertSound from "../../../assets/sound.mp3";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { useTickets } from "../../../hooks/useTickets";
import { Ticket, Contact } from "../../../types/Ticket";
import { Message } from "../../../types/Message";
import NotificationToast from "../NotificationToast";

export interface UseNotificationsReturn {
  notifications: Ticket[];
  clearNotifications: () => void;
  muted: boolean;
  toggleMuted: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const ticketIdUrl = +location.pathname.split("/")[2];
  const ticketIdRef = useRef(ticketIdUrl);

  const [notifications, setNotifications] = useState<Ticket[]>([]);
  const [, setDesktopNotifications] = useState<Notification[]>([]);
  const clearedRef = useRef(!!localStorage.getItem("notificationsCleared"));
  // Silencia som + card (toast) + notificação desktop — a lista/badge do sino
  // continua atualizando normalmente, só a interrupção ativa é suprimida.
  const [muted, setMuted] = useState<boolean>(
    () => localStorage.getItem("notificationsMuted") === "true"
  );
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem("notificationsMuted", String(next));
      return next;
    });
  };

  const { data: ticketsData } = useTickets({ withUnreadMessages: "true" });
  const tickets = ticketsData?.tickets;

  const soundAlertRef = useRef<(() => void) | null>(null);
  // Dedup: evita toast duplicado para o mesmo messageId (pode chegar 2x via tenant+chat rooms)
  const toastedIdsRef = useRef<Set<string>>(new Set());

  // Inicializa áudio e permissão de notificação desktop
  useEffect(() => {
    const audio = new Audio(alertSound);
    audio.preload = "auto";
    soundAlertRef.current = () => {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    };

    // Browsers block autoplay until a user gesture occurs. Prime the audio
    // element on first interaction so subsequent programmatic plays succeed.
    const unlock = () => {
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Sincroniza tickets com mensagens não lidas como notificações iniciais.
  // Só re-popula se o usuário não tiver clicado em "Limpar" manualmente.
  useEffect(() => {
    if (!clearedRef.current) {
      setNotifications(tickets ?? []);
    }
  }, [tickets]);

  // Mantém ref atualizada com o ticketId atual da URL
  useEffect(() => {
    ticketIdRef.current = ticketIdUrl;
  }, [ticketIdUrl]);

  const handleNotifications = (data: {
    message: Message;
    ticket: Ticket;
    contact: Contact;
  }) => {
    const { message, contact, ticket } = data;

    if (mutedRef.current) return;

    const options: NotificationOptions & { renotify?: boolean } = {
      body: `${message.body} - ${format(new Date(), "HH:mm")}`,
      icon: contact.profilePicUrl,
      tag: String(ticket.id),
      renotify: true,
    };

    soundAlertRef.current?.();

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const notification = new Notification(
          `${i18n.t("tickets.notification.message")} ${contact.name}`,
          options
        );
        notification.onclick = (e) => {
          e.preventDefault();
          window.focus();
          navigate(`/tickets/${ticket.id}`);
        };
        setDesktopNotifications((prevState) => {
          const notfIndex = prevState.findIndex((n) => n.tag === notification.tag);
          if (notfIndex !== -1) {
            prevState[notfIndex] = notification;
            return [...prevState];
          }
          return [notification, ...prevState];
        });
      } catch {
        // Browser blocked desktop notification — toast is sufficient fallback
      }
    } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    toast(
      React.createElement(NotificationToast, {
        ticket,
        message,
        contact,
        onNavigate: navigate,
      }),
      {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      }
    );
  };

  // Conexão socket: sala "notification", handlers de ticket e appMessage
  useEffect(() => {
    const handleTicket = (data: { action: string; ticketId: number }) => {
      if (data.action === "updateUnread" || data.action === "delete") {
        setNotifications((prevState) => {
          const ticketIndex = prevState.findIndex((t) => t.id === data.ticketId);
          if (ticketIndex !== -1) {
            prevState.splice(ticketIndex, 1);
            return [...prevState];
          }
          return prevState;
        });

        setDesktopNotifications((prevState) => {
          const notfIndex = prevState.findIndex(
            (n) => n.tag === String(data.ticketId)
          );
          if (notfIndex !== -1) {
            prevState[notfIndex].close();
            prevState.splice(notfIndex, 1);
            return [...prevState];
          }
          return prevState;
        });
      }
    };

    const handleAppMessage = (data: {
      action: string;
      message: Message;
      ticket: Ticket;
      contact: Contact;
    }) => {
        if (!data.ticket || !data.message || !data.contact) return;
        if (data.message.fromMe) return;
        const notifyGroups = localStorage.getItem("notifyGroups") !== "false";

        if (
          data.action === "create" &&
          !data.message.read &&
          (data.ticket.userId === user?.id || !data.ticket.userId)
        ) {
          // Nova mensagem chega: reativa notificações mesmo após Limpar
          if (clearedRef.current) {
            clearedRef.current = false;
            localStorage.removeItem("notificationsCleared");
          }
          setNotifications((prevState) => {
            const ticketIndex = prevState.findIndex(
              (t) => t.id === data.ticket.id
            );
            if (ticketIndex !== -1) {
              prevState[ticketIndex] = data.ticket;
              return [...prevState];
            }
            return [data.ticket, ...prevState];
          });

          const shouldNotNotificate =
            (data.message.ticketId === ticketIdRef.current &&
              document.visibilityState === "visible") ||
            (data.ticket.userId && data.ticket.userId !== user?.id) ||
            (data.ticket.isGroup && !notifyGroups);

          if (shouldNotNotificate) return;

          // Dedup: o backend emite para chat: e tenant: — filtra reentrada do mesmo msg
          const msgId = String(data.message.id ?? "");
          if (msgId && toastedIdsRef.current.has(msgId)) return;
          if (msgId) {
            toastedIdsRef.current.add(msgId);
            setTimeout(() => toastedIdsRef.current.delete(msgId), 5_000);
          }

          handleNotifications(data);
        }
    };

    return subscribeToSocket(
      { ticket: handleTicket, appMessage: handleAppMessage },
      (socket) => socket.emit("joinNotification")
    );
    // handleNotifications é definida acima e recriada a cada render; user é o gatilho real
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const clearNotifications = () => {
    clearedRef.current = true;
    localStorage.setItem("notificationsCleared", "1");
    setDesktopNotifications((prev) => {
      prev.forEach((n) => { try { n.close(); } catch (_e) { /* browser pode rejeitar close */ } });
      return [];
    });
    setNotifications([]);
  };

  return { notifications, clearNotifications, muted, toggleMuted };
}
