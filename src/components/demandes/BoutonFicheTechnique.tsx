// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { FileText, FileDown, Printer, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  getEtablissementsProchesAnalyse,
  getAireRecrutementAnalyse,
  getRayonRecrutementKm,
  niveauToKey,
} from "@/utils/demandeHelpers";
import {
  genererFicheTechnique,
  telechargerFicheDOCX,
  imprimerFichePDF,
  attendreTuilesChargees,
  aplatirTransformsLeaflet,
} from "@/utils/ficheTechnique";

import DemandeLocalisationMap from "./DemandeLocalisationMap";

import { toPng } from "html-to-image";
import html2canvas from "html2canvas";

const NAVY = "bg-[#2f4a8a]";

const ZOOM_FICHE_DEFAUT = 13.4;

const calculerZoomPourRayon = (rayonMetres, largeurPx, hauteurPx, latRef = -18.9) => {
  if (!(rayonMetres > 0) || !(largeurPx > 0) || !(hauteurPx > 0)) return ZOOM_FICHE_DEFAUT;
  const MARGE = 1.25;
  const rayonVise = rayonMetres * MARGE;
  const metresParPixelZoom0 = 156543.03392 * Math.cos((latRef * Math.PI) / 180);
  const cotePx = Math.min(largeurPx, hauteurPx);
  const zoom = Math.log2((metresParPixelZoom0 * (cotePx / 2)) / rayonVise);
  if (!Number.isFinite(zoom)) return ZOOM_FICHE_DEFAUT;
  return Math.max(5, Math.min(17, zoom));
};

const capturerCarteEnBase64 = async (conteneur) => {
  if (!conteneur) return null;
  await attendreTuilesChargees(conteneur);
  await new Promise((r) => setTimeout(r, 500));
  try {
    return await toPng(conteneur, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      skipFonts: true,
      filter: (node) => !(node?.classList && node.classList.contains("leaflet-control-zoom")),
    });
  } catch (e) {
    console.warn("html-to-image a échoué, repli sur html2canvas :", e);
  }
  try {
    const { width, height } = conteneur.getBoundingClientRect();
    const canvas = await html2canvas(conteneur, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      scale: 3,
      logging: false,
      imageTimeout: 15000,
      width: Math.round(width),
      height: Math.round(height),
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
      onclone: (docClone) => {
        const racine = docClone.querySelector("[data-capture-carte]");
        if (racine) aplatirTransformsLeaflet(docClone, racine);
      },
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Impossible de capturer la carte :", e);
    return null;
  }
};

const aRelationsCompletes = (d) => {
  if (!d) return false;
  return (
    Array.isArray(d.enseignants) ||
    Array.isArray(d.evolution_effectifs) ||
    !!d.nouvelle_creation ||
    !!d.regularisation ||
    Array.isArray(d.aire_recrutement) ||
    Array.isArray(d.etablissements_proches) ||
    !!d.info_complementaire ||
    Array.isArray(d.personnel_existant) ||
    Array.isArray(d.pieces)
  );
};

