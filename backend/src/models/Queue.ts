import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  DataType,
  Default,
  HasMany
} from "sequelize-typescript";
import User from "./User";
import UserQueue from "./UserQueue";
import Tenant from "./Tenant";

import Whatsapp from "./Whatsapp";
import WhatsappQueue from "./WhatsappQueue";

// Distribution strategy constants
export const DISTRIBUTION_STRATEGIES = {
  MANUAL: "MANUAL",
  AUTO_ROUND_ROBIN: "AUTO_ROUND_ROBIN",
  AUTO_BALANCED: "AUTO_BALANCED"
} as const;

export type DistributionStrategy = typeof DISTRIBUTION_STRATEGIES[keyof typeof DISTRIBUTION_STRATEGIES];

@Table
class Queue extends Model<Queue> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  color: string;

  @Column
  greetingMessage: string;

  @AllowNull(false)
  @Default("MANUAL")
  @Column(DataType.STRING(50))
  distributionStrategy: DistributionStrategy;

  @AllowNull(false)
  @Default(false)
  @Column
  prioritizeWallet: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsToMany(() => Whatsapp, () => WhatsappQueue)
  whatsapps: Array<Whatsapp & { WhatsappQueue: WhatsappQueue }>;

  @BelongsToMany(() => User, () => UserQueue)
  users: Array<User & { UserQueue: UserQueue }>;

  @ForeignKey(() => Tenant)
  @Column(DataType.UUID)
  tenantId: number | string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  // Note: Steps association will be added after Step model is created
  // @HasMany(() => Step)
  // steps: Step[];
}

export default Queue;

