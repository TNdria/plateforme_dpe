$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('div-data', 'win8')
})
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('div-data')
})
$(document).on("ajaxStop", function () {
    utils.waitmeClose('div-data')
})

// Helper: convert image to base64 data URL
function imgToBase64(imgEl) {
    return new Promise(function (resolve) {
        if (!imgEl || !imgEl.src) { resolve(); return; }
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                imgEl.src = canvas.toDataURL('image/png');
            } catch (e) {
                console.warn('Could not convert image to base64:', e);
            }
            resolve();
        };
        img.onerror = function () {
            console.warn('Failed to load image for base64:', imgEl.src);
            resolve();
        };
        img.src = imgEl.src;
    });
}

$(document).ready(async function () {

    $('#btn-apply').click(function () {
        let niveau = parseInt($("#niveau").val())
        let code_dren = parseInt($("#dren").val())
        let dren_name = $("#dren option:selected").text();
        const TEMPLATE_PATH = [
            "/static/templates_tdb_cisco/tdb_cisco_n0.html",
            "/static/templates_tdb_cisco/tdb_cisco_n1.html",
            "/static/templates_tdb_cisco/tdb_cisco_n2.html",
            "/static/templates_tdb_cisco/tdb_cisco_n3.html"
        ]
        if (code_dren == 0) { return }
        $(".p-bar-info").removeClass("d-none")
        $("#btn-pdf").addClass("d-none")
        $('#div-data').html("")
        utils.waitmeShow('div-data', 'win8')
        $.get(TEMPLATE_PATH[niveau], function (data) {
            $('#div-data').html(eval("data"));
            $(".p-bar-info").addClass("d-none")
            $("#paramModal").modal("hide")
            $("#btn-pdf").removeClass("d-none")
            $("#dren_name").html(dren_name)
            utils.waitmeClose('div-data')
        }).fail(function () {
            console.error(`Error loading ${TEMPLATE_PATH[niveau]}`)
            $(".p-bar-info").addClass("d-none")
            utils.waitmeClose('div-data')
            alert("Template non disponible pour ce niveau.")
        })
    })

    // =================== EXPORT PDF ===================
    $('#btn-pdf').click(async function () {
        const { jsPDF } = window.jspdf;
        const element = document.getElementById('tdb-cisco-content') || document.getElementById('div-data');
        
        if (!element) {
            alert("Aucun contenu à exporter.");
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>&nbsp;Export en cours...');

        try {
            // Convert images to base64
            var images = element.querySelectorAll('img');
            var promises = [];
            for (var i = 0; i < images.length; i++) {
                promises.push(imgToBase64(images[i]));
            }
            await Promise.all(promises);

            // Add temporary PDF-specific styles for better table borders
            var styleEl = document.createElement('style');
            styleEl.id = 'pdf-export-styles';
            styleEl.textContent = `
                #tdb-cisco-content table.tdb-table th,
                #tdb-cisco-content table.tdb-table td {
                    border: 1.5px solid #333 !important;
                }
                #tdb-cisco-content table.tdb-table th {
                    border: 1.5px solid #333 !important;
                    background: #d0d0e0 !important;
                }
                #tdb-cisco-content .gris {
                    background: #b0b0cc !important;
                }
                #tdb-cisco-content .tdb-box {
                    border: 2.5px solid #000 !important;
                }
            `;
            document.head.appendChild(styleEl);

            // Capture at high resolution
            var canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: element.scrollWidth,
                height: element.scrollHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });

            // Remove temporary styles
            document.getElementById('pdf-export-styles').remove();

            // A3 landscape PDF - fill the entire page
            var pdfWidth = 420;
            var pdfHeight = 297;
            var margin = 8; // smaller margin to maximize content area
            var contentWidth = pdfWidth - (margin * 2);
            var contentHeight = pdfHeight - (margin * 2) - 8; // leave space for page number

            var pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a3'
            });

            var canvasWidth = canvas.width;
            var canvasHeight = canvas.height;
            var scale = 3; // matches html2canvas scale
            var scaleFactor = contentWidth / (canvasWidth / scale);
            var scaledHeight = (canvasHeight / scale) * scaleFactor;
            var totalPages = Math.ceil(scaledHeight / contentHeight);

            // Load logo images as base64 for header on each page
            var logoMenBase64 = null;
            var analyseBase64 = null;
            try {
                var logoImg = new Image();
                logoImg.crossOrigin = "anonymous";
                await new Promise(function(res, rej) {
                    logoImg.onload = res;
                    logoImg.onerror = rej;
                    logoImg.src = "/static/img/logoMen.jpg";
                });
                var lc = document.createElement('canvas');
                lc.width = logoImg.naturalWidth;
                lc.height = logoImg.naturalHeight;
                lc.getContext('2d').drawImage(logoImg, 0, 0);
                logoMenBase64 = lc.toDataURL('image/jpeg');
            } catch(e) { console.warn('Logo MEN not loaded:', e); }
            try {
                var analImg = new Image();
                analImg.crossOrigin = "anonymous";
                await new Promise(function(res, rej) {
                    analImg.onload = res;
                    analImg.onerror = rej;
                    analImg.src = "/static/img/analyse.png";
                });
                var ac = document.createElement('canvas');
                ac.width = analImg.naturalWidth;
                ac.height = analImg.naturalHeight;
                ac.getContext('2d').drawImage(analImg, 0, 0);
                analyseBase64 = ac.toDataURL('image/png');
            } catch(e) { console.warn('Analyse image not loaded:', e); }

            for (var page = 0; page < totalPages; page++) {
                if (page > 0) {
                    pdf.addPage();
                }

                // White background
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

                // Thin border around page content
                pdf.setDrawColor(51, 122, 183); // #337ab7
                pdf.setLineWidth(0.6);
                pdf.rect(margin - 1, margin - 1, contentWidth + 2, contentHeight + 10);

                // Add logos on first page header area
                if (page === 0) {
                    if (logoMenBase64) {
                        pdf.addImage(logoMenBase64, 'JPEG', margin + 2, margin + 1, 22, 22);
                    }
                    if (analyseBase64) {
                        pdf.addImage(analyseBase64, 'PNG', pdfWidth - margin - 22, margin + 1, 20, 20);
                    }
                }

                // Content image - fill the page
                var sourceY = page * (contentHeight / scaleFactor) * scale;
                var sourceHeight = Math.min((contentHeight / scaleFactor) * scale, canvasHeight - sourceY);

                if (sourceHeight <= 0) break;

                var pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvasWidth;
                pageCanvas.height = sourceHeight;
                var ctx = pageCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, sourceY, canvasWidth, sourceHeight, 0, 0, canvasWidth, sourceHeight);

                var imgData = pageCanvas.toDataURL('image/png');
                var imgHeightMM = (sourceHeight / scale) * scaleFactor;

                // Place content from left margin, filling the width
                pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeightMM);

                // Page number
                pdf.setFontSize(8);
                pdf.setTextColor(100, 100, 100);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Page ' + (page + 1) + ' / ' + totalPages, pdfWidth / 2, pdfHeight - 4, { align: 'center' });
                pdf.setTextColor(0, 0, 0);
            }

            // Filename
            var drenName = $("#dren option:selected").text().trim().replace(/\s+/g, '_') || 'CISCO';
            var niveauLabels = ['PRESCO', 'PRIMAIRE', 'COLLEGE', 'LYCEE'];
            var niveau = parseInt($("#niveau").val()) || 0;
            var fileName = 'TDB_CISCO_' + niveauLabels[niveau] + '_' + drenName + '.pdf';
            
            pdf.save(fileName);
        } catch (error) {
            console.error('PDF export error:', error);
            // Clean up temp styles if error
            var tmpStyle = document.getElementById('pdf-export-styles');
            if (tmpStyle) tmpStyle.remove();
            alert("Erreur lors de l'export PDF.");
        }

        $btn.prop('disabled', false).html('<i class="fas fa-file-pdf text-danger"></i>&nbsp;PDF');
    });
})