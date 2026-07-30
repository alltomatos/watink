import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

interface TicketHeaderProps {
  loading?: boolean;
  children?: React.ReactNode;
}

const TicketHeader: React.FC<TicketHeaderProps> = ({ loading, children }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/tickets");
  };

  if (loading) {
    return <TicketHeaderSkeleton />;
  }

  return (
    <Card
      className={cn(
        "flex flex-none items-center rounded-none border-b border-[var(--border-divider)]",
        "bg-[var(--border-default)]",
        "flex-wrap sm:flex-nowrap"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        aria-label="Voltar para tickets"
        className="shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      {children}
    </Card>
  );
};

export default TicketHeader;
