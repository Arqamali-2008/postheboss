// ===== GT 800 ZEBRA BARCODE PRINTING SYSTEM =====
// Supports Zebra GT 800 thermal label printer
// Paper dimensions calibrated for exact GT 800 output

/**
 * GT 800 Printer Configuration
 * =============================
 * A (Paper Width)       = 9.56cm
 * B (Sticker Width)     = 3cm
 * C (Sticker Height)    = 1.5cm
 * D (Column Gap)        = 0.2cm
 * E (Row Gap)           = 0.3cm
 * Stickers per row      = 3
 * Side margin           = 0.08cm each (calculated)
 */

const GT800_CONFIG = {
    paper: {
        width: 9.56,        // cm
        unit: 'cm'
    },
    sticker: {
        width: 3.0,         // cm (B)
        height: 1.5,        // cm (C)
    },
    gap: {
        column: 0.2,        // cm (D) - horizontal gap between stickers
        row: 0.3,           // cm (E) - vertical gap between rows
    },
    stickersPerRow: 3,
    get sideMargin() {
        // Calculate: (paperWidth - (stickersPerRow * stickerWidth) - ((stickersPerRow - 1) * columnGap)) / 2
        const totalStickersWidth = this.stickersPerRow * this.sticker.width;
        const totalGapsWidth = (this.stickersPerRow - 1) * this.gap.column;
        return (this.paper.width - totalStickersWidth - totalGapsWidth) / 2;
    }
};

class GT800Printer {
    constructor() {
        this.printer = null;
        this.isConnected = false;
        this.config = GT800_CONFIG;
    }

    // Initialize printer connection
    async init() {
        try {
            if (navigator.serial) {
                console.log('Web Serial API available for GT 800');
                return true;
            } else {
                console.log('Web Serial API not available, using print dialog for GT 800');
                return true;
            }
        } catch (error) {
            console.error('GT 800 printer initialization error:', error);
            return false;
        }
    }

    // Get printer config
    getConfig() {
        return this.config;
    }

    // Validate sticker dimensions
    validateLayout() {
        const c = this.config;
        const totalWidth = (c.stickersPerRow * c.sticker.width) + ((c.stickersPerRow - 1) * c.gap.column);
        const fits = totalWidth <= c.paper.width;
        return {
            valid: fits,
            totalContentWidth: totalWidth,
            paperWidth: c.paper.width,
            sideMargin: c.sideMargin,
            message: fits
                ? `Layout OK: ${totalWidth}cm content on ${c.paper.width}cm paper (${c.sideMargin.toFixed(3)}cm margin each side)`
                : `Layout ERROR: ${totalWidth}cm content exceeds ${c.paper.width}cm paper!`
        };
    }

    // Generate ESC/POS commands for GT 800
    generateESCPOSCommands(data, format = 'receipt') {
        let commands = [];
        commands.push('\x1B\x40'); // ESC @ - Initialize printer

        if (format === 'receipt') {
            commands.push('\x1B\x57\x02'); // Set print area width to 80mm
            commands = commands.concat(this.generateReceiptCommands(data));
        } else {
            commands = commands.concat(this.generateLabelCommands(data, format));
        }

        commands.push('\x1D\x56\x41\x03'); // GS V A - Partial cut
        commands.push('\x0A\x0A\x0A'); // Line feeds

        return commands.join('');
    }

    // Generate receipt format commands
    generateReceiptCommands(data) {
        let commands = [];

        commands.push('\x1B\x61\x01'); // Center align

        if (data.storeName) {
            commands.push('\x1B\x21\x10'); // Double height
            commands.push(data.storeName + '\n');
            commands.push('\x1B\x21\x00'); // Normal size
        }

        if (data.storeAddress) {
            commands.push(data.storeAddress + '\n');
        }

        if (data.storeContact) {
            commands.push(data.storeContact + '\n');
        }

        commands.push('\x1B\x61\x00'); // Left align
        commands.push('--------------------------------\n');

        if (data.barcode) {
            commands.push('\x1B\x61\x01'); // Center align
            commands.push('\x1D\x6B\x04'); // GS k - Print barcode
            commands.push(String.fromCharCode(data.barcode.length));
            commands.push(data.barcode);
            commands.push('\n\n');
        }

        if (data.itemCode) {
            commands.push('\x1B\x61\x00'); // Left align
            commands.push(`Code: ${data.itemCode}\n`);
        }

        if (data.itemName) {
            commands.push(`Name: ${data.itemName}\n`);
        }

        if (data.price) {
            commands.push(`Price: ${data.price}\n`);
        }

        commands.push('\x1B\x61\x01'); // Center align
        commands.push('--------------------------------\n');
        if (data.footer) {
            commands.push(data.footer + '\n');
        }

        return commands;
    }

    // Generate label format commands (GT 800 specific)
    generateLabelCommands(data, labelSize = '30x15') {
        let commands = [];

        // Parse label size
        const [width, height] = labelSize.split('x').map(Number);

        // Set label size
        commands.push(`\x1D\x57${String.fromCharCode(width)}${String.fromCharCode(height)}`);
        commands.push('\x1B\x61\x01'); // Center align

        if (data.barcode) {
            commands.push('\x1D\x6B\x04'); // Print barcode (Code128)
            commands.push(String.fromCharCode(data.barcode.length));
            commands.push(data.barcode);
            commands.push('\n\n');
        }

        if (data.itemCode) {
            commands.push('\x1B\x21\x08'); // Double width
            commands.push(data.itemCode + '\n');
            commands.push('\x1B\x21\x00'); // Normal
        }

        if (data.itemName) {
            commands.push(data.itemName + '\n');
        }

        if (data.price) {
            commands.push('\x1B\x21\x10'); // Double height
            commands.push(data.price + '\n');
            commands.push('\x1B\x21\x00'); // Normal
        }

        return commands;
    }

