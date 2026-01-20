import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    AllowNull,
    ForeignKey,
    BelongsTo,
    HasMany,
    DataType,
    Default
} from "sequelize-typescript";
import KnowledgeBase from "./KnowledgeBase";
import KnowledgeVector from "./KnowledgeVector";
import Tenant from "./Tenant";

@Table
class KnowledgeSource extends Model<KnowledgeSource> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => KnowledgeBase)
    @Column
    baseId: number;

    @BelongsTo(() => KnowledgeBase)
    knowledgeBase: KnowledgeBase;

    @AllowNull(false)
    @Column
    name: string;

    @AllowNull(false)
    @Default("text")
    @Column(DataType.ENUM("url", "pdf", "text"))
    type: "url" | "pdf" | "text";

    @AllowNull(true)
    @Column(DataType.TEXT)
    url: string;

    @AllowNull(true)
    @Column(DataType.TEXT)
    content: string;

    @AllowNull(true)
    @Default("pending")
    @Column(DataType.ENUM("pending", "processing", "indexed", "error"))
    status: "pending" | "processing" | "indexed" | "error";

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @HasMany(() => KnowledgeVector)
    vectors: KnowledgeVector[];

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default KnowledgeSource;
