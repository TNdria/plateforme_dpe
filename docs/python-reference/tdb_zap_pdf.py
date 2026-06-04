
import pandas as pd
pd.set_option('future.no_silent_downcasting', True)
import numpy as np

#mat plot lib
import matplotlib
import matplotlib.pyplot as plt
matplotlib.use('Agg')

from num2words import num2words
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER, TA_RIGHT
#PDF et Mise en page
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A3, portrait
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Image as RImage,Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

#Pour les images et QR_CODE
from PIL import Image
from io import BytesIO, StringIO

# Set up logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import os
import statistics as stats

class PDF :

    def __init__(self, df_zap,df_zap_in_cisco, df_cisco, df_dren):
        self.df_zap = df_zap
        self.df_zap_in_cisco = df_zap_in_cisco
        self.df_cisco = df_cisco
        self.df_dren = df_dren

    def normaliser_valeur_0_100(self,val, min_val=0, max_val=100):
        """
        Normalisation des indicateurs entre 0 à 100
        """
        if float(val)==0:
            return 0
        if min_val == 0:
            return (max(0, min(100, round((max_val / val)) * 100,1)))
        if max_val == 0:
            return (max(0, min(100, round((min_val / val)) * 100,1)))
        normalize = round(stats.mean([(min_val / val), (max_val / val)]) * 100,1)
        return max(0, min(100, normalize))
    
    def y_etabs_zap(self):
        y = []
        for _,row in self.df_zap_in_cisco.iterrows() :
            data_y = {}
            data_y["NOM"] = row.get("NOM_ZAP","")
            data_y["CODE_ZAP"] = row.get("CODE_ZAP","")
            try:
                p = 100 - min(int(row.get("red_ensemble",0)),100)
                ret = row.get("txRetentionTotal",0)
                tpa = float(row.get("TPA",0))
                cepe = row.get("tx_admis",0) 
                mean = round(stats.mean([p, ret, cepe]), 1) 
                data_y["Y"] = mean
            except Exception as e:
                data_y["Y"] = 50
                print(f'erreur pour {data_y["CODE_ZAP"]} :=> {e}')
                
            y.append(data_y)
        return y
    
    def x_etabs_zap(self):
        x = []
        for _,row in self.df_zap_in_cisco.iterrows() :
            try:
                data_x = {}
                data_x["NOM"] = row.get("NOM_ZAP","")
                data_x["CODE_ZAP"] = row.get("CODE_ZAP","")
                rem = row.get("ratio_em",0) 
                rem = 0 if rem == 0  else self.normaliser_valeur_0_100(val=rem, min_val=45, max_val=60)
                req = row.get("ratio_eq",0) 
                eleve_2km = row.get("eleve_2km",0) 
                eau =  row.get("point_eau","NON")
                elec =  row.get("electricite","NON")
                ce = row.get("ratio_zce",0) 
                ce = 0 if ce == 0  else self.normaliser_valeur_0_100(val=ce, min_val=1000, max_val=20000)
                mlg_sc1 = self.normaliser_valeur_0_100(val=row.get("mlg_sc1",0), min_val=1, max_val=2)
                mlg_sc2 = self.normaliser_valeur_0_100(val=row.get("mlg_sc2",0), min_val=1, max_val=2)
                fr_sc1 = self.normaliser_valeur_0_100(val=row.get("fr_sc1",0), min_val=1, max_val=2)
                fr_sc2 = self.normaliser_valeur_0_100(val=row.get("fr_sc2",0), min_val=1, max_val=2)
                maths_sc1 = self.normaliser_valeur_0_100(val=row.get("maths_sc1",0), min_val=1, max_val=2)
                maths_sc2 = self.normaliser_valeur_0_100(val=row.get("maths_sc2",0), min_val=1, max_val=2)
                xx = [rem,req,eleve_2km,eau,elec,ce,mlg_sc1,mlg_sc2,fr_sc1,fr_sc2,maths_sc1,maths_sc2]
                data_x["X"] = round(stats.mean(xx),1)
            except Exception as e:
                data_x["X"] = 50
                print(f'erreur x_zaps pour {data_x["CODE_ZAP"]}: => {e}')
            x.append(data_x)

        return x
    
    def diagnostic_efficience(self, x, y):
        """
        Diagnostique l'efficience d'une zap selon sa position sur un scatter plot (x=ressources, y=resultat).
        x, y : pourcentages entre 0 et 100
        Bornes :
            minim : 0-33.33%
            moyen : 33.33-66.66%
            maxim : 66.66-100%
        Retourne un dict : {'diagnostic': str, 'remarque': str, 'efficient': bool}
        """
        def get_level(val):
            if val < 33.33:
                return 'minim'
            elif val < 66.66:
                return 'moyen'
            else:
                return 'maxim'

        niveau_x = get_level(x)
        niveau_y = get_level(y)

        cas = {
            ("minim", "minim"): "<b>Faibles ressources et faibles résultats : </b>La ZAP est en grande difficulté. Elle manque de moyens et cela se reflète directement dans les performances.",
            ("minim", "moyen"): "<b>Ressources faibles mais résultats moyens :</b> La ZAP démontre une bonne efficience, elle réussit à faire progresser les élèves malgré des moyens limités.",
            ("minim", "maxim"): "<b>Ressources faibles mais résultats élevés :</b> situation exceptionnelle d’excellente efficience. La ZAP exploite remarquablement bien ses ressources limitées.",
            ("moyen", "minim"): "<b>Ressources moyennes mais résultats faibles :</b> il y a un problème d’efficacité pédagogique ou de gestion. Les moyens existent mais ne sont pas bien valorisés.",
            ("moyen", "moyen"): "<b>Ressources et résultats moyens </b>: situation intermédiaire, La ZAP fonctionne normalement mais sans véritable point fort ni faiblesse majeure.",
            ("moyen", "maxim"): "<b>Ressources moyennes et résultats élevés :</b> bonne efficience, les moyens sont bien exploités et produisent des résultats supérieurs à la moyenne.",
            ("maxim", "minim"): "<b>Ressources élevées mais résultats faibles :</b> inefficience marquée. Les ressources ne sont pas converties en apprentissages. Un problème sérieux à corriger.",
            ("maxim", "moyen"): "<b>Ressources élevées mais résultats moyens :</b> efficience faible. Les résultats devraient être meilleurs au vu des moyens disponibles.",
            ("maxim", "maxim"): "<b>Ressources et résultats élevés :</b> situation idéale. La ZAP a les moyens et les utilise efficacement pour obtenir de très bons résultats."
        }

        remarque = cas[(niveau_x, niveau_y)]

        # Diagnostic détaillé (2-3 phrases explicites)
        efficient = (niveau_y == "maxim") or (niveau_y == "moyen" and niveau_x != "maxim")
        if (niveau_x, niveau_y) == ("maxim", "maxim"):
            diagnostic = (
                "la ZAP dispose de ressources abondantes et parvient à obtenir d'excellents résultats. "
                "La gestion des moyens est optimale et l'organisation pédagogique est efficace. "
                "C'est une situation idéale à maintenir et à valoriser."
            )
        elif (niveau_x, niveau_y) == ("minim", "maxim"):
            diagnostic = (
                "Malgré des ressources très limitées, la ZAP atteint des résultats remarquables. "
                "Cela témoigne d'une grande efficience et d'un engagement exceptionnel de l'équipe éducative. "
                "C'est un exemple à suivre pour d'autres établissements."
            )
        elif (niveau_x, niveau_y) == ("minim", "moyen"):
            diagnostic = (
                "la ZAP réussit à obtenir des résultats corrects avec peu de moyens. "
                "Elle fait preuve d'une bonne efficience et optimise ses ressources. "
                "Un accompagnement ciblé pourrait lui permettre d'aller encore plus loin."
            )
        elif (niveau_x, niveau_y) == ("moyen", "maxim"):
            diagnostic = (
                "Les moyens disponibles sont bien exploités et permettent d'obtenir des résultats supérieurs à la moyenne. "
                "la ZAP démontre une bonne organisation et une pédagogie efficace. "
                "Il s'agit d'une situation très satisfaisante."
            )
        elif (niveau_x, niveau_y) == ("moyen", "moyen"):
            diagnostic = (
                "la ZAP fonctionne normalement avec des ressources et des résultats dans la moyenne. "
                "Il n'y a pas de point faible majeur, mais aussi peu de points forts distinctifs. "
                "Des efforts ciblés pourraient permettre d'améliorer encore la performance."
            )
        else:
            # Tous les autres cas sont peu ou pas efficients
            if (niveau_x, niveau_y) == ("maxim", "moyen"):
                diagnostic = (
                    "la ZAP dispose de ressources importantes mais n'obtient que des résultats moyens. "
                    "Il existe un potentiel d'amélioration significatif en valorisant mieux les moyens disponibles. "
                    "Une analyse approfondie de la gestion et des pratiques pédagogiques est recommandée."
                )
            elif (niveau_x, niveau_y) == ("maxim", "minim"):
                diagnostic = (
                    "Malgré des ressources élevées, les résultats sont très faibles. "
                    "Ceci révèle une inefficience marquée et un problème sérieux dans l'utilisation des moyens. "
                    "Une intervention urgente est nécessaire pour redresser la situation."
                )
            elif (niveau_x, niveau_y) == ("moyen", "minim"):
                diagnostic = (
                    "la ZAP dispose de moyens corrects mais n'arrive pas à transformer ces ressources en résultats. "
                    "Il existe probablement des difficultés pédagogiques ou organisationnelles à résoudre. "
                    "Un accompagnement spécifique est conseillé."
                )
            else:  # ("minim", "minim")
                diagnostic = (
                    "la ZAP est en grande difficulté, avec peu de ressources et de très faibles résultats. "
                    "La situation est préoccupante et nécessite un soutien renforcé. "
                    "Un plan d'action prioritaire doit être envisagé."
                )

        return {
            'diagnostic': diagnostic,
            'remarque': remarque,
            'efficient': efficient
        }


    def interpretation_abandon(self,ecole: float, zap: float) -> str:
        """
        Interprète le taux d'abandon scolaire d'une zap
        et le compare à celui de la ZAP (commune).
        ecole et zap sont exprimés en pourcentage.
        """

        # Interprétation du taux de la ZAP
        if ecole < 5:
            niveau = "Très faible taux d'abandon : excellente rétention des élèves."
        elif ecole < 10:
            niveau = "Faible taux d'abandon : la majorité des élèves restent scolarisés."
        elif ecole < 20:
            niveau = "Taux d'abandon préoccupant : plusieurs élèves quittent encore la ZAP."
        else:
            niveau = "Taux d'abandon élevé : une grande partie des élèves sort prématurément du système."

        # Comparaison avec la ZAP
        if ecole < zap * 0.9:  # nettement meilleur (au moins 10% de différence relative)
            comparaison = "la ZAP fait nettement mieux que la moyenne de la commune (ZAP)."
            suggestion = "Poursuivre et consolider les pratiques positives (suivi parental, cantine, sensibilisation)."
        elif ecole <= zap * 1.1:  # similaire
            comparaison = "la ZAP est globalement au même niveau que la commune."
            suggestion = "Renforcer les actions locales conjointes avec la ZAP pour améliorer encore la rétention."
        else:  # moins bon
            comparaison = "la ZAP est en moins bonne situation que la commune."
            suggestion = "Identifier les causes spécifiques (absentéisme, pauvreté, éloignement) et mettre en place un suivi ciblé."
        
        return {
            'niveau': niveau,
            'comparaison': comparaison,
            'suggestion': suggestion
        }

    #tacage cadrans du PDF TdB
    def draw_border(self, canvas, doc):
        width, height = A3
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(2)
        canvas.rect(10, 10, width-20, height-20, stroke=1, fill=0)  # Cadre en marge de 10 pts

    #manao creation an'ilay fichier PDF
    def export_pdf(self):
        df = self.df_zap.copy()
        # Nettoyer les quotes et apostrophes dans NOM_ZAP
        #"colors.lightgrey, colors.whitesmoke, colors.beige, colors.lightblue, colors.lavender"
        row_zap = self.df_zap.iloc[0]
        row_cisco = self.df_cisco.iloc[0]
        row_dren = self.df_dren.iloc[0]

        df["ZAP"] = df["ZAP"].str.replace('"', '', regex=False).str.replace("'", '', regex=False)
        pdf_name = df["ZAP"].iloc[0].replace("'", '').replace('"', '').replace("'", '').replace("/", '-')
        zname = df.iloc[0]["ZAP"].replace('"', '').replace("'", '').replace("/", '-')
            
        # Création des répertoires pour le PDF
        #DREN_DIR = os.path.join('TDB', f'{df.iloc[0]["DREN"]}')
        DREN_DIR = os.path.join('/home/dpe/dpeplateforme/src/tdb/static/TDB/', f'{df.iloc[0]["DREN"]}')
        os.makedirs(DREN_DIR, exist_ok=True)
        CISCO_DIR = os.path.join(DREN_DIR, f'{df.iloc[0]["CISCO"]}')
        os.makedirs(CISCO_DIR, exist_ok=True)
        ZAP_DIR = os.path.join(CISCO_DIR, f'{zname}')
        os.makedirs(ZAP_DIR, exist_ok=True)
        CODE_ZAP =  df.iloc[0]['CODE_ZAP']
        output_path = os.path.join(ZAP_DIR, f'TDB_ZAP_{pdf_name}.pdf')

        # Configuration du document PDF
        doc = SimpleDocTemplate(
            output_path,
            pagesize=portrait(A3),
            topMargin=1*cm,
            bottomMargin=1*cm,
            leftMargin=0.15*cm,
            rightMargin=0.15*cm
        )

        # Styles
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        normal_style = styles['Normal']
        centered_style = ParagraphStyle(
            name="CenteredTitle",
            parent=normal_style,
            alignment=TA_CENTER,
            fontSize=11,
            spaceAfter=6
        )
        entete_style = ParagraphStyle(
            name="enteteTitle",
            parent=normal_style,
            alignment=TA_CENTER,
            fontSize=10,
            eAfter=3
        )
        item_style = ParagraphStyle(
            name="itemTitle",
            parent=normal_style,
            alignment=TA_LEFT,
            fontSize=8,
        )
        data_style = ParagraphStyle(
            name="dataTitle",
            parent=normal_style,
            alignment=TA_CENTER,
            fontSize=8,
        )
        tab_style = ParagraphStyle(
            "TabStyle",
            parent=styles["Normal"],
            leftIndent=40  
        )
        elements = []

        # --- En-tête personnalisé ---
        try:
            logo = RImage("assets/logomen.jpg", width=2.5*cm, height=2.5*cm)
        except Exception as e:
            logger.warning(f"Erreur lors du chargement de logomen.jpg: {e}")
            logo = Paragraph("", normal_style)

        try:
            icon = RImage("assets/tdb.jpg", width=4*cm, height=4*cm)
        except Exception as e:
            logger.warning(f"Erreur lors du chargement de tdb.jpg: {e}")
            icon = Paragraph("", normal_style)

        dren = Paragraph(f'DREN : <b>{df.iloc[0]["DREN"]}</b>', normal_style)
        cisco = Paragraph(f'CISCO : <b>{df.iloc[0]["CISCO"]}</b>', normal_style)
        zap = Paragraph(f'ZAP : <b>{df.iloc[0]["ZAP"]}</b>', normal_style)
        code = Paragraph(f'<b>CODE : {df.iloc[0]["CODE_ZAP"]}</b>', centered_style)


        men_content = [
            [logo],
            [Paragraph("Ministère de l'Education Nationale", centered_style)]
        ]
        cell_men = Table(men_content, colWidths=6*cm)
        cell_men.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
        ]))

        header_data = [
            [cell_men, Paragraph("<b>TABLEAU DE BORD 2024-2025</b>", centered_style), dren, icon],
            ["", zap, cisco, ""],
            ["", code, dren, ""]
        ]
        header_table = Table(header_data, colWidths=[7*cm, 10*cm, 7*cm, 4*cm], rowHeights=[1*cm]*3)
        header_table.setStyle(TableStyle([
            ("SPAN", (0, 0), (0, 1)),  # logo rowspan 2
            ("SPAN", (3, 0), (3, 2)),  # icon rowspan 3
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("ALIGN", (2, 0), (2, -1), "LEFT"),
            ("ALIGN", (3, 0), (3, -1), "CENTER"),
            ("FONTSIZE", (1, 1), (1, 1), 13),
            ("FONTSIZE", (2, 0), (2, 0), 13),
            ("FONTSIZE", (1, 2), (2, 2), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 15))


        # Titre Résultats scolaires
        res_title = Table([[Paragraph("RÉSULTATS SCOLAIRES", centered_style)]], colWidths=[28*cm])
        res_title.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
        ]))
        elements.append(res_title)
        elements.append(Spacer(1, 10))

        # Légende
        data_legende = [["", "Données non disponible"],["", "Données à vérifier"], ["", "Attention !"]]
        table_legende = Table(data_legende, colWidths=[1*cm, 13.3*cm])
        table_legende.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (0, 0), colors.lightblue), #manquant
            ("BACKGROUND", (0, 1), (0, 1), colors.yellow), #a verifier
            ("BACKGROUND", (0, 2), (0, 2), colors.red), # Attention
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))

        # En-têtes pour les tableaux de résultats
        entetes = [
            Paragraph("Matières", entete_style),
            Paragraph("Zap", entete_style),
            Paragraph("Cisco", entete_style),
            Paragraph("Dren", entete_style)
        ]

        # Tableaux taux d'abandon******************************************************
        data_abandon = [
            [Paragraph('Taux d\'abandon', entete_style), '', '', ''],
            entetes,
            ['', '', '', ''],
            ['CP1->CP2', f'{row_zap.get("txAbdcp1cp2","-1")}% ', f'{row_cisco.get("txAbdcp1cp2","-1")}% ', f'{row_dren.get("txAbdcp1cp2","-1")}% '],
            ['CP2->CE', f'{row_zap.get("txAbdcp2ce","-1")}% ', f'{row_cisco.get("txAbdcp2ce","-1")}% ', f'{row_dren.get("txAbdcp2ce","-1")}% '],
            ['CE->CM1', f'{row_zap.get("txAbdcecm1","-1")}% ', f'{row_cisco.get("txAbdcecm1","-1")}% ', f'{row_dren.get("txAbdcecm1","-1")}% '],
            ['CM1->CM2', f'{row_zap.get("txAbdcm1cm2","-1")}% ', f'{row_cisco.get("txAbdcm1cm2","-1")}% ', f'{row_dren.get("txAbdcm1cm2","-1")}% '],
            ['Ensemble', f'{row_zap.get("txAbdGlobal","-1")}% ', f'{row_cisco.get("txAbdGlobal","-1")}% ', f'{row_dren.get("txAbdGlobal","-1")}% '],
        ]
        #couleur pour txAbdon ensemble :
        e,z = float(str(row_zap.get("txAbdGlobal","-1")).replace(",",".")),float(str(row_cisco.get("txAbdGlobal","-1")).replace(",","."))
        bc = (colors.yellow if str(e).strip().startswith("-") else (colors.red if (z < e or e >= 20.0) else colors.white)) #couleur rouge si > 20% ou > txZap, sinon jaune si negatif et blanc si normale
        table_abandon = Table(data_abandon)
        table_abandon.setStyle(TableStyle([
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 3), (0, -1), "LEFT"), #item
            ("ALIGN", (1, 3), (-1, -1), "CENTER"), #data
            ("FONTSIZE", (0, 1), (-1, -1), 10), #item
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (1, -1), (1, -1), bc), #comparaison Ensemble Ecole Vs Zap
        ]))

        # Tableaux pourcentage redoublants **********************************************************
        redcp1 = row_zap.get("red_CP1_g","-1") 
        redcp2 = row_zap.get("red_CP2_g","-1") 
        redce = row_zap.get("red_CE_g","-1")  
        redcm1 = row_zap.get("red_CM1_g","-1")  
        redcm2 = row_zap.get("red_CM2_g","-1") 
        
        data_pred = [
            [Paragraph('Pourcentage des redoublants', entete_style), '', '', ''],
            entetes,
            ['', '', '', ''],
            ['CP1', f'{redcp1}%', row_cisco.get('red_CP1_g','-1'), row_dren.get('red_CP1_g','-1')],
            ['CP2', f'{redcp2}%', row_cisco.get('red_CP2_g','-1'), row_dren.get('red_CP2_g','-1')],
            ['CE', f'{redce}%', row_cisco.get('red_CE_g','-1'), row_dren.get('red_CE_g','-1')],
            ['CM1', f'{redcm1}%', row_cisco.get('red_CM1_g','-1'), row_dren.get('red_CM1_g','-1')],
            ['CM2', f'{redcm2}%', row_cisco.get('red_CM2_g','-1'), row_dren.get('red_CM2_g','-1')],
        ]
        table_pred = Table(data_pred)
        table_pred.setStyle(TableStyle([
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 3), (0, -1), "LEFT"), #item
            ("ALIGN", (1, 3), (-1, -1), "CENTER"), #data
            ("FONTSIZE", (0, 3), (-1, -1), 10), #item et data
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))

        # Table composite abandon + redoublants
        table_abred = Table([[table_abandon,"",table_pred]],colWidths=[7.20*cm,0.10*cm, 7.20*cm])

        # Tableaux taux de rétention **************************************************
        #Disparité selon retention garcons et fille
        rg_e = float(str(row_zap.get("txRetentionGarcons","0")).strip().replace(",","."))
        rf_e = float(str(row_zap.get("txRetentionFilles","0")).strip().replace(",","."))
        r_e = float(str(row_zap.get("txRetentionTotal","0")).strip().replace(",","."))
        rg_z = float(str(row_cisco.get("txRetentionGarcons","0")).strip().replace(",","."))
        rf_z = float(str(row_cisco.get("txRetentionFilles","0")).strip().replace(",","."))
        r_z = float(str(row_cisco.get("txRetentionTotal","0")).strip().replace(",","."))
        rg_c = float(str(row_dren.get("txRetentionGarcons","0")).strip().replace(",","."))
        rf_c = float(str(row_dren.get("txRetentionFilles","0")).strip().replace(",","."))
        r_c = float(str(row_dren.get("txRetentionTotal","0")).strip().replace(",","."))
        img_g = RImage(f'assets/garcons.png', width=1*cm, height=1.5*cm)
        img_f = RImage(f'assets/fille.png', width=1*cm, height=1.5*cm)

        # Sécuriser les divisions pour éviter float division by zero
        def safe_ratio(num, denom):
            try:
                if denom not in [-1,0, None] and np.isfinite(denom):
                    return num / denom
                else:
                    return np.nan
            except Exception:
                return np.nan

        ratio_z = safe_ratio(rf_e, rg_e)
        ratio_c = safe_ratio(rf_z, rg_z)
        ratio_d = safe_ratio(rf_c, rg_c)
        dp_z = ("-" if ratio_z is np.nan or not np.isfinite(ratio_z) or 0.97 <= ratio_z <= 1.03 else (img_f if ratio_z < 0.97 else img_g))
        dp_c = ("-" if ratio_c is np.nan or not np.isfinite(ratio_c) or 0.97 <= ratio_c <= 1.03 else (img_f if ratio_c < 0.97 else img_g))
        dp_d = ("-" if ratio_d is np.nan or not np.isfinite(ratio_d) or 0.97 <= ratio_d <= 1.03 else (img_f if ratio_d < 0.97 else img_g))

        data_ret = [
            [Paragraph("Taux de rétention", centered_style), "", "", ""],
            ["Garçons", f"{str(rg_e)}%", f"{str(rg_z)}%", f"{str(rg_c)}%"],
            ["Filles", f"{str(rf_e)}%", f"{str(rf_z)}%",f"{str(rf_c)}%"],
            ["Ensemble", f"{r_e}%", f"{r_z}%", f"{r_c}%"],
            ["Disparité", dp_z, dp_c, dp_d], 
        ]

        e,z = float(r_e),float(r_z)
        bc = (colors.yellow if (e < 0 or e >= 100) else (colors.red if (z > e or e < 50.0) else colors.white)) #couleur rouge si < 50% ou < txZap, sinon jaune si negatif et blanc si normale         

        table_ret = Table(data_ret)
        table_ret.setStyle(TableStyle([
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 1), (0, -1), "LEFT"), #item
            ("ALIGN", (1, 1), (-1, -1), "CENTER"), #data
            ("FONTSIZE", (0, 1), (-1, -1), 11), #item et data
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (1, 3), (1, 3), bc), #comparaison Ensemble Ecole Vs Zap
        ]))

        # Tableaux pourcentage des redoublants par genre*********************************
        rg_e = row_zap.get("red_garcons",-1) 
        rf_e = row_zap.get("red_fille",-1) 
        r_e = row_zap.get("red_ensemble",-1) 

        rg_z = row_cisco.get("red_garcons",-1) 
        rf_z = row_cisco.get("red_fille",-1) 
        r_z = row_cisco.get("red_ensemble",-1) 


        rg_c = row_dren.get("red_garcons",-1) 
        rf_c = row_dren.get("red_fille",-1) 
        r_c = row_dren.get("red_ensemble",-1) 

        e,z = float(r_e),float(r_z)
        bc = (colors.yellow if (e < 0 or e > 100) else (colors.red if (z < e or e >= 20.0) else colors.white)) #couleur rouge si > 20% ou > txZap, sinon jaune si negatif et blanc si normale
        img_g = RImage(f'assets/garcons.png', width=1*cm, height=1.5*cm)
        img_f = RImage(f'assets/fille.png', width=1*cm, height=1.5*cm)

        ratio_z2 = safe_ratio(rf_e, rg_e)
        ratio_c2 = safe_ratio(rf_z, rg_z)
        ratio_d2 = safe_ratio(rf_c, rg_c)
        dp_z = ("-" if ratio_z2 is np.nan or not np.isfinite(ratio_z2) or 0.97 <= ratio_z2 <= 1.03 else (img_g if ratio_z2 < 0.97 else img_f))
        dp_c = ("-" if ratio_c2 is np.nan or not np.isfinite(ratio_c2) or 0.97 <= ratio_c2 <= 1.03 else (img_g if ratio_c2 < 0.97 else img_f))
        dp_d = ("-" if ratio_d2 is np.nan or not np.isfinite(ratio_d2) or 0.97 <= ratio_d2 <= 1.03 else (img_g if ratio_d2 < 0.97 else img_f))
        data_red = [
            [Paragraph("Redoublants par genre", entete_style), "", "", ""],
            ["Garçons", f"{rg_e}%", f"{rg_z }%", f"{rg_c}%"],
            ["Filles", f"{rf_e}%", f"{rf_z}%", f"{rf_c}%"],
            ["Ensemble", f"{r_e}%", f"{r_z}%", f"{r_c}%"],
            ["Disparité", dp_z, dp_c, dp_d],
        ]
        table_red = Table(data_red)
        table_red.setStyle(TableStyle([
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"), #ENTETE
            ("ALIGN", (0, 1), (0, -1), "LEFT"), #ITEM
            ("FONTSIZE", (0, 1), (0, -1), 11),
            ("FONTSIZE", (1, 1), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (1, 3), (1, 3), bc), #comparaison Ensemble Ecole Vs Zap

        ]))

        table_retred = Table([[table_ret,"", table_red]], colWidths=[7.20*cm,0.10*cm, 7.20*cm])

        # Tableaux examens
        titre_ex = Paragraph(
            "Score moyen (SM) sur 20 et pourcentaged\'lèves ayant obtenu une note supérieure ou égale à 10/20 (Note >= 10) Résultats CEPE : 2025",
            centered_style
        )
        ttl2 = Paragraph("Pourcentage des admis au CEPE", entete_style)
        entetes = [
            ["Matières", "zap", "", "ZAP", "", "CISCO", ""],
            ["", "SM", "Note >= 10", "SM", "Note >= 10", "SM", "Note >= 10"]
        ]
        tx_admis_g =  row_zap.get("tx_admis_g", 0)
        tx_admis_f = row_zap.get("tx_admis_f", 0)
        tx_admis = row_zap.get("tx_admis", 0)

        tx_admis_g_z =  row_cisco.get("tx_admis_g", 0)
        tx_admis_f_z = row_cisco.get("tx_admis_f", 0)
        tx_admis_z = row_cisco.get("tx_admis", 0)

        tx_admis_g_c =  row_dren.get("tx_admis_g", 0)
        tx_admis_f_c = row_dren.get("tx_admis_f", 0)
        tx_admis_c = row_dren.get("tx_admis", 0)

        ratio_ze = safe_ratio(tx_admis_f, tx_admis_g)
        ratio_zz = safe_ratio(tx_admis_g_z, tx_admis_f_z)
        ratio_zc = safe_ratio(tx_admis_g_c, tx_admis_f_c)
        dp_z = ("-" if ratio_ze is np.nan or not np.isfinite(ratio_ze) or 0.97 <= ratio_ze <= 1.03 else (img_f if ratio_ze < 0.97 else img_g))
        dp_c = ("-" if ratio_zz is np.nan or not np.isfinite(ratio_zz) or 0.97 <= ratio_zz <= 1.03 else (img_f if ratio_zz < 0.97 else img_g))
        dp_d = ("-" if ratio_zc is np.nan or not np.isfinite(ratio_zc) or 0.97 <= ratio_zc <= 1.03 else (img_f if ratio_zc < 0.97 else img_g))
        
        data_exam = [
            [titre_ex, "", "", "", "", "", ""], #0 
            ["Matières", "Zap", "", "Cisco", "", "Dren", ""], #1
            ["", "SM", " >= 10", "SM", " >= 10", "SM", " >= 10"], #2
            ["Malagasy", row_zap.get("sm_mlg",0), row_zap.get("sup_10_mlg",0), row_cisco.get("sm_mlg",0), row_cisco.get("sup_10_mlg",0),row_dren.get("sm_mlg",0), row_dren.get("sup_10_mlg",0)], #3
            ["  -Fahazoana lahatsoratra", "", "", "", "", "", ""], #4
            ["  -Fitsipika", "", "", "", "", "", ""], #5
            ["  -Fanazarana hanoratra", "", "", "", "", "", ""], #6
            ["Français", row_zap.get("sm_fr",0), row_zap.get("sup_10_fr",0), row_cisco.get("sm_fr",0), row_cisco.get("sup_10_fr",0),row_dren.get("sm_fr",0), row_dren.get("sup_10_fr",0)], #7
            ["Mathématiques", row_zap.get("sm_maths",0), row_zap.get("sup_10_maths",0), row_cisco.get("sm_maths",0), row_cisco.get("sup_10_maths",0),row_dren.get("sm_maths",0), row_dren.get("sup_10_maths",0)], #8
            ["  -Opération", row_zap.get("sm_op",0), row_zap.get("sup_10_op",0), row_cisco.get("sm_op",0), row_cisco.get("sup_10_op",0),row_dren.get("sm_op",0), row_dren.get("sup_10_op",0)], #9
            ["  -Problème", row_zap.get("sm_probleme",0), row_zap.get("sup_10_probleme",0), row_cisco.get("sm_probleme",0), row_cisco.get("sup_10_probleme",0),row_dren.get("sm_probleme",0), row_dren.get("sup_10_probleme",0)], #10
            ["Histroire", row_zap.get("sm_tfm",0), row_zap.get("sup_10_tfm",0), row_cisco.get("sm_tfm",0), row_cisco.get("sup_10_tfm",0),row_dren.get("sm_tfm",0), row_dren.get("sup_10_tfm",0)], #11
            ["Geographie", row_zap.get("sm_geo",0), row_zap.get("sup_10_geo",0), row_cisco.get("sm_geo",0), row_cisco.get("sup_10_geo",0),row_dren.get("sm_geo",0), row_dren.get("sup_10_geo",0)], #12
            ["SVT", row_zap.get("sm_svt",0), row_zap.get("sup_10_svt",0), row_cisco.get("sm_svt",0), row_cisco.get("sup_10_svt",0),row_dren.get("sm_svt",0), row_dren.get("sup_10_svt",0)], #13
            [ttl2, "", "", "", "", "", ""], #14
            ["Garçons", f"{tx_admis_g}%", "",f"{tx_admis_g_z}%", "", f"{tx_admis_g_c}", ""], #15
            ["Filles", f"{tx_admis_f}%", "", f"{tx_admis_f_z}%", "", f"{tx_admis_f_c}", ""], #16
            ["Ensemble", f"{tx_admis}%", "", f"{tx_admis_z}%", "", f"{tx_admis_c}", ""], #17
            ["Disparité au dépens des", dp_z, "", dp_c, "", dp_d, ""], #18
        ]
        table_exam = Table(data_exam, colWidths=[5*cm, 1.41*cm, 1.41*cm, 1.41*cm, 1.41*cm, 1.41*cm, 1.43*cm])
        bc_mlg = colors.red if row_zap.get("sm_mlg",0) < 10 else colors.white
        bc_fr = colors.red if row_zap.get("sm_fr",0) < 10 else colors.white
        bc_maths = colors.red if row_zap.get("sm_maths",0) < 10 else colors.white
        bc_op = colors.red if row_zap.get("sm_op",0) < 10 else colors.white
        bc_pb = colors.red if row_zap.get("sm_probleme",0) < 10 else colors.white
        bc_tfm = colors.red if row_zap.get("sm_tfm",0) < 10 else colors.white
        bc_geo = colors.red if row_zap.get("sm_geo",0) < 10 else colors.white
        bc_svt = colors.red if row_zap.get("sm_svt",0) < 10 else colors.white

        table_exam.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 2), colors.whitesmoke), #titre matieres et cisco
            ("BACKGROUND", (0, 15), (-1, 15), colors.whitesmoke), #titre cepe admis
            ("ALIGN", (0, 1), (-1, 2), "CENTER"),
            ("ALIGN", (0, 3), (0, 14), "LEFT"), #item
            ("ALIGN", (0, 16), (0, -1), "LEFT"), #item
            ("ALIGN", (0, 15), (-1, 15), "CENTER"), #titre
            ("ALIGN", (1, 3), (-1, -1), "CENTER"), #data
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),

            ("BACKGROUND", (1, 4), (-1, 6), colors.lightblue), #manquant

            ("BACKGROUND", (1, 3), (1, 3), bc_mlg), # Attention Malagasy SM < 10
            ("BACKGROUND", (1, 7), (1, 7), bc_fr), # Attention Fr SM < 10
            ("BACKGROUND", (1, 8), (1, 8), bc_maths), # Attention Maths SM < 10
            ("BACKGROUND", (1, 9), (1, 9), bc_op), # Attention OP SM < 10
            ("BACKGROUND", (1, 10), (1, 10), bc_pb), # Attention Pblm SM < 10
            ("BACKGROUND", (1, 11), (1, 11), bc_tfm), # Attention tfm SM < 10
            ("BACKGROUND", (1, 12), (1, 12), bc_geo), # Attention geo SM < 10
            ("BACKGROUND", (1, 13), (1, 13), bc_svt), # Attention svt SM < 10

            ("SPAN", (0, 0), (-1, 0)),  # "Titre" sur toutes colones
            ("SPAN", (0, 1), (0, 2)),  # "Matières" sur 2 lignes

            ("SPAN", (1, 1), (2, 1)),  # "zap" couvre 2 colonnes
            ("SPAN", (3, 1), (4, 1)),  # "ZAP" couvre 2 colonnes
            ("SPAN", (5, 1), (6, 1)),  # "CISCO" couvre 2 colonnes

            ("SPAN", (0, 14), (-1, 14)),  # "Pourcentage des admis au CEPE"
            ("SPAN", (1, 15), (2, 15)),  # "zap" couvre 2 colonnes
            ("SPAN", (3, 15), (4, 15)),  # "ZAP" couvre 2 colonnes
            ("SPAN", (5, 15), (6, 15)),  # "CISCO" couvre 2 colonnes
            ("SPAN", (1, 16), (2, 16)),  # "zap" couvre 2 colonnes
            ("SPAN", (3, 16), (4, 16)),  # "ZAP" couvre 2 colonnes
            ("SPAN", (5, 16), (6, 16)),  # "CISCO" couvre 2 colonnes
            ("SPAN", (1, 17), (2, 17)),  # "zap" couvre 2 colonnes
            ("SPAN", (3, 17), (4, 17)),  # "ZAP" couvre 2 colonnes
            ("SPAN", (5, 17), (6, 17)),  # "CISCO" couvre 2 colonnes
            ("SPAN", (1, 18), (2, 18)),  # "zap" couvre 2 colonnes
            ("SPAN", (3, 18), (4, 18)),  # "ZAP" couvre 2 colonnes
            ("SPAN", (5, 18), (6, 18)),  # "CISCO" couvre 2 colonnes

            ("FONTSIZE", (0, 0), (-1, -1), 10),
        ]))
        #, colWidths=[2.1*cm, 1.5*cm, 1.5*cm, 1.6*cm]
        # Table externe pour aligner côte à côte
        table_gauche = Table([[table_legende], [table_abred], [table_retred]],colWidths=[14.5*cm])
        table_droite = Table([[table_exam]],colWidths=[14.5*cm])

        resultats_table = Table([[table_gauche," ", table_droite]],colWidths=[14.5*cm,0.25*cm,14.5*cm])
        resultats_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        elements.append(resultats_table)


        # Ressources
        # Titre Résultats scolaires
        res_title = Table([[Paragraph("RESSOURCES SCOLAIRES", centered_style)]], colWidths=[28*cm])
        res_title.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
        ]))
        elements.append(res_title)
        elements.append(Spacer(0*cm, 0.3*cm))

        # En-têtes pour les tableaux de résultats
        entete_res = [
            Paragraph("Ressources", entete_style),
            Paragraph("Zap", entete_style),
            Paragraph("Cisco", entete_style),
            Paragraph("Dren", entete_style)
        ]
        nbr_eleves = row_zap.get("nombre_eleves", 0)
        ens_classe = row_zap.get("ens_classe", 0)
        ens_im = row_zap.get("ens_im", 0)
        fram_sub = row_zap.get("fram_sub", 0)
        fram_nonsub = row_zap.get("fram_nonsub", 0)
        nombre_section = row_zap.get("nombre_section", 0)
        ecole_continue = row_zap.get("ecole_continue", 0)
        eleve_2km = row_zap.get("eleve_2km", 0)
        point_eau = row_zap.get("point_eau", 0)
        electricite = row_zap.get("electricite", 0)

        nbr_eleves_z = row_cisco.get("nombre_eleves", 10)
        ens_classe_z = row_cisco.get("ens_classe", 10)
        ens_im_z = row_cisco.get("ens_im", 10)
        fram_sub_z = row_cisco.get("fram_sub", 10)
        fram_nonsub_z = row_cisco.get("fram_nonsub",10)
        nombre_section_z = row_cisco.get("nombre_section", 10)
        ecole_continue_z = row_cisco.get("ecole_continue", 10)
        eleve_2km_z = row_cisco.get("eleve_2km", 0)
        point_eau_z = row_cisco.get("point_eau", 0)
        electricite_z = row_cisco.get("electricite", 0)

        nbr_eleves_c = row_dren.get("nombre_eleves", 10)
        ens_classe_c = row_dren.get("ens_classe", 10)
        ens_im_c = row_dren.get("ens_im", 10)
        fram_sub_c = row_dren.get("fram_sub", 10)
        fram_nonsub_c = row_dren.get("fram_nonsub",10)
        nombre_section_c = row_dren.get("nombre_section", 10)
        ecole_continue_c = row_dren.get("ecole_continue", 10)
        eleve_2km_c = row_dren.get("eleve_2km", 0)
        point_eau_c = row_dren.get("point_eau", 0)
        electricite_c = row_dren.get("electricite", 0)

        data_g = [
            entete_res,
            ["Nombre d’élèves",f"{nbr_eleves}",f"{nbr_eleves_z}",f"{nbr_eleves_c}"],
            ["Nombre d’enseignant en classe",f"{ens_classe}",f"{ens_classe_z}",f"{ens_classe_c}"],
            ["Fonctionnaire et contractuels",f"{ens_im}",f"{ens_im_z}",f"{ens_im_c}"],
            ["FRAM subventionnés",f"{fram_sub}",f"{fram_sub_z}",f"{fram_sub_c}"],
            ["FRAM non subventionnés",f"{fram_nonsub}",f"{fram_nonsub_z}",f"{fram_nonsub_c}"],
            ["Nombre de classes pédagogiques",f"{nombre_section}",f"{nombre_section_z}",f"{nombre_section_c}"],
            ["Contexte","","",""],
            ["zaps continues",f"{ecole_continue}",f"{ecole_continue_z}%",f"{ecole_continue_c}%"],
            ["Elèves vivant à moins de 2km de leur zap",f"{eleve_2km}%",f"{eleve_2km_z}",f"{eleve_2km_c}%"],
            ["Existence de point d'eau",f"{point_eau}",f"{point_eau_z}%",f"{point_eau_c}%"],
            ["Existence de l'électricité",f"{electricite}",f"{electricite_z}%",f"{electricite_c}%"],
        ]

        table_res_g = Table(data_g)
        table_res_g.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke), #entete ecole zap cisco
            ("BACKGROUND", (0, 7), (-1, 7), colors.whitesmoke), #entete contexte
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 7), (-1, 7), "CENTER"),#entete contexte
            ("SPAN", (0, 7), (-1, 7)),  # "Context" sur toutes colones
            ("ALIGN", (0, 0), (0, 6), "LEFT"),
            ("ALIGN", (0, 8), (0, -1), "LEFT"),
            ("FONTSIZE", (1, 1), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))
        ratio_em = row_zap.get("ratio_em", 0)
        ratio_eq = row_zap.get("ratio_eq", 0)
        ratio_cpsdc = row_zap.get("ratio_cpsdc", 0)
        ratio_epa = row_zap.get("ratio_epa", 0)
        ratio_wc_com = row_zap.get("ratio_wc_com", 0)
        ratio_wc_f = row_zap.get("ratio_wc_f", 0)
        ratio_emlg = row_zap.get("ratio_emlg", 0)
        ratio_emths = row_zap.get("ratio_emths", 0)
        ratio_efrs = row_zap.get("ratio_efrs", 0)
        montant_ce = row_zap.get("montant_ce", 0)

        ratio_em_z = row_cisco.get("ratio_em", 0)
        ratio_eq_z = row_cisco.get("ratio_eq", 0)
        ratio_cpsdc_z = row_cisco.get("ratio_cpsdc", 0)
        ratio_epa_z = row_cisco.get("ratio_epa", 0)
        ratio_wc_com_z = row_cisco.get("ratio_wc_com", 0)
        ratio_wc_f_z = row_cisco.get("ratio_wc_f", 0)
        ratio_emlg_z = row_cisco.get("ratio_emlg", 0)
        ratio_emths_z = row_cisco.get("ratio_emths", 0)
        ratio_efrs_z = row_cisco.get("ratio_efrs", 0)
        montant_ce_z = row_cisco.get("montant_ce", 0)

        ratio_em_c = row_dren.get("ratio_em", 0)
        ratio_eq_c = row_dren.get("ratio_eq", 0)
        ratio_cpsdc_c = row_dren.get("ratio_cpsdc", 0)
        ratio_epa_c = row_dren.get("ratio_epa", 0)
        ratio_wc_com_c = row_dren.get("ratio_wc_com", 0)
        ratio_wc_f_c = row_dren.get("ratio_wc_f", 0)
        ratio_emlg_c = row_dren.get("ratio_emlg", 0)
        ratio_emths_c = row_dren.get("ratio_emths", 0)
        ratio_efrs_c = row_dren.get("ratio_efrs", 0)
        montant_ce_c = row_dren.get("montant_ce", 0)


        data_d = [
            entete_res, #0
            ['Nombre d’élèves par maître',f'{ratio_em}',f'{ratio_em_z}',f'{ratio_em_c}'], #1
            ['Pourcentage des enseignants qualifiés',f'{ratio_eq}%',f'{ratio_eq_z}%',f'{ratio_eq_c}%'], #2
            ['Ratio classes pédagogiques par salle',f'{ratio_cpsdc}',f'{ratio_cpsdc_z}',f'{ratio_cpsdc_c}'], #3
            ['Nombred\'lèves par place assise',f'{ratio_epa}',f'{ratio_epa_z}',f'{ratio_epa_c}'], #4
            ['Nombred\'lèves par Latrine communes',f'{ratio_wc_com}',f'{ratio_wc_com_z}',f'{ratio_wc_com_c}'], #5
            ['Nombre de filles par latrine pour filles',f'{ratio_wc_f}',f'{ratio_wc_f_z}',f'{ratio_wc_f_c}'], #6
            ['Nombred\'lèves par manuel Malagasy',f'{ratio_emlg}',f'{ratio_emlg_z}',f'{ratio_emlg_c}'], #7
            ['Nombred\'lèves par manuel Maths',f'{ratio_emths}',f'{ratio_emths_z}',f'{ratio_emths_c}'], #8
            ['Nombred\'lèves par manuel Francçais',f'{ratio_efrs}',f'{ratio_efrs_z}',f'{ratio_efrs_c}'], #9
            ['Ressources financières en Ariary','','',''], #10
            ['Caisse zaps/Subvention/Autres',f'{montant_ce}',f'{montant_ce_z}',f'{montant_ce_c}'], #11
        ]
        bc_epa = colors.yellow if (ratio_epa <= 0 or ratio_epa >=7) else colors.white
        table_res_d = Table(data_d)
        table_res_d.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("BACKGROUND", (0, 10), (-1, 10), colors.whitesmoke),

            ("BACKGROUND", (1, 4), (1, 4), bc_epa),

            ("SPAN", (0, 10), (-1, 10)), # Res Financieres
            ("ALIGN", (0, 11), (-1, 10), "CENTER"),  # Res Financieres
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 1), (0, 10), "LEFT"),
            ("ALIGN", (0, 12), (0, -1), "LEFT"),
            ("FONTSIZE", (1, 1), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ]))

        table_ress = Table([[table_res_g,"",table_res_d]], colWidths=[14.25*cm,0.10*cm,14.25*cm])
        table_ress.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        elements.append(table_ress)
        
        elements.append(Spacer(0*cm, 0.5*cm))


        # Ressources
        # Titre Résultats scolaires
        res_title = Table([[Paragraph("EFFICIENCE", centered_style)]], colWidths=[28*cm])
        res_title.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
        ]))
        elements.append(res_title)
        elements.append(Spacer(0*cm, 0.3*cm))


        #--- Graphique de nuages
        y_etabs = self.y_etabs_zap()
        x_etabs = self.x_etabs_zap()

        # --- Données  ---
        x = [float(x["X"]) for x in x_etabs]  # ressources en %
        y = [float(y["Y"]) for y in y_etabs]  # ressources en %
        labels = [e["NOM"] for e in x_etabs] #labels
        # --- Création du graphique ---
        fig, ax = plt.subplots(figsize=(6,6))

        # --- Couleurs de fond pour les cadrans ---
        # Rouge clair si x<33.33 et y<33.33
        # Définir les seuils
        seuil_bas = 33.33
        seuil_milieu = 66.67  # 100 - 33.33

        # Rouge clair : y < 33.33 et x > 66.67 (Zone rouge ratsy be)
        ax.axhspan(0, seuil_bas, xmin=seuil_milieu/100, xmax=1,facecolor='lightcoral', alpha=0.2)
        # Orange clair - Condition 1 : y <= 33.33 et x entre 33.33 et 66.67
        #Zone avertissement (diagonale 2 coin droite)
        ax.axhspan(0, seuil_bas, xmin=seuil_bas/100, xmax=seuil_milieu/100,facecolor='lightyellow', alpha=0.2)
        # Orange clair - Condition 2 : y entre 33.33 et 66.67 et x >= 66.67
        ax.axhspan(seuil_bas, seuil_milieu, xmin=seuil_milieu/100, xmax=1, facecolor='lightyellow', alpha=0.2)
        # Vert clair : y > 66.67 et x <= 66.67
        #Zone tres bien (coin huat gauche)
        ax.axhspan(seuil_milieu, 100, xmin=0, xmax=seuil_bas/100, facecolor='green', alpha=0.3)
        #Zone avertissement (diagonale 2 coin gauche)
        ax.axhspan(seuil_bas, seuil_milieu, xmin=0, xmax=seuil_bas/100,facecolor='lightgreen', alpha=0.2)
        # Orange clair - Condition 2 : y entre 33.33 et 66.67 et x >= 66.67
        ax.axhspan(seuil_milieu, 100, xmin=seuil_bas/100, xmax=seuil_milieu/100, facecolor='lightgreen', alpha=0.2)
        # Blanc clair : x et y ont la même borne (zone diagonale)

        # Créer un masque pour la zone où x ≈ y
        for i in range(100):
            x_val = i / 100
            y_val = i / 100
            # Ajouter une petite bande autour de la diagonale
            ax.axhspan(y_val-0.5/100, y_val+0.5/100, xmin=x_val-0.5/100, xmax=x_val+0.5/100, facecolor='lightgray', alpha=0.2)

        # Alternative plus simple pour la zone diagonale (approximation avec plusieurs rectangles)
        # Pour une zone plus large autour de la diagonale :
        ax.axhspan(0, seuil_bas, xmin=0, xmax=seuil_bas/100, facecolor='lightgray', alpha=0.2)
        ax.axhspan(seuil_bas, seuil_milieu, xmin=seuil_bas/100, xmax=seuil_milieu/100, facecolor='lightgray', alpha=0.2)
        ax.axhspan(seuil_milieu, 100, xmin=seuil_milieu/100, xmax=1, facecolor='lightgray', alpha=0.2)

        #Image de fond de chaque cadrans  :

        emojis = {
            "neutre": Image.open(os.path.join("assets","images","emoji","neutre.webp")),
            "sweat": Image.open(os.path.join("assets","images","emoji","sweat.webp")),
            "smiling": Image.open(os.path.join("assets","images","emoji","smiling.webp")),
            "confused": Image.open(os.path.join("assets","images","emoji","confused.webp")),
            "crying": Image.open(os.path.join("assets","images","emoji","crying.webp"))
        }
        # Définir les cadrans
        quadrants = [
            {"x": 0, "y": 66.66, "img": "sweat"},
            {"x": 33.33, "y": 66.66, "img": "smiling"},
            {"x": 66.66, "y": 66.66, "img": "neutre"},
            {"x": 0, "y": 33.33, "img": "smiling"},
            {"x": 33.33, "y": 33.33, "img": "neutre"},
            {"x": 66.66, "y": 33.33, "img": "confused"},
            {"x": 0, "y": 0, "img": "neutre"},
            {"x": 33.33, "y": 0, "img": "confused"},
            {"x": 66.66, "y": 0, "img": "crying"},
        ]

        for q in quadrants:
            ax.imshow(emojis[q["img"]], extent=[q["x"], q["x"] + 33.33, q["y"], q["y"] + 33.33],aspect='auto', alpha=0.5, zorder=0)

        # --- Scatter plot ---
        ax.scatter(x, y, s=60, color="black")
        #marker='h',  facecolors='green',

        # --- texte nom de l'ecole concerné point seulement ---
        x_ecole, y_ecole = 0,0
        for c,z in zip(x_etabs, y_etabs) :
            if c["CODE_ZAP"] == CODE_ZAP:
                ax.text(c["X"]+1, z["Y"]+1, "*" + c["NOM"], fontsize=10)
                ax.scatter(c["X"], z["Y"], s=80, marker='H',  facecolors='blue')
                x_ecole, y_ecole = c["X"],z["Y"]
                break

        # --- Quadrillage ---
        ax.set_xticks([0, 33.33, 66.66, 100])
        ax.set_yticks([0, 33.33, 66.66, 100])
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 100)
        ax.grid(True, linestyle="--", alpha=0.6)

        ax.set_xlabel("Ressources (%)")
        ax.set_ylabel("Résultats (%)")
        ax.set_title("Efficience")

        # --- Sauvegarde vers buffer ---
        plt.tight_layout()
        plt.savefig(f'{str(df.iloc[0]["CODE_ZAP"])}_sct.png')
        plt.close(fig)

        # --- Intégration dans le PDF ---
        img_scatter = RImage(f'{str(df.iloc[0]["CODE_ZAP"])}_sct.png', width=20*cm, height=8*cm)

        # Création de l’objet Image ReportLab
        #img_line = RImage(f'{str(df.iloc[0]["CODE_ZAP"])}_line.png', width=12*cm, height=8*cm)

        #table_grgh = Table([[img_scatter,"",img_line]], colWidths=[13*cm,0.5*cm,13*cm])
        table_grgh = Table([[img_scatter]], colWidths=[26*cm])
        table_grgh.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER")
        ]))
        elements.append(table_grgh)
        elements.append(Spacer(1*cm, 10))
        # Diagnostique
        para = Paragraph("<para leftIndent=40><u><b>Diagnostic et Remarques sur les résultats de la ZAP:</b></u></para>", styles["Normal"])
        elements.append(para)
        diagnostic_efficience = self.diagnostic_efficience(x=x_ecole, y=y_ecole)

        eff1 = diagnostic_efficience["diagnostic"]
        eff2 = diagnostic_efficience["remarque"]

        ae,az =row_zap.get("txAbdGlobal",0),row_cisco.get("txAbdGlobal",0)
        interpretation_abandon = self.interpretation_abandon(ae,az)
        abd1 = interpretation_abandon["niveau"]
        abd2 = interpretation_abandon["comparaison"]
        abd3 = interpretation_abandon["suggestion"]

        elements.append(Spacer(0.5*cm, 5))
        elements.append(Paragraph(eff2,tab_style))
        elements.append(Paragraph(eff1,tab_style))
        elements.append(Paragraph(abd1,tab_style))
        elements.append(Paragraph(abd2,tab_style))
        elements.append(Paragraph(abd3, tab_style))
        # Générer le PDF
        try:
            doc.build(elements, onFirstPage=self.draw_border, onLaterPages=self.draw_border)
            #logger.info(f"PDF généré avec succès : {output_path}")
            os.remove(f'{str(df.iloc[0]["CODE_ZAP"])}_sct.png')
        except Exception as e:
            logger.error(f"Erreur lors de la génération du PDF {output_path} : {e}")