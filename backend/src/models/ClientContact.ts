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
} from "sequelize-typescript";
import Client from "./Client";
import Contact from "./Contact";

@Table({ tableName: "ClientContacts" })
class ClientContact extends Model<ClientContact> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Client)
    @Column
    clientId: number;

    @BelongsTo(() => Client)
    client: Client;

    @ForeignKey(() => Contact)
    @Column
    contactId: number;

    @BelongsTo(() => Contact)
    contact: Contact;

    @Column(DataType.STRING(255))
    name: string;

    @Column(DataType.STRING(100))
    role: string; // Cargo/função

    @Column(DataType.STRING(20))
    phone: string;

    @Column(DataType.STRING(255))
    email: string;

    @Default(false)
    @Column
    isPrimary: boolean;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default ClientContact;
