import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, ExternalLink, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

interface PDFViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  pdfName: string;
}

export const PDFViewer = ({ open, onOpenChange, pdfUrl, pdfName }: PDFViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(100);

  const isDemo = pdfUrl === '#demo';

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleOpenExternal = () => {
    if (!isDemo) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate max-w-[400px]">
              {pdfName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              {!isDemo && (
                <>
                  <Button variant="outline" size="sm" onClick={handleOpenExternal}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ouvrir
                  </Button>
                  <Button variant="default" size="sm" asChild>
                    <a href={pdfUrl} download={pdfName}>
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </a>
                  </Button>
                </>
              )}
              
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          {isDemo ? (
            // Demo Mode Preview
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 max-w-md">
                <div className="w-24 h-32 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-lg mx-auto mb-6 flex items-center justify-center border-2 border-dashed border-destructive/30">
                  <span className="text-3xl font-bold text-destructive">PDF</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">Mode Démonstration</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Ce document est en mode démo. Connectez-vous au serveur Django pour visualiser les vrais documents PDF.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Fichier:</strong> {pdfName}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Real PDF Viewer
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Chargement du document...</p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <X className="h-8 w-8 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Impossible d'afficher le PDF dans le navigateur.
                    </p>
                    <Button onClick={handleOpenExternal}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </div>
                </div>
              )}

              <iframe
                src={`${pdfUrl}#view=FitH&toolbar=0`}
                className="w-full h-full border-0"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
                title={pdfName}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
