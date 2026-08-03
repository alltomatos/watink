import React from "react";
import { Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactAIInsightsProps } from "./contactAIInsightsTypes";
import { useContactAIInsights } from "./hooks/useContactAIInsights";
import InsightsSkeleton from "./components/InsightsSkeleton";
import InsightsEmpty from "./components/InsightsEmpty";
import SentimentCard from "./components/SentimentCard";
import TopicsCard from "./components/TopicsCard";
import SummariesCard from "./components/SummariesCard";
import ChatSection from "./components/ChatSection";

const ContactAIInsights = ({ contactId }: ContactAIInsightsProps) => {
  const {
    loading,
    insights,
    chatHistory,
    asking,
    question,
    messagesEndRef,
    setQuestion,
    fetchInsights,
    handleAsk,
    handleKeyDown,
  } = useContactAIInsights(contactId);

  if (loading) return <InsightsSkeleton />;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-default)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface)] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Assistente IA
        </span>
        <Button variant="ghost" size="icon" onClick={fetchInsights} title="Atualizar análise">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!insights ? (
          <InsightsEmpty />
        ) : (
          <>
            <SentimentCard insights={insights} />
            {insights.topTopics && insights.topTopics.length > 0 && (
              <TopicsCard topics={insights.topTopics} />
            )}
            {insights.recentSummaries && insights.recentSummaries.length > 0 && (
              <SummariesCard summaries={insights.recentSummaries} />
            )}
          </>
        )}
      </div>

      {/* Chat */}
      <ChatSection
        chatHistory={chatHistory}
        asking={asking}
        question={question}
        messagesEndRef={messagesEndRef}
        onQuestionChange={setQuestion}
        onAsk={handleAsk}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export default ContactAIInsights;
