import React, { useState } from "react";
import LocationPreview from "../../LocationPreview";
import VcardPreview from "../../VcardPreview";
import ModalImageCors from "../../ModalImageCors";
import Audio from "../../Audio";
import FilePreview from "../../FilePreview";
import { getBackendUrl } from "../../../helpers/urlUtils";
import { parseData } from "../utils/messageHelpers";
import OnDemandMediaPreview from "./OnDemandMediaPreview";
import AudioTranscribeButton from "./AudioTranscribeButton";
import { Message } from "../types";

interface Props {
  message: Message;
}

const DOWNLOADABLE_TYPES = ["image", "video", "audio", "document", "sticker"];

const MessageMedia: React.FC<Props> = ({ message }) => {
  // Local override so the transcription appears immediately on click,
  // without waiting for the SSE appMessage round-trip to update the parent's
  // message list state.
  const [localTranscription, setLocalTranscription] = useState<string | null>(
    null
  );

  // Pending media: a downloadable type with no stored URL yet → show the blurred
  // thumbnail + download button instead of blocking on a full download.
  if (!message.mediaUrl && DOWNLOADABLE_TYPES.includes(message.mediaType ?? "")) {
    return <OnDemandMediaPreview message={message} />;
  }

  if (message.mediaType === "location" && message.body.split("|").length >= 2) {
    const [imageLocation, linkLocation, descriptionLocation] =
      message.body.split("|");
    return (
      <LocationPreview
        image={imageLocation}
        link={linkLocation}
        description={descriptionLocation ?? null}
      />
    );
  }

  if (message.mediaType === "vcard") {
    const array = message.body.split("\n");
    const obj: { number: string }[] = [];
    let contact = "";
    for (let i = 0; i < array.length; i++) {
      const values = array[i].split(":");
      for (let j = 0; j < values.length; j++) {
        if (values[j].indexOf("+") !== -1) obj.push({ number: values[j] });
        if (values[j].indexOf("FN") !== -1) contact = values[j + 1];
      }
    }
    return <VcardPreview contact={contact} numbers={obj[0]?.number} />;
  }

  if (
    message.mediaType === "image" ||
    message.mediaType === "sticker"
  ) {
    return (
      <ModalImageCors imageUrl={getBackendUrl(message.mediaUrl) ?? ""} />
    );
  }

  if (message.mediaType === "audio") {
    const audioData = parseData(message.dataJson);
    const mimetype = typeof audioData?.mimetype === "string" ? audioData.mimetype : undefined;
    const transcription = localTranscription ?? message.transcription;
    return (
      <div>
        <Audio url={getBackendUrl(message.mediaUrl) ?? ""} mimetype={mimetype} />
        {transcription ? (
          <p className="mt-1 max-w-[300px] whitespace-pre-wrap text-xs italic text-[var(--text-muted)]">
            {transcription}
          </p>
        ) : (
          <AudioTranscribeButton
            message={message}
            onTranscribed={setLocalTranscription}
          />
        )}
      </div>
    );
  }

  if (message.mediaType === "video") {
    return (
      <div className="relative w-full max-w-[300px] rounded-lg overflow-hidden">
        <video
          src={getBackendUrl(message.mediaUrl)}
          controls
          className="w-full h-auto max-h-[300px] object-contain bg-[var(--bg-surface)]"
        />
      </div>
    );
  }

  if (message.mediaType === "carousel") {
    const data = parseData(message.dataJson);
    if (data?.cards && Array.isArray(data.cards)) {
      return (
        <div className="flex overflow-x-auto max-w-[350px] gap-2.5 pb-2.5 pt-1.5">
          {(
            data.cards as Array<{
              headerUrl?: string;
              title?: string;
              body?: string;
              buttons?: Array<{ text?: string; url?: string }>;
            }>
          ).map((card, idx) => (
            <div
              key={idx}
              className="min-w-[220px] bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] overflow-hidden shadow-sm"
            >
              {card.headerUrl && (
                <img
                  src={card.headerUrl}
                  className="w-full h-[120px] object-cover"
                  alt={card.title}
                />
              )}
              <div className="p-2">
                <div className="font-bold text-[13px] mb-1">{card.title}</div>
                <div className="text-xs text-[hsl(var(--message-quote-text))] whitespace-pre-wrap">
                  {card.body}
                </div>
              </div>
              {card.buttons && card.buttons.length > 0 && (
                <div className="border-t border-[var(--border-default)] p-1.5">
                  {card.buttons.map((btn, bIdx) => (
                    <div
                      key={bIdx}
                      className="text-xs text-center text-[var(--action-primary)] py-1 cursor-pointer"
                      onClick={() => btn.url && window.open(btn.url, "_blank")}
                    >
                      {btn.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    <FilePreview
      mediaUrl={getBackendUrl(message.mediaUrl) ?? ""}
      filename={message.body}
    />
  );
};

export default MessageMedia;
