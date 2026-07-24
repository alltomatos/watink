import React from "react";
import { format } from "date-fns";
import { ClipboardList, Paperclip, User, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import { i18n } from "../../../translate/i18n";
import AttachmentsList from "../../../components/AttachmentsList";
import type { HistoryEntry } from "../publicProtocolTypes";

const historyIcon = (action: string): React.ReactElement => {
  switch (action) {
    case "create":
      return <ClipboardList className="h-4 w-4" />;
    case "attachment":
      return <Paperclip className="h-4 w-4" />;
    case "comment":
      return <User className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

interface Attachment {
  id: number | string;
  filePath: string;
  originalName: string;
  fileType?: string;
}

const parseAttachments = (changes: string | undefined): Attachment[] => {
  if (!changes) return [];
  try {
    const parsed = JSON.parse(changes) as { files?: Attachment[] };
    return parsed.files ?? [];
  } catch {
    return [];
  }
};

interface ProtocolTimelineProps {
  history: HistoryEntry[];
}

const ProtocolTimeline: React.FC<ProtocolTimelineProps> = ({ history }) => (
  <Card className="md:col-span-3 shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">
        {i18n.t("publicProtocol.history.title")}
      </CardTitle>
    </CardHeader>
    <Separator />
    <CardContent className="pt-4">
      <ol className="relative border-l border-border space-y-6 pl-6">
        {history.map((hist) => (
          <li key={hist.id} className="relative">
            <span className="absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background text-primary">
              {historyIcon(hist.action)}
            </span>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {i18n.t(`publicProtocol.history.actions.${hist.action}`, {
                    defaultValue: hist.action,
                  })}
                </p>
                <time className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(hist.createdAt), "dd/MM HH:mm")}
                </time>
              </div>

              {hist.comment && (
                <p className="text-sm text-muted-foreground">{hist.comment}</p>
              )}

              {hist.action === "attachment" && hist.changes && (
                <AttachmentsList
                  attachments={parseAttachments(hist.changes)}
                  canDelete={false}
                  showEmpty={false}
                />
              )}

              <div className="flex items-center gap-1 pt-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {hist.user ? hist.user.name : "Sistema"}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </CardContent>
  </Card>
);

export default ProtocolTimeline;
