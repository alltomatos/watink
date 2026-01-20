import Client from "../../models/Client";
import ClientContact from "../../models/ClientContact";
import ClientAddress from "../../models/ClientAddress";
import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";

interface CreateClientData {
    tenantId: string | number;
    type: string;
    name: string;
    document?: string;
    email?: string;
    phone?: string;
    notes?: string;
    contacts?: Array<{
        name: string;
        role?: string;
        phone?: string;
        email?: string;
        contactId?: number;
        isPrimary?: boolean;
    }>;
    addresses?: Array<{
        label?: string;
        zipCode?: string;
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        isPrimary?: boolean;
    }>;
}

const CreateClientService = async (data: CreateClientData): Promise<Client> => {
    const { contacts, addresses, ...clientData } = data;

    const client = await Client.create(clientData);

    if (contacts && contacts.length > 0) {
        const contactsWithClientId = [];

        for (const contact of contacts) {
            let contactId = contact.contactId;

            if (!contactId && contact.phone) {
                const existingContact = await Contact.findOne({
                    where: { number: contact.phone, tenantId: clientData.tenantId }
                });

                if (existingContact) {
                    contactId = existingContact.id;
                } else {
                    const newContact = await Contact.create({
                        name: contact.name,
                        number: contact.phone,
                        email: contact.email || "",
                        tenantId: clientData.tenantId
                    });
                    contactId = newContact.id;
                }
            }

            contactsWithClientId.push({
                ...contact,
                contactId,
                clientId: client.id
            });
        }

        await ClientContact.bulkCreate(contactsWithClientId);
    }

    if (addresses && addresses.length > 0) {
        const addressesWithClientId = addresses.map(a => ({
            ...a,
            clientId: client.id
        }));
        await ClientAddress.bulkCreate(addressesWithClientId);
    }

    const fullClient = await Client.findByPk(client.id, {
        include: [
            { model: ClientContact, as: "contacts" },
            { model: ClientAddress, as: "addresses" }
        ]
    });

    return fullClient!;
};

export default CreateClientService;
