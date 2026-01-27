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
    Default,
    AllowNull
} from "sequelize-typescript";
import Tenant from "./Tenant";
import TagGroup from "./TagGroup";
import User from "./User";

/**
 * Paleta de cores predefinidas para tags
 * Cores harmonizadas para UX consistente
 */
export const TAG_COLORS = {
    red: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
    orange: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
    amber: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    yellow: { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
    lime: { bg: '#ECFCCB', text: '#3F6212', border: '#D9F99D' },
    green: { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
    emerald: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    teal: { bg: '#CCFBF1', text: '#115E59', border: '#99F6E4' },
    cyan: { bg: '#CFFAFE', text: '#155E75', border: '#A5F3FC' },
    sky: { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' },
    blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
    indigo: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
    violet: { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
    purple: { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
    fuchsia: { bg: '#FAE8FF', text: '#86198F', border: '#F5D0FE' },
    pink: { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
    rose: { bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3' },
    gray: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

export type TagColorKey = keyof typeof TAG_COLORS;

@Table({
    tableName: "Tags",
    indexes: [
        { unique: true, fields: ['tenantId', 'name'] }
    ]
})
class Tag extends Model<Tag> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Tenant)
    @Column(DataType.UUID)
    tenantId: string;

    @BelongsTo(() => Tenant)
    tenant: Tenant;

    @ForeignKey(() => TagGroup)
    @AllowNull(true)
    @Column
    groupId: number;

    @BelongsTo(() => TagGroup)
    group: TagGroup;

    @Column(DataType.STRING(100))
    name: string;

    @Default("blue")
    @Column(DataType.STRING(20))
    color: string;

    @AllowNull(true)
    @Column(DataType.STRING(50))
    icon: string;

    @AllowNull(true)
    @Column(DataType.STRING(255))
    description: string;

    @Default(false)
    @Column
    archived: boolean;

    @Default(0)
    @Column
    usageCount: number;

    @ForeignKey(() => User)
    @AllowNull(true)
    @Column
    createdBy: number;

    @BelongsTo(() => User)
    creator: User;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;

    /**
     * Retorna as propriedades visuais da cor
     */
    getColorStyles(): { bg: string; text: string; border: string } {
        return TAG_COLORS[this.color as TagColorKey] || TAG_COLORS.gray;
    }
}

export default Tag;