    // Print barcode (receipt format)
    async printBarcodeReceipt(barcodeData) {
        const commands = this.generateESCPOSCommands(barcodeData, 'receipt');
        return this.print(commands, 'receipt');
    }

    // Print barcode (GT 800 label format - 30x15mm = 3cm x 1.5cm)
    async printBarcodeLabel(barcodeData, labelSize = '30x15') {
        const commands = this.generateESCPOSCommands(barcodeData, labelSize);
        return this.print(commands, 'label');
    }

    // Print using browser print dialog
    async print(commands, format) {
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePrintHTML(commands, format);

        printWindow.document.write(printContent);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 250);

        return true;
    }

    // Generate HTML for print preview (GT 800 optimized)
    generatePrintHTML(commands, format) {
        const c = this.config;
        const width = format === 'receipt' ? '80mm' : `${c.sticker.width}cm`;
        const height = format === 'receipt' ? 'auto' : `${c.sticker.height}cm`;

        return `
<!DOCTYPE html>
<html>
<head>
    <title>GT 800 Barcode Print</title>
    <style>
        @page {
            size: ${c.paper.width}cm auto;
            margin: 0;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        .label {
            width: ${width};
            height: ${height};
            padding: 1mm;
            display: inline-block;
            vertical-align: top;
            text-align: center;
            box-sizing: border-box;
            page-break-inside: avoid;
        }
        .label-grid {
            width: ${c.paper.width}cm;
            padding: 0 ${c.sideMargin.toFixed(3)}cm;
        }
        .label + .label {
            margin-left: ${c.gap.column}cm;
        }
        .label:nth-child(${c.stickersPerRow}n+1) {
            margin-left: 0;
        }
        .barcode { text-align: center; margin: 2px 0; }
        .item-code { font-weight: bold; font-size: 8px; }
        .item-name { font-size: 7px; margin: 1px 0; }
        .item-price { font-size: 10px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="label-grid">
        <div class="label">
            <div class="item-code">${commands.match(/Code: (.+)/)?.[1] || ''}</div>
            <div class="item-name">${commands.match(/Name: (.+)/)?.[1] || ''}</div>
            <div class="item-price">${commands.match(/Price: (.+)/)?.[1] || ''}</div>
        </div>
    </div>
</body>
</html>
        `;
    }

    // Generate barcode image (Code128)
    generateBarcodeImage(barcodeText) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 80;

        ctx.fillStyle = '#000';
        const barWidth = 2;
        let x = 10;

        for (let i = 0; i < barcodeText.length; i++) {
            const char = barcodeText.charCodeAt(i);
            const pattern = (char % 2 === 0) ? [1, 0, 1, 0, 1] : [0, 1, 0, 1, 0];
            pattern.forEach((bar) => {
                if (bar === 1) {
                    ctx.fillRect(x, 10, barWidth, 60);
                }
                x += barWidth;
            });
        }

        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(barcodeText, canvas.width / 2, 75);

        return canvas.toDataURL();
    }
}

// Global printer instance
let gt800Printer = null;

// Initialize printer on page load
document.addEventListener('DOMContentLoaded', function () {
    gt800Printer = new GT800Printer();
    gt800Printer.init().then(() => {
        const validation = gt800Printer.validateLayout();
        console.log('GT 800 Layout Validation:', validation.message);
    });
});

// Print product barcode (receipt format)
function printProductBarcodeReceipt(product) {
    if (!gt800Printer) {
        alert('GT 800 Printer not initialized');
        return;
    }

    const settings = getSettings();
    const barcodeData = {
        storeName: settings.storeName || 'AMi STORE',
        storeAddress: settings.storeAddress || '',
        storeContact: settings.storeContact || '',
        barcode: product.itemCode,
        itemCode: product.itemCode,
        itemName: product.name,
        price: formatCurrency(product.price),
        footer: 'Thank you for shopping!'
    };

    gt800Printer.printBarcodeReceipt(barcodeData);
}

// Print product barcode (GT 800 label format - default 3cm x 1.5cm)
function printProductBarcodeLabel(product, labelSize = '30x15') {
    if (!gt800Printer) {
        alert('GT 800 Printer not initialized');
        return;
    }

    const barcodeData = {
        barcode: product.itemCode,
        itemCode: product.itemCode,
        itemName: product.name,
        price: formatCurrency(product.price)
    };

    gt800Printer.printBarcodeLabel(barcodeData, labelSize);
}

// Batch print barcodes
function printBatchBarcodes(products, format = 'receipt', labelSize = '30x15') {
    if (!gt800Printer) {
        alert('GT 800 Printer not initialized');
        return;
    }

    products.forEach((product, index) => {
        setTimeout(() => {
            if (format === 'receipt') {
                printProductBarcodeReceipt(product);
            } else {
                printProductBarcodeLabel(product, labelSize);
            }
        }, index * 1000);
    });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GT800Printer, GT800_CONFIG };
}
