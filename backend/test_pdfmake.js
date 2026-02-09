
// const PdfPrinter = require('pdfmake/src/printer'); // This failed
// Let's try js/Printer
const PdfPrinterJS = require('pdfmake/js/Printer');

console.log('Type of PdfPrinterJS:', typeof PdfPrinterJS);
// It might be { default: [Class: PdfPrinter] } because of exports.default
const PrinterClass = PdfPrinterJS.default || PdfPrinterJS;

console.log('Is constructor?', !!PrinterClass.prototype && !!PrinterClass.prototype.constructor.name);

try {
  new PrinterClass({ Roboto: { normal: 'Helvetica' } }); 
  console.log('Success: new PrinterClass works');
} catch (e) {
  console.log('Error instantiating:', e.message);
}
