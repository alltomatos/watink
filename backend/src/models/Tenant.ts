import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  DataType,
  HasMany,
  Default
} from "sequelize-typescript";
import User from "./User";

@Table
class Tenant extends Model<Tenant> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column
  name: string;

  @Default("active")
  @Column
  @Column
  status: string;

  @Column
  plan: string;

  @Column
  externalId: string;

  @Default(1)
  @Column
  maxUsers: number;

  @Default(1)
  @Column
  maxConnections: number;

  @Column
  ownerId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User, "tenantId")
  users: User[];
}

export default Tenant;