export default function BoutonFicheTechnique({
  demande,
  analyseValidee,
  vueRef = null,
  chargerDetail = null,
  enLien = false,
}) {
  const [modalOuverte, setModalOuverte] = useState(false);
  const [carteBase64, setCarteBase64] = useState(null);
  const [generationCarte, setGenerationCarte] = useState(false);
  const [contenuFiche, setContenuFiche] = useState("");
  const [chargementDetail, setChargementDetail] = useState(false);
  const [demandeComplete, setDemandeComplete] = useState(demande);

  const [tailleCapture, setTailleCapture] = useState({ w: 1600, h: 900 });
  const [vueInitialeFiche, setVueInitialeFiche] = useState(null);
  const [fondKeyCapture, setFondKeyCapture] = useState("default");
  const [analyseSpatialeCapture, setAnalyseSpatialeCapture] = useState(false);

  const carteRef = useRef(null);
  const captureMapRef = useRef(null);

  useEffect(() => {
    setDemandeComplete(demande);
  }, [demande]);

  const etablissementsProches = getEtablissementsProchesAnalyse(demandeComplete);
  const aireRecrutement = getAireRecrutementAnalyse(demandeComplete);
  const aireSansCoord = demandeComplete?.aire_recrutement_sans_coord || [];

  const ouvrirModale = async () => {
    let cible = demandeComplete;

    if (chargerDetail && cible?.id) {
      setChargementDetail(true);
      try {
        const complet = await chargerDetail(cible.id);
        if (complet) {
          cible = complet;
          setDemandeComplete(complet);
        }
      } catch (e) {
        console.error("Impossible de charger le détail complet pour la fiche :", e);
        setChargementDetail(false);
        return;
      } finally {
        setChargementDetail(false);
      }
    }

    const vue = vueRef?.current;
    const lat = cible?.latitude ?? cible?.localisation?.latitude;
    const lng = cible?.longitude ?? cible?.localisation?.longitude;

    let centre;
    if (lat != null && lng != null) centre = [Number(lat), Number(lng)];
    else if (vue?.center) centre = vue.center;
    else centre = [-18.8792, 47.5079];

    const w = Math.max(1600, Math.round(vue?.size?.x ?? 0));
    const h = Math.max(900, Math.round(vue?.size?.y ?? 0));

    const niveauKey = niveauToKey(cible?.niveau_etab || cible?.niveau);
    const rayonKm = getRayonRecrutementKm(niveauKey);
    const zoomFiche = calculerZoomPourRayon(rayonKm * 1000, w, h, centre[0]);

    const fond = vue?.fondKey || "default";
    const analyseSpatiale = Boolean(vue?.afficherAnalyseSpatiale);

    setVueInitialeFiche({ center: centre, zoom: zoomFiche });
    setFondKeyCapture(fond);
    setAnalyseSpatialeCapture(analyseSpatiale);
    setModalOuverte(true);
    setContenuFiche(genererFicheTechnique(cible, null, analyseValidee));
    setGenerationCarte(true);
    setTailleCapture({ w, h });

    await new Promise((r) => setTimeout(r, 600));

    const carteCachee = captureMapRef.current;
    if (carteCachee) {
      carteCachee.invalidateSize(false);
      carteCachee.setView(centre, zoomFiche, {
        animate: false, zoomAnimation: false, fadeAnimation: false,
      });
      await new Promise((r) => setTimeout(r, 500));
      carteCachee.invalidateSize(false);
    }

    await new Promise((r) => setTimeout(r, 1800));

    const base64 = await capturerCarteEnBase64(carteRef.current);
    setCarteBase64(base64);
    setContenuFiche(genererFicheTechnique(cible, base64, analyseValidee));
    setGenerationCarte(false);
  };

  const badgeClasses = analyseValidee
    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
    : "bg-primary/10 text-primary border border-primary/30";

  const boutonDocxClasses = analyseValidee
    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
    : "bg-primary hover:bg-primary/90 text-primary-foreground";

  const desactive = chargementDetail || generationCarte;

  return (
    <>
      {generationCarte && (
        <div
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: `${tailleCapture.w + 40}px`,
            height: `${tailleCapture.h + 40}px`,
            pointerEvents: "none",
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <DemandeLocalisationMap
            demande={demandeComplete}
            etablissementsProches={etablissementsProches}
            aireRecrutement={aireRecrutement}
            aireSansCoord={aireSansCoord}
            mapRef={carteRef}
            mapInstanceRef={captureMapRef}
            captureSize={tailleCapture}
            avecCapture
            masquerAireVoisins={true}
            vueInitiale={vueInitialeFiche}
            fondKeyInitial={fondKeyCapture}
            afficherAnalyseSpatialeInitiale={analyseSpatialeCapture}
          />
        </div>
      )}

      {enLien ? (
        <button
          type="button"
          onClick={ouvrirModale}
          disabled={desactive}
          title="Exporter la fiche technique"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium",
            "transition-all duration-150 ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            "active:scale-[0.97]",

            analyseValidee
              ? "text-emerald-600 dark:text-emerald-400 focus-visible:ring-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300"
              : "text-primary focus-visible:ring-primary/40 hover:bg-primary/10 hover:text-primary/80",

            desactive && "opacity-60 cursor-not-allowed",
          )}
        >
          {desactive ? (
            <Loader2 className={cn("h-3.5 w-3.5 animate-spin", analyseValidee ? "text-emerald-500" : "text-primary")} />
          ) : (
            <Download className={cn(
              "h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110",
              analyseValidee ? "text-emerald-500 dark:text-emerald-400" : "text-primary"
            )} />
          )}
          <span className="relative">
            Exporter
            <span className="absolute left-0 -bottom-0.5 h-[1.5px] w-full origin-left scale-x-0 rounded-full bg-current opacity-70 transition-transform duration-200 ease-out group-hover:scale-x-100" />
          </span>
        </button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={ouvrirModale}
          disabled={desactive}
          className={cn(
            "gap-1.5 h-8 shadow-sm font-medium transition-colors",
            analyseValidee
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground",
          )}
          title="Fiche technique"
        >
          {desactive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Fiche
        </Button>
      )}

      <Dialog open={modalOuverte} onOpenChange={setModalOuverte}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1100px] max-w-[1100px] max-h-[94dvh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-foreground shadow-2xl">

          <DialogHeader className="border-b px-6 py-5 shrink-0 bg-white dark:bg-slate-950 space-y-0">
            <div className="flex items-start gap-3 pr-8">
              <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", NAVY)}>
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-semibold leading-tight">
                  Fiche technique
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {generationCarte ? (
                    "Génération de la carte en cours…"
                  ) : (
                    <>
                      Dossier  <strong className="text-foreground/80">{demandeComplete?.nom_etab}</strong>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 border-b shrink-0 bg-slate-50 dark:bg-slate-900">
            <Badge className={cn("text-xs", badgeClasses)} variant="outline">
              {analyseValidee ? "✓ Analyse validée" : "⚠ Analyse non validée"}
            </Badge>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imprimerFichePDF(demandeComplete, contenuFiche)}
                disabled={generationCarte}
                className="gap-2 rounded-lg bg-white dark:bg-slate-950"
              >
                <Printer className="h-4 w-4" />
                Imprimer / PDF
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => telechargerFicheDOCX(demandeComplete, contenuFiche)}
                disabled={generationCarte}
                className={cn("gap-2 rounded-lg", boutonDocxClasses)}
              >
                <FileDown className="h-4 w-4" />
                Télécharger DOCX
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 bg-white dark:bg-slate-950">
            {generationCarte ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#2f4a8a]" />
                <p className="text-xs text-muted-foreground">Génération de la fiche et de la carte…</p>
              </div>
            ) : (
              <iframe
                title="Aperçu de la fiche technique"
                srcDoc={contenuFiche}
                className="w-full bg-white border border-slate-200 rounded-xl shadow-sm"
                style={{ height: "62vh" }}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-3 shrink-0 bg-white dark:bg-slate-950">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="rounded-lg">Fermer</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}