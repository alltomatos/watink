import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  BeforeCreate,
  BeforeUpdate,
  PrimaryKey,
  AutoIncrement,
  Default,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  AllowNull
} from "sequelize-typescript";
import { hash, compare } from "bcryptjs";
import Ticket from "./Ticket";
import Queue from "./Queue";
import UserQueue from "./UserQueue";
import Whatsapp from "./Whatsapp";
import Tenant from "./Tenant";
import Group from "./Group";
import Role from "./Role";
import UserRole from "./UserRole";
import UserGroup from "./UserGroup";
import Contact from "./Contact";
import Permission from "./Permission";
import UserPermission from "./UserPermission";

@Table
class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  email: string;

  @Column
  profileImage: string;

  @Column(DataType.VIRTUAL)
  password: string;

  @Column
  passwordHash: string;

  @Default(0)
  @Column
  tokenVersion: number;

  @Default("admin")
  @Column
  profile: string;

  @Default(true)
  @Column
  enabled: boolean;

  @Default(false)
  @Column
  emailVerified: boolean;

  @AllowNull(true)
  @Column
  lastAssignmentAt: Date;

  @AllowNull(true)
  @Column
  verificationToken: string;

  @AllowNull(true)
  @Column
  passwordResetToken: string;

  @AllowNull(true)
  @Column
  passwordResetExpires: Date;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => Contact, "walletUserId")
  walletContacts: Contact[];

  @BelongsToMany(() => Queue, () => UserQueue)
  queues: Queue[];

  @ForeignKey(() => Tenant)
  @Column(DataType.UUID)
  tenantId: number | string;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsToMany(() => Group, () => UserGroup)
  groups: Group[];

  @BelongsToMany(() => Role, () => UserRole)
  roles: Role[];

  @BelongsToMany(() => Permission, () => UserPermission)
  permissions: Permission[];

  @BeforeUpdate
  @BeforeCreate
  static hashPassword = async (instance: User): Promise<void> => {
    if (instance.password) {
      instance.passwordHash = await hash(instance.password, 8);
    }
  };

  public checkPassword = async (password: string): Promise<boolean> => {
    return compare(password, this.getDataValue("passwordHash"));
  };
}

export default User;
