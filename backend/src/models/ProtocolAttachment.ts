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
    DataType,
} from "sequelize-typescript";
import Protocol from "./Protocol";
import Tenant from "./Tenant";
import User from "./User";

@Table({ tableName: "ProtocolAttachments" })
class ProtocolAttachment extends Model<ProtocolAttachment> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Protocol)
    @Column
    protocolId: number;

    @BelongsTo(() => Protocol)
    protocol: Protocol;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @Column(DataType.STRING(255))
    fileName: string;

    @Column(DataType.STRING(255))
    originalName: string;

    @Column(DataType.STRING(500))
    filePath: string;

    @Column(DataType.STRING(100))
    fileType: string;

    @Column
    fileSize: number;

    @ForeignKey(() => User)
    @Column
    uploadedBy: number;

    @BelongsTo(() => User)
    user: User;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default ProtocolAttachment;
