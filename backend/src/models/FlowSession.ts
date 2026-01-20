import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Flow from "./Flow";

@Table
class FlowSession extends Model<FlowSession> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Flow)
  @Column
  flowId: number;

  @BelongsTo(() => Flow)
  flow: Flow;

  @Column
  currentStepId: string;

  @Column({ defaultValue: "active" })
  status: string; // active, completed, failed, paused

  @Column({
    type: DataType.JSONB,
    defaultValue: {}
  })
  context: object; // Variables, inputs, etc.

  @Column
  entityId: number;

  @Column
  entityType: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowSession;
