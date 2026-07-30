import React from "react";
import { DropResult } from "@hello-pangea/dnd";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";
import { LayoutDashboard, GanttChartSquare, BarChart2, Filter } from "lucide-react";
import PipelineKanban from "./PipelineKanban";
import PipelineKPIs from "./PipelineKPIs";
import PipelineFunnelChart from "./PipelineFunnelChart";
import PipelineGantt from "./PipelineGantt";
import type { ComponentProps } from "react";

interface Stage {
    id: number;
    name: string;
}

interface Deal {
    id: number;
    stageId: number;
    title: string;
    value?: number | string;
    updatedAt?: string;
    contact?: { name?: string };
    createdAt: string;
}

interface ColumnData {
    items: Deal[];
}

interface Pipeline {
    stages: Stage[];
}

interface PipelineFunnelViewProps {
    pipeline?: Pipeline;
    columns: Record<string | number, ColumnData>;
    setColumns: React.Dispatch<React.SetStateAction<Record<string | number, ColumnData>>>;
    onDragEnd: (result: DropResult) => void;
    deals?: Deal[];
}

const PipelineFunnelView: React.FC<PipelineFunnelViewProps> = ({
    pipeline,
    columns,
    setColumns,
    onDragEnd,
    deals,
}) => {
    return (
        <div className="flex flex-col h-full">
            <Tabs defaultValue="board" className="flex flex-col h-full">
                <div className="border-b">
                    <TabsList className="w-full justify-start rounded-none bg-transparent h-auto p-0">
                        <TabsTrigger
                            value="board"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Quadro
                        </TabsTrigger>
                        <TabsTrigger
                            value="gantt"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
                        >
                            <GanttChartSquare className="h-4 w-4" />
                            Gantt
                        </TabsTrigger>
                        <TabsTrigger
                            value="kpis"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
                        >
                            <BarChart2 className="h-4 w-4" />
                            KPIs
                        </TabsTrigger>
                        <TabsTrigger
                            value="funnel"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm"
                        >
                            <Filter className="h-4 w-4" />
                            Funil
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-auto">
                    <TabsContent value="board" className="mt-0 h-full">
                        <PipelineKanban
                            pipeline={pipeline as ComponentProps<typeof PipelineKanban>["pipeline"]}
                            columns={columns as ComponentProps<typeof PipelineKanban>["columns"]}
                            setColumns={setColumns as ComponentProps<typeof PipelineKanban>["setColumns"]}
                            onDragEnd={onDragEnd}
                            isEnterprise={true}
                        />
                    </TabsContent>
                    <TabsContent value="gantt" className="mt-0">
                        <PipelineGantt deals={deals as ComponentProps<typeof PipelineGantt>["deals"]} />
                    </TabsContent>
                    <TabsContent value="kpis" className="mt-0">
                        <PipelineKPIs pipeline={pipeline as ComponentProps<typeof PipelineKPIs>["pipeline"]} deals={deals as ComponentProps<typeof PipelineKPIs>["deals"]} />
                    </TabsContent>
                    <TabsContent value="funnel" className="mt-0">
                        <PipelineFunnelChart pipeline={pipeline as ComponentProps<typeof PipelineFunnelChart>["pipeline"]} deals={deals as ComponentProps<typeof PipelineFunnelChart>["deals"]} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

export default PipelineFunnelView;
