import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    Default,
    AllowNull
} from "sequelize-typescript";
import Pipeline from "./Pipeline";

@Table
class PipelineStage extends Model<PipelineStage> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column
    name: string;

    @Default('#E2E8F0')
    @Column
    color: string;

    @Default(0)
    @Column
    order: number;

    @ForeignKey(() => Pipeline)
    @Column
    pipelineId: number;

    @BelongsTo(() => Pipeline)
    pipeline: Pipeline;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default PipelineStage;
