import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    DataType,
    PrimaryKey,
    ForeignKey,
    BelongsTo,
    Default,
    AllowNull
} from "sequelize-typescript";
import Tenant from "./Tenant";

@Table({ tableName: "TenantSmtpSettings" })
class TenantSmtpSettings extends Model<TenantSmtpSettings> {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @Column(DataType.STRING)
    host: string;

    @Default(587)
    @Column(DataType.INTEGER)
    port: number;

    @Column(DataType.STRING)
    user: string;

    @Column(DataType.TEXT)
    password: string;

    @Default(false)
    @Column(DataType.BOOLEAN)
    secure: boolean;

    @Column(DataType.STRING)
    emailFrom: string;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;

    @BelongsTo(() => Tenant)
    tenant: Tenant;
}

export default TenantSmtpSettings;
