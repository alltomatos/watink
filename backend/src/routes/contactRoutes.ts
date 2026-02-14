import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();

// ... (Swagger docs omitted for brevity, keeping only route logic updates)

contactRoutes.post(
  "/contacts/import",
  isAuth,
  checkPermission("create_contacts"),
  ImportPhoneContactsController.store
);

contactRoutes.get("/contacts", isAuth, ContactController.index);

contactRoutes.get("/contacts/:contactId", isAuth, ContactController.show);

contactRoutes.post(
  "/contacts",
  isAuth,
  checkPermission("create_contacts"),
  ContactController.store
);

contactRoutes.post("/contact", isAuth, ContactController.getContact);

contactRoutes.put(
  "/contacts/:contactId",
  isAuth,
  checkPermission("edit_contacts"),
  ContactController.update
);

contactRoutes.delete(
  "/contacts/:contactId",
  isAuth,
  checkPermission("delete_contacts"),
  ContactController.remove
);

contactRoutes.post(
  "/contacts/:contactId/sync",
  isAuth,
  checkPermission("edit_contacts"),
  ContactController.sync
);

contactRoutes.post(
  "/contacts/enrich",
  isAuth,
  checkPermission("create_contacts"),
  // 'create_contacts' or 'edit_contacts' - enrichment feels like cleanup/maintenance.
  // Using 'create_contacts' as it can essentially "create" new data for contacts.
  ContactController.batchEnrich
);

export default contactRoutes;
