import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { parse } from "csv-parse";
import Contact from "../../models/Contact";
import User from "../../models/User";
import { logger } from "../../utils/logger";
import sequelize from "../../database";

// Expected CSV columns (supports both naming conventions)
interface CsvRow {
    name: string;
    number: string;
    email?: string;
    wallet_user_email?: string;
    walletEmail?: string; // Alternative column name
}

interface ImportResult {
    total: number;
    success: number;
    errors: number;
    created: number;
    updated: number;
    errorDetails: Array<{ row: number; error: string }>;
}

interface ImportOptions {
    tenantId: string | number;
    delimiter?: string;
    skipHeader?: boolean;
    batchSize?: number;
}

interface ContactBatchItem {
    name: string;
    number: string;
    email: string;
    walletUserId: number | null;
    tenantId: string | number;
    isGroup: boolean;
    rowNumber: number;
}

const DEFAULT_BATCH_SIZE = 500;

/**
 * ImportContactsService
 * 
 * Service for bulk importing contacts from CSV files.
 * Supports wallet user assignment via email matching.
 * Uses batch insert for optimal performance with large files.
 * 
 * Expected CSV format (comma or semicolon delimiter):
 * name,number,email,walletEmail
 * "John Doe","5511999999999","john@email.com","agent@company.com"
 * 
 * The walletEmail column is optional (for assigning contact wallet ownership).
 */
class ImportContactsService {
    /**
     * Import contacts from a CSV file path.
     */
    async importFromFile(filePath: string, options: ImportOptions): Promise<ImportResult> {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }

