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
import Tenant from "./Tenant";

@Table
class FlowTrigger extends Model<FlowTrigger> {
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
  type: string; // 'whatsapp_message', 'ticket_create', 'kanban_move'

  @Column({
    type: DataType.JSONB,
    defaultValue: {}
  })
  condition: object;

  @Column({ defaultValue: true })
  isActive: boolean;

  @ForeignKey(() => Tenant)
  @Column
  tenantId: string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowTrigger;
