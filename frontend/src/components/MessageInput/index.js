import React, { useState, useEffect, useContext, useRef } from "react";
import "emoji-mart/css/emoji-mart.css";
import { useParams } from "react-router-dom";
import { Picker } from "emoji-mart";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoreVert from "@material-ui/icons/MoreVert";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import {
  FormControlLabel,
  Hidden,
  Menu,
  MenuItem,
  Switch,
} from "@material-ui/core";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useThemeContext } from "../../context/DarkMode";
import toastError from "../../errors/toastError";

let Mp3Recorder = null;

const initRecorder = async () => {
  if (!Mp3Recorder) {
    try {
      const MicRecorder = (await import("mic-recorder-to-mp3")).default;
      Mp3Recorder = new MicRecorder({ bitRate: 128 });
    } catch (error) {
      console.error("Failed to initialize recorder:", error);
      return null;
    }
  }
  return Mp3Recorder;
};

const useStyles = makeStyles(theme => ({
  mainWrapper: {
    background: "#eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    [theme.breakpoints.down("sm")]: {
      position: "fixed",
      bottom: 0,
      width: "100%",
    },
  },

  newMessageBox: {
    background: "#eee",
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
  },

  messageInputWrapper: {
    padding: 6,
    marginRight: 7,
    background: "#fff",
    display: "flex",
    borderRadius: 20,
    flex: 1,
    position: "relative",
  },

  messageInputWrapperSaas: {
    padding: 6,
    marginRight: 7,
    background: "#fff",
    display: "flex",
    borderRadius: 20,
    flex: 1,
    position: "relative",
    border: "1px solid #e5e7eb",
    boxShadow: "none",
  },

  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
  },

  sendMessageIcons: {
    color: "grey",
  },

  uploadInput: {
    display: "none",
  },

  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eee",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },

  previewMediaWrapper: {
    display: "flex",
    flexDirection: "column",
    padding: "8px",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#eee",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },
  previewMediaContainer: {
    display: "flex",
    overflowX: "auto",
    width: "100%",
    marginBottom: "10px",
    gap: "10px",
    "&::-webkit-scrollbar": {
      height: "6px",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: "3px",
    },
  },
  previewMediaItem: {
    position: "relative",
    minWidth: "150px",
    height: "180px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    marginRight: "10px",
  },
  previewMediaImage: {
    width: "100%",
    height: "120px",
    objectFit: "cover",
  },
  previewMediaInput: {
    width: "100%",
    padding: "4px",
    fontSize: "12px",
    border: "none",
    borderTop: "1px solid #ddd",
    outline: "none",
    height: "60px",
    resize: "none",
  },
  previewMediaRemoveIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    color: "red",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: "0 0 0 4px",
    padding: "2px",
    cursor: "pointer",
    zIndex: 1,
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.9)",
    },
  },
  previewMediaInputWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "10px",
  },

  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
  },

  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },

  audioLoading: {
    color: green[500],
    opacity: "70%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },

  cancelAudioIcon: {
    color: "red",
  },

  sendAudioIcon: {
    color: "green",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
  messageQuickAnswersWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "50px",
    background: "#ffffff",
    padding: "2px",
    border: "1px solid #CCC",
    left: 0,
    width: "100%",
    "& li": {
      listStyle: "none",
      "& a": {
        display: "block",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "32px",
        "&:hover": {
          background: "#F1F1F1",
          cursor: "pointer",
        },
      },
    },
  },

  messageMentionsWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "50px",
    background: "#ffffff",
    padding: "2px",
    border: "1px solid #CCC",
    left: 0,
    width: "100%",
    zIndex: 9999,
    maxHeight: "200px",
    overflowY: "auto",
    "& li": {
      listStyle: "none",
      "& a": {
        display: "flex",
        alignItems: "center",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "45px",
        borderBottom: "1px solid #eee",
        "&:hover": {
          background: "#F1F1F1",
          cursor: "pointer",
        },
      },
      "& img": {
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        marginRight: "10px",
      }
    },
  },
}));

