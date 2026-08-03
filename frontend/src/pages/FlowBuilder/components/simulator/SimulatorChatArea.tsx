import React from 'react';
import { Play, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SimResult } from './SimulatorTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (ts?: string) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// ─── SimulatorChatArea ────────────────────────────────────────────────────────

interface SimulatorChatAreaProps {
  result: SimResult | null;
  loading: boolean;
  testMessage: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SimulatorChatArea: React.FC<SimulatorChatAreaProps> = ({
  result,
  loading,
  testMessage,
  messagesEndRef,
  onMessageChange,
  onSend,
  onKeyDown,
}) => (
  <div className="flex flex-col flex-1 border-r overflow-hidden">
    {/* Messages */}
    <div className="flex-1 overflow-y-auto p-4 bg-[#f5f7fb] space-y-2">
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <Play className="w-12 h-12 opacity-30" />
          <p className="text-sm">Digite uma mensagem para iniciar a simulação</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Simulando fluxo...</p>
        </div>
      )}

      {result?.responses?.map((msg, idx) => (
        <div
          key={idx}
          className={cn(
            'max-w-[80%] px-3 py-2 rounded-xl shadow-sm',
            msg.type === 'user'
              ? 'ml-auto bg-[#dcf8c6] rounded-br-sm'
              : 'mr-auto bg-white rounded-bl-sm shadow-sm',
          )}
        >
          <p className="text-sm break-words">{msg.content}</p>
          {msg.options && msg.options.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {msg.options.map((opt, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                  onClick={() => onMessageChange(opt)}
                >
                  {opt}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {formatTime(msg.timestamp)}
          </p>
        </div>
      ))}

      {result && !result.success && (
        <div className="max-w-[80%] mr-auto px-3 py-2 rounded-xl bg-red-50 border border-red-200">
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {result.error}
          </p>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>

    {/* Input */}
    <div className="flex items-center gap-2 p-3 border-t bg-white shrink-0">
      <Input
        className="h-9 text-sm"
        placeholder="Digite uma mensagem para simular..."
        value={testMessage}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={loading}
      />
      <Button
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={onSend}
        disabled={loading || !testMessage.trim()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

export default SimulatorChatArea;