        const fileStream = fs.createReadStream(absolutePath, { encoding: "utf-8" });
        return this.importFromStream(fileStream, options);
    }

    /**
     * Import contacts from a readable stream (for handling uploads).
     * Uses batch processing for optimal performance.
     */
    async importFromStream(stream: Readable, options: ImportOptions): Promise<ImportResult> {
        const {
            tenantId,
            delimiter = ";", // Semicolon as default per Brazilian CSV standard
            skipHeader = true,
            batchSize = DEFAULT_BATCH_SIZE
        } = options;

        const result: ImportResult = {
            total: 0,
            success: 0,
            errors: 0,
            created: 0,
            updated: 0,
            errorDetails: []
        };

        // Cache for wallet user lookups (email -> userId)
        const walletUserCache = new Map<string, number | null>();

        // Batch accumulator
        const batch: ContactBatchItem[] = [];

        return new Promise((resolve, reject) => {
            const parser = parse({
                delimiter,
                columns: skipHeader,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });

            let rowNumber = skipHeader ? 1 : 0;

            parser.on("readable", async () => {
                let record: CsvRow | null;

                while ((record = parser.read()) !== null) {
                    rowNumber++;
                    result.total++;

                    try {
                        const contactItem = await this.prepareContactItem(
                            record,
                            rowNumber,
                            tenantId,
                            walletUserCache
                        );

                        if (contactItem) {
                            batch.push(contactItem);

                            // Process batch when full
                            if (batch.length >= batchSize) {
                                const batchResult = await this.processBatch(batch, tenantId);
                                result.success += batchResult.success;
                                result.created += batchResult.created;
                                result.updated += batchResult.updated;
                                batch.length = 0; // Clear batch
                            }
                        }
                    } catch (error) {
                        result.errors++;
                        result.errorDetails.push({
                            row: rowNumber,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            });

            parser.on("error", (error: Error) => {
                logger.error("[ImportContacts] CSV parsing error:", error);
                reject(error);
            });

            parser.on("end", async () => {
                // Process remaining items in batch
                if (batch.length > 0) {
                    try {
                        const batchResult = await this.processBatch(batch, tenantId);
                        result.success += batchResult.success;
                        result.created += batchResult.created;
                        result.updated += batchResult.updated;
                    } catch (error) {
                        logger.error("[ImportContacts] Error processing final batch:", error);
                        result.errors += batch.length;
                    }
                }

                logger.info(
                    `[ImportContacts] Import completed: ${result.success}/${result.total} contacts (${result.created} created, ${result.updated} updated, ${result.errors} errors)`
                );
                resolve(result);
            });

            stream.pipe(parser);
        });
    }

    /**
     * Import contacts from a buffer (for handling file uploads).
     */
    async importFromBuffer(buffer: Buffer, options: ImportOptions): Promise<ImportResult> {
        const stream = Readable.from(buffer.toString("utf-8"));
        return this.importFromStream(stream, options);
    }

    /**
     * Prepare a single CSV row for batch processing.
     */
    private async prepareContactItem(
        row: CsvRow,
        rowNumber: number,
        tenantId: string | number,
        walletUserCache: Map<string, number | null>
    ): Promise<ContactBatchItem | null> {
        // Validate required fields
        if (!row.name || !row.number) {
            throw new Error(`Missing required fields (name or number)`);
        }

        // Normalize phone number (remove non-digits)
        const normalizedNumber = this.normalizePhoneNumber(row.number);
        if (!normalizedNumber) {
            throw new Error(`Invalid phone number: ${row.number}`);
        }

        // Resolve wallet user if provided (supports both column naming conventions)
        let walletUserId: number | null = null;
        const walletEmail = row.wallet_user_email || row.walletEmail;
        if (walletEmail) {
            walletUserId = await this.resolveWalletUser(
                walletEmail.trim(),
                tenantId,
                walletUserCache
            );
        }

        return {
            name: row.name.trim(),
            number: normalizedNumber,
            email: row.email?.trim() || "",
            walletUserId,
            tenantId,
            isGroup: false,
            rowNumber
        };
    }

    /**
     * Process a batch of contacts using upsert (insert or update).
     */
    private async processBatch(
        batch: ContactBatchItem[],
        tenantId: string | number
    ): Promise<{ success: number; created: number; updated: number }> {
        let created = 0;
        let updated = 0;

        const transaction = await sequelize.transaction();

        try {
            // Get all existing contacts in this batch by number
            const numbers = batch.map(item => item.number);
            const existingContacts = await Contact.findAll({
                where: {
                    number: numbers,
                    tenantId
                },
                attributes: ["id", "number"],
                transaction
            });

            const existingMap = new Map(existingContacts.map(c => [c.number, c]));

            // Separate into creates and updates
            const toCreate: any[] = [];
            const updatePromises: any[] = [];

            for (const item of batch) {
                const existing = existingMap.get(item.number);

                if (existing) {
                    // Update existing contact
                    updatePromises.push(
                        existing.update({
                            name: item.name,
                            email: item.email || existing.email,
                            walletUserId: item.walletUserId ?? existing.walletUserId
                        }, { transaction })
                    );
                    updated++;
                } else {
                    // Prepare for bulk create
                    toCreate.push({
                        name: item.name,
                        number: item.number,
                        email: item.email,
                        walletUserId: item.walletUserId,
                        tenantId: item.tenantId,
                        isGroup: false
                    });
                    created++;
                }
            }

            // Perform bulk create
            if (toCreate.length > 0) {
                await Contact.bulkCreate(toCreate, {
                    transaction,
                    ignoreDuplicates: true
                });
            }

            // Wait for all updates
            await Promise.all(updatePromises);

            await transaction.commit();

            logger.debug(`[ImportContacts] Batch processed: ${created} created, ${updated} updated`);

            return { success: created + updated, created, updated };
        } catch (error) {
            await transaction.rollback();
            logger.error("[ImportContacts] Batch processing error:", error);
            throw error;
        }
    }

    /**
     * Resolve wallet user by email.
     * Uses cache to avoid repeated database queries.
     */
    private async resolveWalletUser(
        email: string,
        tenantId: string | number,
        cache: Map<string, number | null>
    ): Promise<number | null> {
        const cacheKey = `${email}:${tenantId}`;

        if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!;
        }

        const user = await User.findOne({
            where: {
                email: email.toLowerCase(),
                tenantId
            },
            attributes: ["id"]
        });

        const userId = user?.id ?? null;
        cache.set(cacheKey, userId);

        if (!userId) {
            logger.warn(`[ImportContacts] Wallet user not found for email: ${email}`);
        }

        return userId;
    }

    /**
     * Normalize phone number by removing non-digit characters.
     */
    private normalizePhoneNumber(number: string): string | null {
        const digits = number.replace(/\D/g, "");

        // Validate minimum length (at least 10 digits for most countries)
        if (digits.length < 10 || digits.length > 15) {
            return null;
        }

        return digits;
    }

    /**
     * Generate a sample CSV file for reference.
     */
    static getSampleCsv(): string {
        return `name;number;email;walletEmail
"João Silva";"5511999999999";"joao@email.com";"vendedor@empresa.com"
"Maria Santos";"5521888888888";"maria@email.com";""
"Pedro Costa";"5531777777777";"";"vendedor2@empresa.com"`;
    }
}

// Export singleton instance
export default new ImportContactsService();

// Also export class for testing
export { ImportContactsService };

