import { useState, useEffect, useContext, useRef } from "react";
import { useParams } from "react-router";
import { ReplyMessageContext } from "../../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { useAudioRecording } from "./useAudioRecording";
import { useMediaUpload } from "./useMediaUpload";
import { useMentions } from "./useMentions";
import { useQuickAnswers } from "./useQuickAnswers";

export { type MediaItem } from "./useMediaUpload";
export { type Participant } from "./useMentions";
export { type QuickAnswer } from "./useQuickAnswers";

export const useMessageInput = () => {
  const { ticketId } = useParams<{ ticketId: string }>();

  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [anchorElMenu, setAnchorElMenu] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { setReplyingMessage, replyingMessage } = useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);
  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  const audio = useAudioRecording(ticketId, setLoading);
  const mediaUpload = useMediaUpload(setLoading);
  const mentions = useMentions();
  // Tipos interativos (botões, lista, mídia, enquete, carousel, pix) são despachados
  // server-side: o frontend só envia quickAnswerId + ticketId. O texto da mensagem
  // aparece via SSE. Texto puro é inserido no input (tratado em useQuickAnswers).
  const quickAnswersHook = useQuickAnswers((qa) => {
    if (!ticketId) return;
    api
      .post(`/quickAnswers/${qa.id}/send`, { ticketId: Number(ticketId) })
      .catch(toastError);
  });

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [replyingMessage]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      mediaUpload.clearMedias();
      setReplyingMessage(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleChangeInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    void (async () => {
      const handledQuick = await quickAnswersHook.loadQuickAnswers(value);
      if (!handledQuick) {
        await mentions.loadMentions(ticketId, value);
      }
    })();
  };

  const handleAddEmoji = (e: { native: string }) => {
    setInputMessage((prev) => prev + e.native);
  };

  const handleChangeMedias = (e: React.ChangeEvent<HTMLInputElement>) => {
    mediaUpload.handleChangeMedias(e, inputMessage, () => setInputMessage(""));
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    mediaUpload.handleInputPaste(e, inputMessage, () => setInputMessage(""));
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;
    setLoading(true);

    let mentionedIds: string[] = [];
    let finalBody = inputMessage;

    if (inputMessage.includes("@")) {
      try {
        const { data: participants } = await api.get<Array<{ number: string; name?: string }>>(
          `/tickets/${ticketId}/participants`
        );
        const { data: ticket } = await api.get(`/tickets/${ticketId}`);
        const groupName = ticket.contact.name as string | undefined;

        if (groupName && inputMessage.includes(`@${groupName}`)) {
          mentionedIds.push(...participants.map((p) => p.number + "@s.whatsapp.net"));
          finalBody = finalBody.replace(`@${groupName}`, "").trim();
        }
        participants.forEach((p) => {
          if (inputMessage.includes(`@${p.name}`) || inputMessage.includes(`@${p.number}`)) {
            mentionedIds.push(p.number + "@s.whatsapp.net");
          }
        });
        mentionedIds = [...new Set(mentionedIds)];
      } catch (err) {
        console.error("Error resolving mentions", err);
      }
    }

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage ? `*${user?.name}:*\n${finalBody}` : finalBody,
      quotedMsg: replyingMessage,
      mentionedIds,
    };

    try {
      await api.post(`/messages/${ticketId}`, message);
      setInputMessage("");
      setShowEmoji(false);
      setLoading(false);
      setReplyingMessage(null);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const focusInput = () => inputRef.current?.focus();

  return {
    ticketId,
    inputMessage,
    setInputMessage,
    showEmoji,
    setShowEmoji,
    loading,
    anchorElMenu,
    setAnchorElMenu,
    inputRef,
    replyingMessage: replyingMessage as Record<string, unknown> | null,
    setReplyingMessage,
    user,
    signMessage,
    setSignMessage,
    // audio recording
    recording: audio.recording,
    handleStartRecording: audio.handleStartRecording,
    handleUploadAudio: audio.handleUploadAudio,
    handleCancelAudio: audio.handleCancelAudio,
    // media upload
    medias: mediaUpload.medias,
    handleChangeMedias,
    handleInputPaste,
    handleMediaCaptionChange: mediaUpload.handleMediaCaptionChange,
    handleUploadMedia: (e?: React.FormEvent) => mediaUpload.handleUploadMedia(ticketId, e),
    handleRemoveMedia: mediaUpload.handleRemoveMedia,
    handleClearMedias: mediaUpload.clearMedias,
    // mentions
    mentions: mentions.mentions,
    mentionOpen: mentions.mentionOpen,
    handleMentionClick: (contact: import("./useMentions").Participant) =>
      mentions.handleMentionClick(contact, inputMessage, setInputMessage, focusInput),
    // quick answers
    quickAnswers: quickAnswersHook.quickAnswers,
    typeBar: quickAnswersHook.typeBar,
    handleQuickAnswersClick: (qa: import("./useQuickAnswers").QuickAnswer) =>
      quickAnswersHook.handleQuickAnswersClick(qa, setInputMessage),
    // text & emoji
    handleChangeInput,
    handleAddEmoji,
    handleSendMessage,
  };
};
