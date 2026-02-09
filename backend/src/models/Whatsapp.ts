import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Tenant from "./Tenant";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Tag from "./Tag";
import EntityTag from "./EntityTag";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  session: string;

  @Column(DataType.TEXT)
  qrcode: string;

  @Column(DataType.STRING)
  number: string;

  @Column(DataType.STRING)
  profilePicUrl: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Column(DataType.TEXT)
  greetingMessage: string;

  @Column(DataType.TEXT)
  farewellMessage: string;

  @Column(DataType.TEXT)
  chatConfig: string;

  @Column(DataType.STRING)
  type: string;

  @Default('whaileys')
  @Column(DataType.ENUM('whaileys', 'whatsmeow', 'papi'))
  engineType: "whaileys" | "whatsmeow" | "papi";

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  @Column(DataType.BOOLEAN)
  syncHistory: boolean;

  @Column(DataType.TEXT)
  syncPeriod: string;

  @Default(false)
  @AllowNull
  @Column(DataType.BOOLEAN)
  keepAlive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @BelongsToMany(() => Tag, {
    through: {
      model: () => EntityTag,
      scope: {
        entityType: "whatsapp"
      }
    },
    foreignKey: "entityId",
    otherKey: "tagId",
    constraints: false
  })
  tags: Tag[];

  @ForeignKey(() => Tenant)
  @Column(DataType.UUID)
  tenantId: number | string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;
}

export default Whatsapp;
