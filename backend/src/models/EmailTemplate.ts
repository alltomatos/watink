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
import Tenant from "./Tenant";

@Table({ tableName: "EmailTemplates" })
class EmailTemplate extends Model<EmailTemplate> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column
    name: string;

    @Column
    subject: string;

    @Column(DataType.TEXT)
    html: string;

    @Column(DataType.TEXT)
    text: string;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default EmailTemplate;
