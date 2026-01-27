import {
    Table,
    Column,
    CreatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    DataType
} from "sequelize-typescript";
import Tag from "./Tag";
import User from "./User";

export type EntityType = "contact" | "ticket" | "deal" | "whatsapp";

@Table({
    tableName: "EntityTags",
    indexes: [
        { fields: ['entityType', 'entityId'] },
        { fields: ['tagId'] },
        { unique: true, fields: ['tagId', 'entityType', 'entityId'] }
    ],
    updatedAt: false // Não precisa de updatedAt, é uma relação imutável
})
class EntityTag extends Model<EntityTag> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Tag)
    @Column
    tagId: number;

    @BelongsTo(() => Tag)
    tag: Tag;

    @Column(DataType.STRING(20))
    entityType: EntityType;

    @Column
    entityId: number;

    @ForeignKey(() => User)
    @Column
    createdBy: number;

    @BelongsTo(() => User)
    creator: User;

    @CreatedAt
    createdAt: Date;
}

export default EntityTag;