const MessageInput = ({ ticketStatus, whatsappStatus }) => {
  const classes = useStyles();
  const { ticketId } = useParams();

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);
  const { appTheme } = useThemeContext();

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [replyingMessage]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  const handleChangeInput = e => {
    setInputMessage(e.target.value);
    handleLoadQuickAnswer(e.target.value);
  };

  const handleQuickAnswersClick = value => {
    setInputMessage(value);
    setTypeBar(false);
  };

  const handleAddEmoji = e => {
    let emoji = e.native;
    setInputMessage(prevState => prevState + emoji);
  };

  const handleChangeMedias = e => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files).map((file, index) => {
      let caption = "";
      if (index === 0 && medias.length === 0 && inputMessage) {
        caption = inputMessage;
      }
      return {
        file,
        caption
      };
    });

    if (medias.length === 0 && inputMessage) {
      setInputMessage("");
    }

    setMedias(prev => [...prev, ...selectedMedias]);
  };

  const handleInputPaste = e => {
    if (e.clipboardData.files[0]) {
      const caption = medias.length === 0 && inputMessage ? inputMessage : "";
      setMedias(prev => [...prev, { file: e.clipboardData.files[0], caption }]);

      if (medias.length === 0 && inputMessage) {
        setInputMessage("");
      }
    }
  };

  const handleMediaCaptionChange = (index, value) => {
    setMedias(prev => prev.map((media, i) =>
      i === index ? { ...media, caption: value } : media
    ));
  };

  const handleUploadMedia = async e => {
    setLoading(true);
    if (e) e.preventDefault();

    const formData = new FormData();
    formData.append("fromMe", true);

    medias.forEach(media => {
      formData.append("medias", media.file);
      formData.append("body", media.caption); // Send caption for each file
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);
      setMedias([]);
      setInputMessage("");
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
  };

  const handleRemoveMedia = (index) => {
    setMedias(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;
    setLoading(true);

    let mentionedIds = [];
    if (inputMessage.includes("@")) {
      try {
        // Fetch participants and ticket to resolve mentions
        const { data: participants } = await api.get(`/tickets/${ticketId}/participants`);
        const { data: ticket } = await api.get(`/tickets/${ticketId}`);

        const groupName = ticket.contact.name;

        // 1. Ghost Mention Check (@GroupName)
        if (groupName && inputMessage.includes(`@${groupName}`)) {
          const allIds = participants.map(p => p.number + "@s.whatsapp.net");
          mentionedIds.push(...allIds);
        }

        // 2. Regular Mention Check (@Name or @Number)
        participants.forEach(p => {
          const mentionName = `@${p.name}`;
          const mentionNumber = `@${p.number}`;

          if (inputMessage.includes(mentionName) || inputMessage.includes(mentionNumber)) {
            mentionedIds.push(p.number + "@s.whatsapp.net");
          }
        });

        // Deduplicate
        mentionedIds = [...new Set(mentionedIds)];

      } catch (err) {
        console.error("Error resolving mentions", err);
      }
    }

    // Prepare body: Remove @GroupName if it was a Ghost Mention
    let finalBody = inputMessage;
    if (inputMessage.includes("@")) {
      try {
        const { data: ticket } = await api.get(`/tickets/${ticketId}`);
        const groupName = ticket.contact.name;
        if (groupName && inputMessage.includes(`@${groupName}`)) {
          finalBody = finalBody.replace(`@${groupName}`, "").trim();
        }
      } catch (err) {
        console.error(err);
      }
    }

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${finalBody}`
        : finalBody,
      quotedMsg: replyingMessage,
      mentionedIds
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

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const [mentions, setMentions] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAnchorEl, setMentionAnchorEl] = useState(null);

  const handleLoadQuickAnswer = async value => {
    if (value && value.indexOf("/") === 0) {
      try {
        const { data } = await api.get("/quickAnswers/", {
          params: { searchParam: inputMessage.substring(1) },
        });
        setQuickAnswer(data.quickAnswers);
        if (data.quickAnswers.length > 0) {
          setTypeBar(true);
        } else {
          setTypeBar(false);
        }
      } catch (err) {
        setTypeBar(false);
      }
    } else if (value && value.lastIndexOf("@") === value.length - 1) {
      // Trigger mention list
      try {
        const { data } = await api.get(`/tickets/${ticketId}/participants`);
        setMentions(data);
        if (data.length > 0) {
          setMentionOpen(true);
        }
      } catch (err) {
        toastError(err);
      }
    } else if (mentionOpen && (value.lastIndexOf("@") < 0 || value.length < inputMessage.length)) {
      // Close mention list if @ is removed
      if (value.lastIndexOf("@") === -1) {
        setMentionOpen(false);
      }
    }
    else {
      setTypeBar(false);
      // We don't close mentionOpen here immediately to allow filtering - logic can be improved
    }
  };

  const handleMentionClick = (contact) => {
    // Replace the last @ with @<name> 
    const newValue = inputMessage.substring(0, inputMessage.lastIndexOf("@")) + `@${contact.name || contact.number} `;
    setInputMessage(newValue);
    setMentionOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      const [, blob] = await recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = `${new Date().getTime()}.mp3`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      const recorder = await initRecorder();
      if (recorder) {
        await recorder.stop().getMp3();
      }
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = event => {
    setAnchorEl(null);
  };

  const renderReplyingMessage = message => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {(() => {
                  let pushName = null;
                  let participantNumber = null;

                  if (message.dataJson) {
                    try {
                      const data = typeof message.dataJson === 'string' ? JSON.parse(message.dataJson) : message.dataJson;
                      pushName = data.pushName;
                    } catch (e) { }
                  }

                  if (message.participant) {
                    participantNumber = message.participant.replace(/\D/g, "");
                  }

                  if (pushName) return `~${pushName}`;
                  if (participantNumber) return `~${participantNumber}`;

                  return message.contact?.name;
                })()}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (ticketStatus !== "open") {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        <div className={classes.newMessageBox}>
          <span style={{ fontSize: "16px", padding: "10px", margin: "0 auto", color: "gray" }}>
            {i18n.t("messagesInput.placeholderClosed")}
          </span>
        </div>
      </Paper>
    );
  }

  if (whatsappStatus && whatsappStatus !== "CONNECTED") {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        <div className={classes.newMessageBox}>
          <div style={{ padding: "10px", width: "100%", textAlign: "center", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "5px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontWeight: "bold", fontSize: "14px" }}>CONEXÃO INTERROMPIDA</span>
            <span style={{ fontSize: "12px", marginTop: "5px" }}>Não é possível enviar mensagens. Por favor, vá em "Conexões" e reconecte o WhatsApp.</span>
          </div>
        </div>
      </Paper>
    );
  }

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.previewMediaWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={e => setMedias([])}
          style={{ alignSelf: "flex-end", padding: "4px" }}
        >
          <CancelIcon className={classes.sendMessageIcons} />
        </IconButton>

        <div className={classes.previewMediaContainer}>
          {medias.map((media, index) => (
            <div key={index} className={classes.previewMediaItem}>
              {loading ? (
                <CircularProgress className={classes.circleLoading} size={20} />
              ) : (
                <>
                  <div
                    className={classes.previewMediaRemoveIcon}
                    onClick={() => handleRemoveMedia(index)}
                  >
                    <CancelIcon style={{ fontSize: 16 }} />
                  </div>
                  {media.file.type.startsWith("image/") ? (
                    <img
                      src={URL.createObjectURL(media.file)}
                      alt="preview"
                      className={classes.previewMediaImage}
                    />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5px", fontSize: "10px", textAlign: "center", height: "120px", justifyContent: "center" }}>
                      <AttachFileIcon style={{ fontSize: 40, color: "#888" }} />
                      <span style={{ maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {media.file.name}
                      </span>
                    </div>
                  )}
                  <textarea
                    className={classes.previewMediaInput}
                    placeholder={i18n.t("messagesInput.placeholderOpen")}
                    value={media.caption}
                    onChange={(e) => handleMediaCaptionChange(index, e.target.value)}
                  />
                </>
              )}
            </div>
          ))}

          {/* Add more button */}
          {!loading && (
            <div
              className={classes.previewMediaItem}
              style={{ borderStyle: "dashed", cursor: "pointer", alignItems: "center", justifyContent: "center" }}
            >
              <input
                multiple
                type="file"
                id="add-more-media"
                className={classes.uploadInput}
                onChange={handleChangeMedias}
              />
              <label htmlFor="add-more-media" style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
                <AttachFileIcon style={{ fontSize: 30, color: "#aaa" }} />
              </label>
            </div>
          )}
        </div>

        <div className={classes.previewMediaInputWrapper}>
          <IconButton
            aria-label="send-upload"
            component="span"
            onClick={handleUploadMedia}
            disabled={loading}
            style={{ marginLeft: "auto" }}
          >
            <SendIcon className={classes.sendMessageIcons} />
          </IconButton>
        </div>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <Hidden only={["sm", "xs"]}>
            <IconButton
              aria-label="emojiPicker"
              component="span"
              disabled={loading || recording || ticketStatus !== "open"}
              onClick={e => setShowEmoji(prevState => !prevState)}
            >
              <MoodIcon className={classes.sendMessageIcons} />
            </IconButton>
            {showEmoji ? (
              <div className={classes.emojiBox}>
                <ClickAwayListener onClickAway={e => setShowEmoji(false)}>
                  <Picker
                    perLine={16}
                    showPreview={false}
                    showSkinTones={false}
                    onSelect={handleAddEmoji}
                  />
                </ClickAwayListener>
              </div>
            ) : null}

            <input
              multiple
              type="file"
              id="upload-button"
              disabled={loading || recording || ticketStatus !== "open"}
              className={classes.uploadInput}
              onChange={handleChangeMedias}
            />
            <label htmlFor="upload-button">
              <IconButton
                aria-label="upload"
                component="span"
                disabled={loading || recording || ticketStatus !== "open"}
              >
                <AttachFileIcon className={classes.sendMessageIcons} />
              </IconButton>
            </label>
            <FormControlLabel
              style={{ marginRight: 7, color: "gray" }}
              label={i18n.t("messagesInput.signMessage")}
              labelPlacement="start"
              control={
                <Switch
                  size="small"
                  checked={signMessage}
                  onChange={e => {
                    setSignMessage(e.target.checked);
                  }}
                  name="showAllTickets"
                  color="primary"
                />
              }
            />
          </Hidden>
          <Hidden only={["md", "lg", "xl"]}>
            <IconButton
              aria-controls="simple-menu"
              aria-haspopup="true"
              onClick={handleOpenMenuClick}
            >
              <MoreVert></MoreVert>
            </IconButton>
            <Menu
              id="simple-menu"
              keepMounted
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuItemClick}
            >
              <MenuItem onClick={handleMenuItemClick}>
                <IconButton
                  aria-label="emojiPicker"
                  component="span"
                  disabled={loading || recording || ticketStatus !== "open"}
                  onClick={e => setShowEmoji(prevState => !prevState)}
                >
                  <MoodIcon className={classes.sendMessageIcons} />
                </IconButton>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-button"
                  disabled={loading || recording || ticketStatus !== "open"}
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-button">
                  <IconButton
                    aria-label="upload"
                    component="span"
                    disabled={loading || recording || ticketStatus !== "open"}
                  >
                    <AttachFileIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </label>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <FormControlLabel
                  style={{ marginRight: 7, color: "gray" }}
                  label={i18n.t("messagesInput.signMessage")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={signMessage}
                      onChange={e => {
                        setSignMessage(e.target.checked);
                      }}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              </MenuItem>
            </Menu>
          </Hidden>
          <div className={appTheme === "saas" ? classes.messageInputWrapperSaas : classes.messageInputWrapper}>
            <InputBase
              inputRef={input => {
                input && input.focus();
                input && (inputRef.current = input);
              }}
              className={classes.messageInput}
              placeholder={
                ticketStatus === "open"
                  ? i18n.t("messagesInput.placeholderOpen")
                  : i18n.t("messagesInput.placeholderClosed")
              }
              multiline
              maxRows={5}
              value={inputMessage}
              onChange={handleChangeInput}
              disabled={recording || loading || ticketStatus !== "open"}
              onPaste={e => {
                ticketStatus === "open" && handleInputPaste(e);
              }}
              onKeyPress={e => {
                if (loading || e.shiftKey) return;
                else if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
            {typeBar ? (
              <ul className={classes.messageQuickAnswersWrapper}>
                {quickAnswers.map((value, index) => {
                  return (
                    <li
                      className={classes.messageQuickAnswersWrapperItem}
                      key={index}
                    >
                      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                      <a onClick={() => handleQuickAnswersClick(value.message)}>
                        {`${value.shortcut} - ${value.message}`}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {mentionOpen && (
              <ul className={classes.messageMentionsWrapper}>
                {mentions.map((contact, index) => (
                  <li key={index} onClick={() => handleMentionClick(contact)}>
                    <a>
                      {contact.profilePicUrl && (
                        <img
                          src={contact.profilePicUrl}
                          alt={contact.name}
                        />
                      )}
                      {contact.name || contact.number}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {inputMessage ? (
            <IconButton
              aria-label="sendMessage"
              component="span"
              onClick={handleSendMessage}
              disabled={loading}
            >
              <SendIcon className={classes.sendMessageIcons} />
            </IconButton>
          ) : recording ? (
            <div className={classes.recorderWrapper}>
              <IconButton
                aria-label="cancelRecording"
                component="span"
                fontSize="large"
                disabled={loading}
                onClick={handleCancelAudio}
              >
                <HighlightOffIcon className={classes.cancelAudioIcon} />
              </IconButton>
              {loading ? (
                <div>
                  <CircularProgress className={classes.audioLoading} />
                </div>
              ) : (
                <RecordingTimer />
              )}

              <IconButton
                aria-label="sendRecordedAudio"
                component="span"
                onClick={handleUploadAudio}
                disabled={loading}
              >
                <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
              </IconButton>
            </div>
          ) : (
            <IconButton
              aria-label="showRecorder"
              component="span"
              disabled={loading || ticketStatus !== "open"}
              onClick={handleStartRecording}
            >
              <MicIcon className={classes.sendMessageIcons} />
            </IconButton>
          )}
        </div>
      </Paper>
    );
  }
};

export default MessageInput;
