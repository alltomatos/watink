import { QueryInterface, QueryTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const templates = await queryInterface.sequelize.query(
            `SELECT id, html, text FROM "EmailTemplates" WHERE name = 'welcome_premium'`,
            { type: QueryTypes.SELECT }
        ) as any[];

        for (const template of templates) {
            let newHtml = template.html;
            let newText = template.text;
            let changed = false;

            if (newHtml.includes('href="#"')) {
                newHtml = newHtml.replace('href="#"', 'href="{{frontendUrl}}"');
                changed = true;
            }

            if (newText && !newText.includes('{{frontendUrl}}')) {
                newText = newText.replace('Acesse a plataforma para começar.', 'Acesse a plataforma para começar: {{frontendUrl}}');
                changed = true;
            }

            if (changed) {
                await queryInterface.sequelize.query(
                    `UPDATE "EmailTemplates" SET html = :html, text = :text, "updatedAt" = NOW() WHERE id = :id`,
                    {
                        replacements: { html: newHtml, text: newText, id: template.id },
                        type: QueryTypes.UPDATE
                    }
                );
            }
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Reverting is hard because we don't know if it was '#' before, but generally we can leave it.
        // Or we could revert dynamic tag back to # if we really wanted to be strict.
        console.log("Revert of 20260120230000-update-welcome-email-template-link not implemented to avoid data loss.");
    }
};
