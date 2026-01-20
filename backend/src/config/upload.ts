import path from "path";
import multer from "multer";

const publicFolder = path.resolve(process.cwd(), "public");
export default {
  directory: publicFolder,

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      const { originalname } = file;
      const ext = path.extname(originalname);
      const name = originalname.replace(ext, "").replace(/\s/g, "_");
      const fileName = `${new Date().getTime()}-${name}${ext}`;

      return cb(null, fileName);
    }
  })
};
