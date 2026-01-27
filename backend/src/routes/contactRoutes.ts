import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();

// Multer config for CSV file upload (memory storage for buffer processing)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and text files
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.mimetype === "text/plain" ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  }
});

// Phone contacts import (legacy)
contactRoutes.post(
  "/contacts/import",
  isAuth,
  checkPermission("contacts:write"),
  ImportPhoneContactsController.store
);

// CSV import - new endpoint
contactRoutes.post(
  "/contacts/import-csv",
  isAuth,
  checkPermission("contacts:write"),
  csvUpload.single("file"),
  ContactController.importCsv
);

// CSV sample download
contactRoutes.get(
  "/contacts/import-csv/sample",
  isAuth,
  checkPermission("contacts:write"),
  ContactController.getSampleCsv
);

contactRoutes.get(
  "/contacts",
  isAuth,
  checkPermission("contacts:read"),
  ContactController.index
);

contactRoutes.get(
  "/contacts/:contactId",
  isAuth,
  checkPermission("contacts:read"),
  ContactController.show
);

contactRoutes.post(
  "/contacts",
  isAuth,
  checkPermission("contacts:write"),
  ContactController.store
);

contactRoutes.post(
  "/contact",
  isAuth,
  checkPermission("contacts:read"),
  ContactController.getContact
);

contactRoutes.put(
  "/contacts/:contactId",
  isAuth,
  checkPermission("contacts:write"),
  ContactController.update
);

contactRoutes.delete(
  "/contacts/:contactId",
  isAuth,
  checkPermission("contacts:delete"),
  ContactController.remove
);

contactRoutes.post(
  "/contacts/:contactId/sync",
  isAuth,
  checkPermission("contacts:write"),
  ContactController.sync
);

contactRoutes.post(
  "/contacts/enrich",
  isAuth,
  checkPermission("contacts:write"),
  ContactController.batchEnrich
);

export default contactRoutes;

