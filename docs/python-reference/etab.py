import pandas as pd
import numpy as np
import logging
import statistics as stats


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Etab():
   
    """
    df_0 : dataframe pour l'année scolaire précédente d'un établissement
    df_1 : dataframe pour l'année scolaire en cours d'un établissement
    """
    def __init__(self, df_0, df_1):
        self.df_0, self.df_1 = {}, {}
        self.tables = ["tdb_v_a1", "tdb_v_d1", "tdb_v_e1", "tdb_v_e4", "tdb_v_g1_section", "tdb_v_h1_cantine", 
                       "tdb_v_j1_sdc", "tdb_v_j2_latrine", "tdb_v_k1_place", "tdb_v_l1_manuel",
                       "tdb_v_ce", "v_sm_cepe"]

        for t in self.tables:
            if t in df_0:
                self.df_0[t] = df_0[t].iloc[0] if not df_0[t].empty else None
            if t in df_1:
                self.df_1[t] = df_1[t].iloc[0] if not df_1[t].empty else None

        self.df_1["tdb_v_p1"] = df_1["tdb_v_p1"]

    def abandon(self):
        res = []
        try:
            # CP1 → CP2
            cp1_0 = self.df_0["tdb_v_e1"]["T1_G"] + self.df_0["tdb_v_e1"]["T1_F"]
            abd_cp1cp2_g = self.df_0["tdb_v_e1"]["T1_G"] - (
                self.df_1["tdb_v_e1"]["T1_G_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T2_G_PASSANT"]
                - self.df_1["tdb_v_e1"]["T2_G_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T2_G_TRANSFERT"]
            )
            abd_cp1cp2_f = self.df_0["tdb_v_e1"]["T1_F"] - (
                self.df_1["tdb_v_e1"]["T1_F_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T2_F_PASSANT"]
                - self.df_1["tdb_v_e1"]["T2_F_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T2_F_TRANSFERT"]
            )
            abd_cp1cp2 = abd_cp1cp2_g + abd_cp1cp2_f
            txAbdcp1cp2 = round((abd_cp1cp2 * 100 / cp1_0), 1) if cp1_0 not in [0, None] and np.isfinite(cp1_0) else -1

            # CP2 → CE
            cp2_0 = self.df_0["tdb_v_e1"]["T2_G"] + self.df_0["tdb_v_e1"]["T2_F"]
            abd_cp2ce_g = self.df_0["tdb_v_e1"]["T2_G"] - (
                self.df_1["tdb_v_e1"]["T2_G_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T3_G_PASSANT"]
                - self.df_1["tdb_v_e1"]["T3_G_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T3_G_TRANSFERT"]
            )
            abd_cp2ce_f = self.df_0["tdb_v_e1"]["T2_F"] - (
                self.df_1["tdb_v_e1"]["T2_F_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T3_F_PASSANT"]
                - self.df_1["tdb_v_e1"]["T3_F_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T3_F_TRANSFERT"]
            )
            abd_cp2ce = abd_cp2ce_g + abd_cp2ce_f
            txAbdcp2ce = round((abd_cp2ce * 100 / cp2_0), 1) if cp2_0 not in [0, None] and np.isfinite(cp2_0) else -1

            # CE → CM1
            ce_0 = self.df_0["tdb_v_e1"]["T3_G"] + self.df_0["tdb_v_e1"]["T3_F"]
            abd_cecm1_g = self.df_0["tdb_v_e1"]["T3_G"] - (
                self.df_1["tdb_v_e1"]["T3_G_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T4_G_PASSANT"]
                - self.df_1["tdb_v_e1"]["T4_G_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T4_G_TRANSFERT"]
            )
            abd_cecm1_f = self.df_0["tdb_v_e1"]["T3_F"] - (
                self.df_1["tdb_v_e1"]["T3_F_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T4_F_PASSANT"]
                - self.df_1["tdb_v_e1"]["T4_F_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T4_F_TRANSFERT"]
            )
            abd_cecm1 = abd_cecm1_g + abd_cecm1_f
            txAbdcecm1 = round((abd_cecm1 * 100 / ce_0), 1) if ce_0 not in [0, None] and np.isfinite(ce_0) else -1

            # CM1 → CM2
            cm1_0 = self.df_0["tdb_v_e1"]["T4_G"] + self.df_0["tdb_v_e1"]["T4_F"]
            abd_cm1cm2_g = self.df_0["tdb_v_e1"]["T4_G"] - (
                self.df_1["tdb_v_e1"]["T4_G_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T5_G_PASSANT"]
                - self.df_1["tdb_v_e1"]["T5_G_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T5_G_TRANSFERT"]
            )
            abd_cm1cm2_f = self.df_0["tdb_v_e1"]["T4_F"] - (
                self.df_1["tdb_v_e1"]["T4_F_REDOUBLANT"]
                + self.df_1["tdb_v_e1"]["T5_F_PASSANT"]
                - self.df_1["tdb_v_e1"]["T5_F_NOUVEAU"]
                - self.df_1["tdb_v_e1"]["T5_F_TRANSFERT"]
            )
            abd_cm1cm2 = abd_cm1cm2_g + abd_cm1cm2_f
            txAbdcm1cm2 = round((abd_cm1cm2 * 100 / cm1_0), 1) if cm1_0 not in [0, None] and np.isfinite(cm1_0) else -1

            # Taux global d'abandon du CP1 au CM2
            total_0 = cp1_0 + cp2_0 + ce_0 + cm1_0
            total_abd = abd_cp1cp2 + abd_cp2ce + abd_cecm1 + abd_cm1cm2
            txAbdGlobal = round((total_abd * 100 / total_0), 1) if total_0 not in [0, None] and np.isfinite(total_0) else -1

        except Exception as e:
            logger.error(f"etab::Etab => Erreur calcul abandon: {e}")
            txAbdcp1cp2 = txAbdcp2ce = txAbdcecm1 = txAbdcm1cm2 = txAbdGlobal = -1

        # Retourner les résultats
        res.append({
            "txAbdcp1cp2": txAbdcp1cp2,
            "txAbdcp2ce": txAbdcp2ce,
            "txAbdcecm1": txAbdcecm1,
            "txAbdcm1cm2": txAbdcm1cm2,
            "txAbdGlobal": txAbdGlobal
        })

        return pd.DataFrame(res)
        

    def promotion_apparente(self):
        niveaux = ["T1", "T2", "T3", "T4", "T5"]
        try:
            e0 = self.df_0["tdb_v_e1"]
            e1 = self.df_1["tdb_v_e1"]
            somme_initi = sum([(e0[f"{col}_G"] + e0[f"{col}_F"]) for col in niveaux[:4]])
            somme_passant = sum([(e1[f"{col}_G_PASSANT"] + e1[f"{col}_F_PASSANT"]) for col in niveaux[1:]]) - sum([(e1[f"{col}_G_TRANSFERT"] + e1[f"{col}_F_TRANSFERT"]) for col in niveaux[1:]])
            tpa = round(float(somme_passant) / float(somme_initi) * 100, 1)
        except:
            tpa = 0
        
        return pd.DataFrame([{"TPA":tpa}])
    
    def manuel_par_niveaux(self):
        """
            sc1 : sous cycle 1 : T1,T2,T3
            sc2 : sous cycle 2 : T4,T5

        """
        keys = ["mlg_sc1","mlg_sc2","fr_sc1","fr_sc2","maths_sc1","maths_sc2"]
        serie_vola = [f"SERIES_VOLA_T{n}" for n in range(1, 6)]
        malagasy = [f"MALAGASY_T{n}" for n in range(1, 6)]
        fr = [f"FRANCAIS_T{n}" for n in range(1, 6)]
        maths = [f"MATHS_T{n}" for n in range(1, 6)]

        res = []
        l1 = self.df_1["tdb_v_l1_manuel"] 
        e1 = self.df_1["tdb_v_e1"] 
        try:
            eff_sc1 = sum([(e1[f"T{n}_G"] + e1[f"T{n}_F"]) for n in range(1,4)])
            eff_sc2 = sum([(e1[f"T{n}_G"] + e1[f"T{n}_F"]) for n in range(4,6)])

            mlg_sc1 = sum([l1[f"{col}"] for col in serie_vola[:3]]) + sum([l1[f"{col}"] for col in malagasy[:3]])
            mlg_sc1 = round(float(mlg_sc1) / float(eff_sc1) * 100, 1) if eff_sc1 > 0 else 0
            mlg_sc2 = sum([l1[f"{col}"] for col in serie_vola[3:]]) + sum([l1[f"{col}"] for col in malagasy[3:]])
            mlg_sc2 = round(float(mlg_sc2) / float(eff_sc2) * 100, 1) if eff_sc2 > 0 else 0

            fr_sc1 = sum([l1[f"{col}"] for col in fr[:3]])
            fr_sc1 = round(float(fr_sc1) / float(eff_sc1) * 100, 1) if eff_sc1 > 0 else 0
            fr_sc2 = sum([l1[f"{col}"] for col in fr[3:]])
            fr_sc2 = round(float(fr_sc2) / float(eff_sc2) * 100, 1) if eff_sc2 > 0 else 0

            maths_sc1 = sum([l1[f"{col}"] for col in maths[:3]]) 
            maths_sc1 = round(float(maths_sc1) / float(eff_sc1) * 100, 1) if eff_sc1 > 0 else 0
            maths_sc2 = sum([l1[f"{col}"] for col in maths[3:]]) 
            maths_sc2 = round(float(maths_sc2) / float(eff_sc2) * 100, 1) if eff_sc2 > 0 else 0

        except:
            res.append({k: 0 for k in keys})
            return pd.DataFrame(res)

        res.append({k: locals()[k] for k in keys})
        return pd.DataFrame(res)

    def pourcentage_redoublant(self):
        """
        Calcule le pourcentage de redoublants par niveau (CP1, CP2, CE, CM1, CM2) et par sexe (G, F, Ensemble) sans boucle.
        Retourne un dictionnaire :
            {
                'red_CP1_garcons': val, 'red_CP1_filles': val, 'red_CP1_ensemble': val,
                ...
            }
        """
        try:
            d = self.df_1["tdb_v_e1"]
            niveaux = ["T1", "T2", "T3", "T4", "T5"]
            noms = ["CP1", "CP2", "CE", "CM1", "CM2"]
            result = {}
            for col, nom in zip(niveaux, noms):
                eff_g = d[f"{col}_G"]
                red_g = d[f"{col}_G_REDOUBLANT"]
                ptg_g = min(round(100 * red_g / eff_g, 1), 100) if eff_g not in [0, None] and np.isfinite(eff_g) else 0
                eff_f = d[f"{col}_F"]
                red_f = d[f"{col}_F_REDOUBLANT"]
                ptg_f = min(round(100 * red_f / eff_f, 1), 100) if eff_f not in [0, None] and np.isfinite(eff_f) else 0
                eff_e = eff_g + eff_f
                red_e = red_g + red_f
                ptg_e = min(round(100 * red_e / eff_e, 1), 100) if eff_e not in [0, None] and np.isfinite(eff_e) else 0
                result[f"red_{nom}_g"] = ptg_g
                result[f"red_{nom}_f"] = ptg_f
                result[f"red_{nom}"] = ptg_e

            red_ens_g = [result[f"red_{nom}_g"] for nom in noms]
            red_ens_f = [result[f"red_{nom}_f"] for nom in noms]
            red_ens = [result[f"red_{nom}"] for nom in noms]
            
            result["red_garcons"] = min(max(round(stats.mean(red_ens_g), 1), 0), 100)
            result["red_fille"] = min(max(round(stats.mean(red_ens_f), 1), 0), 100)
            result["red_ensemble"] = min(max(round(stats.mean(red_ens), 1), 0), 100)
            
        except Exception as e:
            logger.error(f"Erreur calcul pourcentage redoublants: {e}")
            result = {}
            for col, nom in zip(niveaux, noms):
                result[f"red_{nom}_g"] = 0
                result[f"red_{nom}_f"] = 0
                result[f"red_{nom}"] = 0
            result["red_garcons"] = 0
            result["red_fille"] = 0
            result["red_ensemble"] = 0

        return pd.DataFrame([result])
        
    
    def retention(self):
        """
        Calcule les taux de rétention des élèves par niveau et par sexe.
        Le taux de rétention = produit des taux de survie entre chaque niveau × 100
        """
        res = []
        
        try:
            df_0 = self.df_0["tdb_v_e1"]  # Année n-1
            df_1 = self.df_1["tdb_v_e1"]  # Année n
            
            # Configuration des niveaux (code, nom, limite max)
            niveaux = [
                ("CP1→CP2", 100),  # CP1 vers CP2
                ("CP2→CE",  100),  # CP2 vers CE
                ("CE→CM1",  100),  # CE vers CM1
                ("CM1→CM2", 100)   # CM1 vers CM2
            ]
            
            # Limites spécifiques par sexe et niveau (si différentes de la valeur par défaut)
            limites_specifiques = {
                ('G', 2): 90,  # CM1 garçons
                ('F', 1): 98,  # CP2 filles
                ('F', 2): 95,  # CE filles
                ('F', 3): 90,  # CM1 filles
                ('G', 3): 80,  # CM2 garçons
                ('F', 3): 80,  # CM2 filles
            }
            
            def calculer_taux_survie(sexe, t_annee_n_1, t_annee_n, t_suivant, default=100):
                """
                Calcule le taux de survie entre deux niveaux
                - sexe: 'G' ou 'F'
                - t_annee_n_1: niveau année n-1 (ex: "T1_G_PASSANT")
                - t_annee_n: niveau année n (ex: "T2_G")
                - t_suivant: niveau suivant pour soustractions
                - default: valeur par défaut si dénominateur invalide
                """
                denom = df_0[t_annee_n_1]
                
                if denom in [0, None] or not np.isfinite(denom):
                    return default
                
                numer = (df_1[t_annee_n] 
                        - df_1[f"{t_suivant}_REDOUBLANT"] 
                        - df_1[f"{t_suivant}_NOUVEAU"] 
                        - df_1[f"{t_suivant}_TRANSFERT"])
                
                return numer / denom
            
            def calculer_taux_retention(taux_survie_liste, sexe=None):
                """
                Calcule le taux de rétention à partir des taux de survie
                et applique les limites spécifiques
                """
                resultats = [100]  # CP1 toujours 100%
                
                for i, (taux, (_, limite_defaut)) in enumerate(zip(taux_survie_liste, niveaux)):
                    # Appliquer la limite spécifique si elle existe
                    limite = limites_specifiques.get((sexe, i), limite_defaut) if sexe else limite_defaut
                    valeur = min(max(round(taux * 100, 1), 0), limite)
                    resultats.append(valeur)
                
                # Produit des taux pour le taux de rétention global
                produit = np.prod(taux_survie_liste)
                tx_retention = min(max(round(produit * 100, 1), 0), 100)
                
                return tx_retention, resultats
            
            # Calcul pour les garçons
            taux_survie_g = [
                calculer_taux_survie('G', 'T1_G_PASSANT', 'T2_G', 'T2_G', 100),
                calculer_taux_survie('G', 'T2_G_PASSANT', 'T3_G', 'T3_G', 100),
                calculer_taux_survie('G', 'T3_G_PASSANT', 'T4_G', 'T4_G', 100),
                calculer_taux_survie('G', 'T4_G_PASSANT', 'T5_G', 'T5_G', 100)
            ]
            txRetentionG, profil_g = calculer_taux_retention(taux_survie_g, 'G')
            
            # Calcul pour les filles
            taux_survie_f = [
                calculer_taux_survie('F', 'T1_F_PASSANT', 'T2_F', 'T2_F', 100),
                calculer_taux_survie('F', 'T2_F_PASSANT', 'T3_F', 'T3_F', 100),
                calculer_taux_survie('F', 'T3_F_PASSANT', 'T4_F', 'T4_F', 100),
                calculer_taux_survie('F', 'T4_F_PASSANT', 'T5_F', 'T5_F', 100)
            ]
            txRetentionF, profil_f = calculer_taux_retention(taux_survie_f, 'F')
            
            # Calcul pour l'ensemble
            taux_survie_ensemble = [
                (taux_survie_g[i] + taux_survie_f[i]) / 2
                for i in range(len(taux_survie_g))
            ]
            txRetentionTotal, profil_ensemble = calculer_taux_retention(taux_survie_ensemble)
            
            # Construction du résultat
            res.append({
                "txRetentionGarcons": txRetentionG,
                "txRetentionFilles": txRetentionF,
                "txRetentionTotal": txRetentionTotal,
                "profilRetGarcons": profil_g,
                "profilRetFilles": profil_f,
                "profilRetEnsemble": profil_ensemble
            })
        except Exception as e:
            logger.error(f"etab::Etab => Erreur calcul taux de rétention: {e}")
            res.append({
                "txRetentionGarcons": 0,
                "txRetentionFilles": 0,
                "txRetentionTotal": 0,
                "profilRetGarcons": [100, 0, 0, 0, 0],
                "profilRetFilles": [100, 0, 0, 0, 0],
                "profilRetEnsemble": [100, 0, 0, 0, 0]
            })
        
        df = pd.DataFrame(res)
        df = df.astype(float, errors='ignore')  # Convertir les colonnes numériques en float, ignorer les erreurs pour les colonnes non numériques      
        return df

    def tab_ressources(self):
        """
        Retourne le nombre total d'élèves (T1 à T5, garçons et filles) à partir de tdb_v_e1 année en cours (df_1).
        Retourne un dict : {'total_garcons': val, 'total_filles': val, 'total_ensemble': val}
        """
        a1 = self.df_1["tdb_v_a1"]
        e1 = self.df_1["tdb_v_e1"]
        g1 = self.df_1["tdb_v_g1_section"]
        j1 = self.df_1["tdb_v_j1_sdc"]
        j2 = self.df_1["tdb_v_j2_latrine"]
        k1 = self.df_1["tdb_v_k1_place"]
        l1 = self.df_1["tdb_v_l1_manuel"]
        p1 = self.df_1["tdb_v_p1"]
        ce = self.df_0["tdb_v_ce"] if "tdb_v_ce" in self.df_0 else None
        niveaux = ["T1", "T2", "T3", "T4", "T5"]
        
        res = []
        try:
            # Calcul des effectifs
            total_g = sum([e1[f"{col}_G"] for col in niveaux])
            total_f = sum([e1[f"{col}_F"] for col in niveaux])
            nombre_eleves = total_g + total_f
            
            # Gestion des DataFrames qui peuvent être None
            # Vérification pour p1
            #logger.info(p1[["EN_SALLE"]])
            if p1 is not None and hasattr(p1, 'shape') and not isinstance(p1, (int, float, bool)):
                ens_classe = p1[p1["EN_SALLE"].astype(str) == "1"].shape[0]
                ens_im = (p1["CODE_STATUT"].astype(str).isin(["1","2"])).sum()
                fram_sub = (p1["CODE_STATUT"].astype(str).isin(["3"])).sum()
                fram_nonsub = (p1["CODE_STATUT"].astype(str).isin(["4"])).sum()
            else:
                ens_classe = ens_im = fram_sub = fram_nonsub = 0
                
            # Vérification pour g1
            if g1 is not None and hasattr(g1, 'shape') and not isinstance(g1, (int, float, bool)):
                nombre_section = sum([g1[f"{n}_SECTION"] for n in niveaux])
            else:
                nombre_section = 0
                
            # École continue
            ecole_continue = "OUI" if ((e1["T4_G"] + e1["T4_F"]) > 0 and ((e1["T5_G"] + e1["T5_F"]) > 0)) else "NON"
            
            # Élèves à 2km
            cols = [f"{n}_{sexe}_2KM" for n in niveaux for sexe in ["G", "F"]]
            eleve_2km = 0
            if nombre_eleves not in [0, None] and np.isfinite(nombre_eleves):
                try:
                    sum_2km = sum([e1[col] for col in cols if col in e1.index])
                    eleve_2km = round((nombre_eleves - sum_2km) * 100 / nombre_eleves, 1)
                except:
                    eleve_2km = 0
            
            # Point d'eau et électricité
            if a1 is not None and hasattr(a1, 'shape') and not isinstance(a1, (int, float, bool)):
                point_eau = "OUI" if a1["POINT_EAU"] > 0 else "NON"
                electricite = "OUI" if a1["EST_ELECTRIFIE"] > 0 else "NON"
            else:
                point_eau = electricite = "NON"
            
            #************** Tableau Droite ****************
            ratio_em = round(nombre_eleves / ens_classe, 0) if ens_classe not in [0, None] and np.isfinite(ens_classe) else 0
            
            if p1 is not None and hasattr(p1, 'shape') and not isinstance(p1, (int, float, bool)):
                try:
                    # Correction de la condition pour DIPLOME_PEDAGOGIQUE
                    diplome_mask = p1["DIPLOME_PEDAGOGIQUE"].astype(str).str.len() > 5
                    en_salle_mask = p1["EN_SALLE"].astype(str) == "1"
                    ratio_eq = p1[diplome_mask & en_salle_mask].shape[0]
                    ratio_eq = round(ratio_eq * 100 / ens_classe, 1) if ens_classe not in [0, None] and np.isfinite(ens_classe) else 0
                except:
                    ratio_eq = 0
            else:
                ratio_eq = 0
                
            # Ratio classes par salle de classe
            if j1 is not None and hasattr(j1, 'shape') and not isinstance(j1, (int, float, bool)):
                try:
                    nbr_sdc = sum([j1[f"SDC_PRIMAIRE_{m}_ETAT"] for m in ["BON","MAUVAIS"]])
                    ratio_cpsdc = round(nombre_section / nbr_sdc, 1) if nbr_sdc not in [0, None] and np.isfinite(nbr_sdc) else 0
                except:
                    nbr_sdc = 0
                    ratio_cpsdc = 0
            else:
                nbr_sdc = 0
                ratio_cpsdc = 0

            # Places assises
            pa = self.total_places_bancs(k1)
            ratio_epa = round(nombre_eleves / pa, 1) if pa not in [0, None] and np.isfinite(pa) else 0
            
            # Latrines communes
            if j2 is not None and hasattr(j2, 'shape') and not isinstance(j2, (int, float, bool)):
                try:
                    nbr_lat_cm = j2["WC_LATRINES_COMMUNES_BON_ETAT"] + j2["WC_LATRINES_COMMUNES_MAUVAIS_ETAT"]
                    ratio_wc_com = round(nombre_eleves / nbr_lat_cm, 1) if nbr_lat_cm not in [0, None] and np.isfinite(nbr_lat_cm) else 0

                    nbr_lat_f = j2["WC_LATRINES_FILLES_BON_ETAT"] + j2["WC_LATRINES_FILLES_MAUVAIS_ETAT"]
                    ratio_wc_f = round(total_f / nbr_lat_f, 1) if nbr_lat_f not in [0, None] and np.isfinite(nbr_lat_f) else 0
                except:
                    nbr_lat_cm = 0
                    ratio_wc_com = 0
                    nbr_lat_f = 0
                    ratio_wc_f = 0
            else:
                nbr_lat_cm = 0
                ratio_wc_com = 0
                nbr_lat_f = 0
                ratio_wc_f = 0
                
            # Manuels scolaires
            if l1 is not None and hasattr(l1, 'shape') and not isinstance(l1, (int, float, bool)):
                try:
                    manuel_mlg = sum([l1[f"MALAGASY_{n}"] for n in niveaux])
                    ratio_emlg = round(nombre_eleves / manuel_mlg, 1) if manuel_mlg not in [0, None] and np.isfinite(manuel_mlg) else 0
                    
                    manuel_mths = sum([l1[f"MATHS_{n}"] for n in niveaux])
                    ratio_emths = round(nombre_eleves / manuel_mths, 1) if manuel_mths not in [0, None] and np.isfinite(manuel_mths) else 0
                    
                    manuel_frs = sum([l1[f"FRANCAIS_{n}"] for n in niveaux])
                    ratio_efrs = round(nombre_eleves / manuel_frs, 1) if manuel_frs not in [0, None] and np.isfinite(manuel_frs) else 0
                except:
                    manuel_mlg = 0
                    ratio_emlg = 0
                    manuel_mths = 0
                    ratio_emths = 0
                    manuel_frs = 0
                    ratio_efrs = 0
            else:
                manuel_mlg = 0
                ratio_emlg = 0
                manuel_mths = 0
                ratio_emths = 0
                manuel_frs = 0
                ratio_efrs = 0

            # Contribution école
            if ce is not None and hasattr(ce, 'shape') and not isinstance(ce, (int, float, bool)):
                try:
                    montant_ce = ce["TOTAL_A_DOTER"]
                    ratio_ece = round(montant_ce / nombre_eleves, 0) if nombre_eleves not in [0, None] and np.isfinite(nombre_eleves) else 0
                except:
                    montant_ce = 0
                    ratio_ece = 0
            else:
                montant_ce = 0
                ratio_ece = 0

        except Exception as e:
            logger.error(f"etab::Etab => Erreur calcul Tableau Ressources: {e}")
            # Initialisation de toutes les variables avec des valeurs par défaut
            nombre_eleves = 0
            ens_classe = 0
            ens_im = 0
            fram_sub = 0
            fram_nonsub = 0
            nombre_section = 0
            ecole_continue = "NON"
            eleve_2km = 0
            point_eau = "NON"
            electricite = "NON"
            ratio_em = 0
            ratio_eq = 0
            ratio_cpsdc = 0
            ratio_epa = 0
            ratio_wc_com = 0
            ratio_wc_f = 0
            ratio_emlg = 0
            ratio_emths = 0
            ratio_efrs = 0
            montant_ce = 0
            ratio_ece = 0

        res.append(
            {
                "nombre_eleves": nombre_eleves,
                "ens_classe": ens_classe,
                "ens_im": ens_im,
                "fram_sub": fram_sub,
                "fram_nonsub": fram_nonsub,
                "nombre_section": nombre_section,
                "ecole_continue": ecole_continue,
                "eleve_2km": eleve_2km,
                "point_eau": point_eau,
                "electricite": electricite,

                "ratio_em": ratio_em,
                "ratio_eq": ratio_eq,
                "ratio_cpsdc": ratio_cpsdc,
                "ratio_epa": ratio_epa,
                "ratio_wc_com": ratio_wc_com,
                "ratio_wc_f": ratio_wc_f,

                "ratio_emlg": ratio_emlg,
                "ratio_emths": ratio_emths,
                "ratio_efrs": ratio_efrs,

                "montant_ce": montant_ce,
                "ratio_ece": ratio_ece
            }
        )
        

        return pd.DataFrame(res)

    def diagnostic_efficience(self, x, y):
        """
        Diagnostique l'efficience d'une école selon sa position sur un scatter plot (x=ressources, y=resultat).
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
            ("minim", "minim"): "<b>Faibles ressources et faibles résultats : </b>l'école est en grande difficulté. Elle manque de moyens et cela se reflète directement dans les performances.",
            ("minim", "moyen"): "<b>Ressources faibles mais résultats moyens :</b> l'école démontre une bonne efficience, elle réussit à faire progresser les élèves malgré des moyens limités.",
            ("minim", "maxim"): "<b>Ressources faibles mais résultats élevés :</b> situation exceptionnelle d'excellente efficience. L'école exploite remarquablement bien ses ressources limitées.",
            ("moyen", "minim"): "<b>Ressources moyennes mais résultats faibles :</b> il y a un problème d'efficacité pédagogique ou de gestion. Les moyens existent mais ne sont pas bien valorisés.",
            ("moyen", "moyen"): "<b>Ressources et résultats moyens </b>: situation intermédiaire, l'école fonctionne normalement mais sans véritable point fort ni faiblesse majeure.",
            ("moyen", "maxim"): "<b>Ressources moyennes et résultats élevés :</b> bonne efficience, les moyens sont bien exploités et produisent des résultats supérieurs à la moyenne.",
            ("maxim", "minim"): "<b>Ressources élevées mais résultats faibles :</b> inefficience marquée. Les ressources ne sont pas converties en apprentissages. Un problème sérieux à corriger.",
            ("maxim", "moyen"): "<b>Ressources élevées mais résultats moyens :</b> efficience faible. Les résultats devraient être meilleurs au vu des moyens disponibles.",
            ("maxim", "maxim"): "<b>Ressources et résultats élevés :</b> situation idéale. L'école a les moyens et les utilise efficacement pour obtenir de très bons résultats."
        }

        remarque = cas[(niveau_x, niveau_y)]

        # Diagnostic détaillé (2-3 phrases explicites)
        efficient = (niveau_y == "maxim") or (niveau_y == "moyen" and niveau_x != "maxim")
        if (niveau_x, niveau_y) == ("maxim", "maxim"):
            diagnostic = (
                "L'école dispose de ressources abondantes et parvient à obtenir d'excellents résultats. "
                "La gestion des moyens est optimale et l'organisation pédagogique est efficace. "
                "C'est une situation idéale à maintenir et à valoriser."
            )
        elif (niveau_x, niveau_y) == ("minim", "maxim"):
            diagnostic = (
                "Malgré des ressources très limitées, l'école atteint des résultats remarquables. "
                "Cela témoigne d'une grande efficience et d'un engagement exceptionnel de l'équipe éducative. "
                "C'est un exemple à suivre pour d'autres établissements."
            )
        elif (niveau_x, niveau_y) == ("minim", "moyen"):
            diagnostic = (
                "L'école réussit à obtenir des résultats corrects avec peu de moyens. "
                "Elle fait preuve d'une bonne efficience et optimise ses ressources. "
                "Un accompagnement ciblé pourrait lui permettre d'aller encore plus loin."
            )
        elif (niveau_x, niveau_y) == ("moyen", "maxim"):
            diagnostic = (
                "Les moyens disponibles sont bien exploités et permettent d'obtenir des résultats supérieurs à la moyenne. "
                "L'école démontre une bonne organisation et une pédagogie efficace. "
                "Il s'agit d'une situation très satisfaisante."
            )
        elif (niveau_x, niveau_y) == ("moyen", "moyen"):
            diagnostic = (
                "L'école fonctionne normalement avec des ressources et des résultats dans la moyenne. "
                "Il n'y a pas de point faible majeur, mais aussi peu de points forts distinctifs. "
                "Des efforts ciblés pourraient permettre d'améliorer encore la performance."
            )
        else:
            # Tous les autres cas sont peu ou pas efficients
            if (niveau_x, niveau_y) == ("maxim", "moyen"):
                diagnostic = (
                    "L'école dispose de ressources importantes mais n'obtient que des résultats moyens. "
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
                    "L'école dispose de moyens corrects mais n'arrive pas à transformer ces ressources en résultats. "
                    "Il existe probablement des difficultés pédagogiques ou organisationnelles à résoudre. "
                    "Un accompagnement spécifique est conseillé."
                )
            else:  # ("minim", "minim")
                diagnostic = (
                    "L'école est en grande difficulté, avec peu de ressources et de très faibles résultats. "
                    "La situation est préoccupante et nécessite un soutien renforcé. "
                    "Un plan d'action prioritaire doit être envisagé."
                )

        return {
            'diagnostic': diagnostic,
            'remarque': remarque,
            'efficient': efficient
        }


    def profil_scolarisation(self):
        try:
            temp_df = self.df_1["tdb_v_profil_scolarisation_cohorte"]
            if temp_df is None:
                raise ValueError("Profil scolarisation absent")
                
            profil = [temp_df["CP1_A1"], temp_df["CP2_A2"], temp_df["CE_A3"], temp_df["CM1_A4"]]
            profil_g = [temp_df["CP1_G_A1"], temp_df["CP2_G_A2"], temp_df["CE_G_A3"], temp_df["CM1_G_A4"]]
            profil_f = [temp_df["CP1_F_A1"], temp_df["CP2_F_A2"], temp_df["CE_F_A3"], temp_df["CM1_F_A4"]]

            res = {
                'profil_sco': [profil],
                'profil_sco_g': [profil_g],
                'profil_sco_f': [profil_f]
            }
            return pd.DataFrame(res)
        except Exception as e:
            logger.error(f"Erreur profil scolarisation: {e}")
            res = {
                'profil_sco': [[0, 0, 0, 0]],
                'profil_sco_g': [[0, 0, 0, 0]],
                'profil_sco_f': [[0, 0, 0, 0]],
            }
            return pd.DataFrame(res)
            

    def interpretation_abandon(self, ecole: float, zap: float) -> dict:
        """
        Interprète le taux d'abandon scolaire d'une école
        et le compare à celui de la ZAP (commune).
        ecole et zap sont exprimés en pourcentage.
        """

        # Interprétation du taux de l'école
        if ecole < 5:
            niveau = "Très faible taux d'abandon : excellente rétention des élèves."
        elif ecole < 10:
            niveau = "Faible taux d'abandon : la majorité des élèves restent scolarisés."
        elif ecole < 20:
            niveau = "Taux d'abandon préoccupant : plusieurs élèves quittent encore l'école."
        else:
            niveau = "Taux d'abandon élevé : une grande partie des élèves sort prématurément du système."

        # Comparaison avec la ZAP
        if ecole < zap * 0.9:  # nettement meilleur (au moins 10% de différence relative)
            comparaison = "L'école fait nettement mieux que la moyenne de la commune (ZAP)."
            suggestion = "Poursuivre et consolider les pratiques positives (suivi parental, cantine, sensibilisation)."
        elif ecole <= zap * 1.1:  # similaire
            comparaison = "L'école est globalement au même niveau que la commune."
            suggestion = "Renforcer les actions locales conjointes avec la ZAP pour améliorer encore la rétention."
        else:  # moins bon
            comparaison = "L'école est en moins bonne situation que la commune."
            suggestion = "Identifier les causes spécifiques (absentéisme, pauvreté, éloignement) et mettre en place un suivi ciblé."
            
        return {
            'niveau': niveau,
            'comparaison': comparaison,
            'suggestion': suggestion
        }

    def total_places_bancs(self, df):
        """
        Calcule le nombre total de places en primaire
        en multipliant chaque type de table par le nombre de places,
        en prenant en compte BON_ETAT et MAUVAIS_ETAT.
        Fonction robuste même si certaines colonnes sont absentes.
        """
        if df is None or isinstance(df, (int, float)):
            return 0
            
        coeff = {"1PL": 1, "2PL": 2, "3PL": 3, "4PL": 4, "5PL_PLUS": 5}
        total = 0

        for pl, factor in coeff.items():
            for etat in ["BON_ETAT", "MAUVAIS_ETAT"]:
                col = f"PRIMAIRE_TABLES_BANCS_{pl}_{etat}"
                if col in df.index or (hasattr(df, 'columns') and col in df.columns):
                    try:
                        total += (df[col] * factor)
                    except:
                        pass

        return total

    
    def cepe(self):
        """
        Calcul des indicateurs CEPE :
         - taux d'admission (garçons, filles, total)
         - moyenne des matières (SM_*)
         - nombre d'élèves avec note > 10 (sup_10_*)
        """
        res = []
        keys = ["tx_admis_g", "tx_admis_f", "tx_admis", "sm_op", "sup_10_op", "sm_probleme", "sup_10_probleme","sm_maths","sup_10_maths",
                "sm_tfm", "sup_10_tfm", "sm_mlg", "sup_10_mlg", "sm_fr", "sup_10_fr", "sm_geo", "sup_10_geo","sm_svt", "sup_10_svt"]

        try:
            d = self.df_0.get("v_sm_cepe")
            if d is None or d.empty:
                res.append({k: 0 for k in keys})
                return pd.DataFrame(res)

            def safe_sum(col):
                if col in d.index:
                    return float(d[col])
                return 0

            def safe_mean(col):
                if col in d.index:
                    val = float(d[col])
                    return round(val, 1) if np.isfinite(val) else 0
                return 0

            def count_sup_10(col):
                if col in d.index:
                    return int(d[col])
                return 0

            nbr_g = safe_sum("G")
            admis_g = safe_sum("ADMIS_G")
            tx_admis_g = round(admis_g * 100 / nbr_g, 1) if nbr_g not in [0, None] and np.isfinite(nbr_g) else 0

            nbr_f = safe_sum("F")
            admis_f = safe_sum("ADMIS_F")
            tx_admis_f = round(admis_f * 100 / nbr_f, 1) if nbr_f not in [0, None] and np.isfinite(nbr_f) else 0

            nbr_tt = nbr_g + nbr_f
            admis_tt = admis_g + admis_f
            tx_admis = round(admis_tt * 100 / nbr_tt, 1) if nbr_tt not in [0, None] and np.isfinite(nbr_tt) else 0

            sm_op = safe_mean("SM_OP")
            sup_10_op = count_sup_10("SUP_10_OP")

            sm_probleme = safe_mean("SM_PROBLEME")
            sup_10_probleme = count_sup_10("SUP_10_PROBLEME")

            sm_maths = stats.mean([sm_op,sm_probleme])
            sup_10_maths = sup_10_op + sup_10_probleme

            sm_tfm = safe_mean("SM_TFM")
            sup_10_tfm = count_sup_10("SUP_10_TFM")

            sm_mlg = safe_mean("SM_MALAGASY")
            sup_10_mlg = count_sup_10("SUP_10_MALAGASY")

            sm_fr = safe_mean("SM_FRANCAIS")
            sup_10_fr = count_sup_10("SUP_10_FRANCAIS")

            sm_geo = safe_mean("SM_GEOGRAPHIE")
            sup_10_geo = count_sup_10("SUP_10_GEOGRAPHIE")

            sm_svt = safe_mean("SM_SVT")
            sup_10_svt = count_sup_10("SUP_10_SVT")

        except Exception as e:
            logger.error(f"etab::Etab => Erreur calcul CEPE : {e}")
            res.append({k: 0 for k in keys})
            return pd.DataFrame(res)

        res.append({k: locals()[k] for k in keys})
        return pd.DataFrame(res)

    def calculate_indicators(self):
        abd = self.abandon().reset_index(drop=True)
        ret = self.retention().reset_index(drop=True)
        red = self.pourcentage_redoublant().reset_index(drop=True)
        cepe = self.cepe().reset_index(drop=True)
        tab_res = self.tab_ressources().reset_index(drop=True)
        mpn = self.manuel_par_niveaux().reset_index(drop=True)
        tpa = self.promotion_apparente().reset_index(drop=True)
        # profil_sco = self.profil_scolarisation().reset_index(drop=True)
        # Concaténer horizontalement (axis=1) pour joindre les indicateurs sur une seule ligne
        return pd.concat([abd, ret, red, cepe, tab_res,mpn,tpa], axis=1)