/**
 * Opens a new window with the TDB content and triggers print dialog.
 * This produces a PDF with selectable text (unlike html2canvas which renders as image).
 */
export const printTdb = (contentElement: HTMLElement, title: string) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres popup pour imprimer.');
    return;
  }

  // Clone the content
  const content = contentElement.cloneNode(true) as HTMLElement;

  // Convert any SVG-based recharts to static images by capturing them
  // For charts, we'll keep them as-is since they render as SVG (vector, selectable)

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A3 portrait;
      margin: 8mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Verdana, sans-serif;
      font-size: 10px;
      background: #fff;
    }
    table {
      border-collapse: collapse;
    }
    td, th {
      border: 1px solid #555;
      padding: 2px 4px;
      font-size: 10px;
    }
    img {
      max-width: 100%;
    }
    /* Ensure backgrounds print */
    [style*="background"] {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Hide any scrollbars */
    ::-webkit-scrollbar {
      display: none;
    }
    /* Make recharts responsive containers fit */
    .recharts-responsive-container {
      width: 100% !important;
    }
  </style>
</head>
<body>
  ${content.outerHTML}
  <script>
    // Wait for images to load, then print
    const images = document.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;
    
    function tryPrint() {
      loaded++;
      if (loaded >= total) {
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }
    
    if (total === 0) {
      setTimeout(() => window.print(), 500);
    } else {
      images.forEach(img => {
        if (img.complete) {
          tryPrint();
        } else {
          img.onload = tryPrint;
          img.onerror = tryPrint;
        }
      });
    }
  </script>
</body>
</html>
  `);
  printWindow.document.close();
};
