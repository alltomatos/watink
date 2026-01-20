import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    HasMany,
    ForeignKey,
    BelongsTo,
    Default,
    AllowNull,
    DataType
} from "sequelize-typescript";
import PipelineStage from "./PipelineStage";
import Tenant from "./Tenant";

@Table
class Pipeline extends Model<Pipeline> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column
    name: string;

    @AllowNull(true)
    @Column(DataType.TEXT)
    description: string;

    @Default('kanban')
    @Column
    type: string; // 'kanban', 'funnel'

    @Default('#3B82F6')
    @Column
    color: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: number | string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @HasMany(() => PipelineStage)
    stages: PipelineStage[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default Pipeline;
