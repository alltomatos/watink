import {
    Table,
    Column,
    CreatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    DataType,
} from "sequelize-typescript";
import Protocol from "./Protocol";
import User from "./User";

@Table({ tableName: "ProtocolHistories", updatedAt: false })
class ProtocolHistory extends Model<ProtocolHistory> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Protocol)
    @Column
    protocolId: number;

    @BelongsTo(() => Protocol)
    protocol: Protocol;

    @ForeignKey(() => User)
    @Column
    userId: number;

    @BelongsTo(() => User)
    user: User;

    @Column(DataType.STRING(50))
    action: string; // created, status_changed, assigned, commented, resolved, closed

    @Column(DataType.STRING(255))
    previousValue: string;

    @Column(DataType.STRING(255))
    newValue: string;

    @Column(DataType.TEXT)
    comment: string;

    @Column(DataType.TEXT)
    changes: string;

    @CreatedAt
    createdAt: Date;
}

export default ProtocolHistory;
