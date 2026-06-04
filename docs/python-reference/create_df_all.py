
# Suppress warnings messages
import warnings
warnings.filterwarnings("ignore", category=SyntaxWarning)
# Suppress warnings messages
warnings.filterwarnings("ignore")
import os
import glob

import requests
from requests.auth import HTTPBasicAuth

import pandas as pd
pd.set_option('future.no_silent_downcasting', True)

import numpy as np

from datetime import datetime, timezone
import time

import pytz
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import Pool
from functools import partial
from tqdm.auto import tqdm


import json
#import xml.etree.ElementTree as ET
#from xml.etree.ElementTree import Element, SubElement, tostring, ElementTree
import uuid
from toml import load

from zipfile import ZipFile
import re

#Pour les images et QR_CODE
from io import BytesIO, StringIO

import logging
import random
from num2words import num2words

import sqlalchemy
import psycopg2
from psycopg2 import sql
from sqlalchemy import create_engine, MetaData , Column, String, Integer, Date, Numeric, TIMESTAMP, MetaData, LargeBinary
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.types import Integer, Float, String, DateTime, Boolean

from etab import Etab
from tdb_pdf import PDF as TDB_ETAB
from tdb_zap_pdf import PDF as TDB_ZAP
from tdb_cisco_pdf import PDF as TDB_CISCO
#engine = create_engine(f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PWD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
engine = create_engine("postgresql+psycopg2://dpeapp:s3cret!@102.16.234.114:5453/dpeapp")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

tables = [  "tdb_v_a1","tdb_v_d1","tdb_v_e1","tdb_v_e4","tdb_v_g1_section","tdb_v_h1_cantine",
            "tdb_v_j1_sdc","tdb_v_j2_latrine","tdb_v_k1_place","tdb_v_l1_manuel","tdb_v_p1","tdb_v_ce"
        ]

dfs_0 = {}
dfs_1 = {}
#les df etabs
dfs_etab_0 = {}
dfs_etab_1 = {}
#les df zaps
dfs_zap_0 = {}
dfs_zap_1 = {}
#les dfs ciscos
dfs_cisco_0 = {}
dfs_cisco_1 = {}
#les df drens
dfs_dren_0 = {}
dfs_dren_1 = {}

# --- Fonction utilitaire pour convertir une requête SQL en DataFrame ---
def sql_to_df(query, engine=engine):
        """
        Exécute une requête SQL et retourne un DataFrame pandas.
        Args:
                query (str): La requête SQL à exécuter.
                engine: L'engine SQLAlchemy à utiliser (par défaut celui défini plus haut).
        Returns:
                pd.DataFrame: Le DataFrame résultant.
        """
        df = pd.read_sql(query, engine)
        df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
        df = df.replace(np.nan, 0)
        col_int = ["CODE_ETAB","CODE_ZAP","CODE_DREN","SECTEUR","EXISTE_PRIMAIRE","EXISTE_COLLEGE","EXISTE_LYCEE"]
        for c in col_int:
                if c in df.columns :  
                        df[c] = df[c].astype(int)

        for t in tables:
                df.columns = [c.upper() for c in df.columns.tolist()]

        return df

def create_df():
        logger.info("--Recuperation des Tables dans la base et Création des DFs...")
        # --- Lister les colonnes de chaque table pour diagnostic ---
        for t in tables:
                logger.info(f"Table {t} ....")
                dfs_0[t] = sql_to_df(f'SELECT * FROM {t} WHERE ("ANNEE_SCOLAIRE" = 2024 AND "EXISTE_PRIMAIRE"=1 AND "SECTEUR"=0)  ORDER BY "CODE_ETAB"')
                dfs_1[t] = sql_to_df(f'SELECT * FROM {t}  WHERE ("ANNEE_SCOLAIRE" = 2025 AND "EXISTE_PRIMAIRE"=1 AND "SECTEUR"=0) ORDER BY "CODE_ETAB"')
                logger.info(f"\t {t} : 2024 {dfs_0[t].shape[0]} lignes, \tTableTable2025 {dfs_1[t].shape[0]} lignes==")
        #cepe manokana
        dfs_0["v_sm_cepe"] = sql_to_df('SELECT v.* FROM v_sm_cepe v WHERE v."ANNEE_SCOLAIRE" = 2025')
        #logger.info(f"DF v_sm_cepe : {dfs_0['v_sm_cepe'].shape}")Table
        tbls = ["tdb_v_e1","tdb_v_e4","tdb_v_g1_section","tdb_v_h1_cantine","tdb_v_j1_sdc","tdb_v_j2_latrine","tdb_v_k1_place","tdb_v_l1_manuel"]
        for t in tbls :
                dfs_0[t] = dfs_0[t].replace([np.inf, -np.inf], 0).apply(pd.to_numeric, errors="coerce").fillna(0)
                dfs_1[t] = dfs_1[t].replace([np.inf, -np.inf], 0).apply(pd.to_numeric, errors="coerce").fillna(0)


        logger.info("--Tables dans la base ok ..., DFs crées. ")

def create_df_ecole():
        # 1. Extraire tous les codes communs entre df_0 et df_1
        tbl_fpe = [
                "tdb_v_a1","tdb_v_d1","tdb_v_e1","tdb_v_e4","tdb_v_g1_section",
                "tdb_v_h1_cantine","tdb_v_j1_sdc","tdb_v_j2_latrine","tdb_v_k1_place",
                "tdb_v_l1_manuel","tdb_v_p1"
        ]

        # Codes initiaux depuis la première table
        """
        codes_1 = set(dfs_1["tdb_v_a1"]["CODE_ETAB"].unique())
        # Intersection avec les autres tables
        for t in tbl_fpe[1:]: 
                codes_1 = [c for c in codes_1 if c in dfs_1[t]["CODE_ETAB"].unique()]

        for t in tbl_fpe:
                codes_1 = [c for c in codes_1 if c in dfs_0[t]["CODE_ETAB"].unique()]

        codes_communs = codes_1
        """
        # Codes présents dans TOUTES les tables de dfs_1
        codes_communs = set(dfs_1["tdb_v_a1"]["CODE_ETAB"].unique())

        for t in tbl_fpe[1:]:
                codes_communs &= set(dfs_1[t]["CODE_ETAB"].unique())

        # Codes présents également dans TOUTES les tables de dfs_0
        for t in tbl_fpe:
                codes_communs &= set(dfs_0[t]["CODE_ETAB"].unique())

        # Optionnel : convertir en liste triée si besoin
        codes_communs = sorted(codes_communs)

        logger.info(len(codes_communs))
        df_final= pd.DataFrame()
        for code_etab in tqdm(codes_communs, total=len(codes_communs), desc="Traitement"):
                #filtrage df
                for t in tables:
                        dfs_etab_0[t] = dfs_0[t][dfs_0[t]["CODE_ETAB"] == code_etab]
                        dfs_etab_1[t] = dfs_1[t][dfs_1[t]["CODE_ETAB"] == code_etab]

                dfs_etab_0["v_sm_cepe"] = dfs_0["v_sm_cepe"][dfs_0["v_sm_cepe"]["CODE_ETAB"]==code_etab]
                
                e = Etab(dfs_etab_0,dfs_etab_1)
                df_res= e.calculate_indicators()
                df_res["CODE_ETAB"] = code_etab
                df_final = pd.concat([df_final, df_res], axis=0, ignore_index=True)
        
        df_final.to_csv("df_ecole.csv", index=False)
        logger.info(f"Términé, df_ecole.csv créé avec {df_final.shape[0]} lignes et {df_final.shape[1]} colonnes.")



def create_df_zap():
        # 1. Extraire tous les codes communs entre df_0 et df_1
        tbl_fpe = [
                "tdb_v_a1","tdb_v_d1","tdb_v_e1","tdb_v_e4","tdb_v_g1_section",
                "tdb_v_h1_cantine","tdb_v_j1_sdc","tdb_v_j2_latrine","tdb_v_k1_place",
                "tdb_v_l1_manuel","tdb_v_p1"
        ]
        # Codes présents dans TOUTES les tables de dfs_1
        codes_communs = set(dfs_1["tdb_v_a1"]["CODE_ZAP"].unique())

        for t in tbl_fpe[1:]:
                codes_communs &= set(dfs_1[t]["CODE_ZAP"].unique())

        # Codes présents également dans TOUTES les tables de dfs_0
        for t in tbl_fpe:
                codes_communs &= set(dfs_0[t]["CODE_ZAP"].unique())

        # Optionnel : convertir en liste triée si besoin
        codes_communs = sorted(codes_communs)

        logger.info(len(codes_communs))
        df_final= pd.DataFrame()
        for code_zap in tqdm(codes_communs, total=len(codes_communs), desc="Traitement"):
                #filtrage df
                for t in tables:
                        dfs_zap_0[t] = dfs_0[t][dfs_0[t]["CODE_ZAP"] == code_zap]
                        dfs_zap_1[t] = dfs_1[t][dfs_1[t]["CODE_ZAP"] == code_zap]

                dfs_zap_0["v_sm_cepe"] = dfs_0["v_sm_cepe"][dfs_0["v_sm_cepe"]["CODE_ZAP"]==code_zap]
                
                z = Zap(dfs_zap_0,dfs_zap_1)
                df_res= z.calculate_indicators()
                df_res["CODE_ZAP"] = code_zap
                df_final = pd.concat([df_final, df_res], axis=0, ignore_index=True)
        
        df_final.to_csv("df_zap.csv", index=False)
        logger.info(f"Términé, df_ecole.csv créé avec {df_final.shape[0]} lignes et {df_final.shape[1]} colonnes.")



def create_df_cisco():
        # 1. Extraire tous les codes communs entre df_0 et df_1
        tbl_fpe = [
                "tdb_v_a1","tdb_v_d1","tdb_v_e1","tdb_v_e4","tdb_v_g1_section",
                "tdb_v_h1_cantine","tdb_v_j1_sdc","tdb_v_j2_latrine","tdb_v_k1_place",
                "tdb_v_l1_manuel","tdb_v_p1"
        ]
        # Codes présents dans TOUTES les tables de dfs_1
        codes_communs = set(dfs_1["tdb_v_a1"]["CODE_CISCO"].unique())

        for t in tbl_fpe[1:]:
                codes_communs &= set(dfs_1[t]["CODE_CISCO"].unique())

        # Codes présents également dans TOUTES les tables de dfs_0
        for t in tbl_fpe:
                codes_communs &= set(dfs_0[t]["CODE_CISCO"].unique())

        # Optionnel : convertir en liste triée si besoin
        codes_communs = sorted(codes_communs)

        logger.info(len(codes_communs))
        df_final= pd.DataFrame()
        for code in tqdm(codes_communs, total=len(codes_communs), desc="Traitement"):
                #filtrage df
                for t in tables:
                        dfs_cisco_0[t] = dfs_0[t][dfs_0[t]["CODE_CISCO"] == code]
                        dfs_cisco_1[t] = dfs_1[t][dfs_1[t]["CODE_CISCO"] == code]

                dfs_cisco_0["v_sm_cepe"] = dfs_0["v_sm_cepe"][dfs_0["v_sm_cepe"]["CODE_CISCO"]==code]
                
                c = Cisco(dfs_cisco_0,dfs_cisco_1)
                df_res= c.calculate_indicators()
                df_res["CODE_CISCO"] = code
                df_final = pd.concat([df_final, df_res], axis=0, ignore_index=True)
        
        df_final.to_csv("df_cisco.csv", index=False)
        logger.info(f"Términé, df_cisco.csv créé avec {df_final.shape[0]} lignes et {df_final.shape[1]} colonnes.")

def aggregation():
        logger.info("*"*40)
        agg = {
                "txAbdcp1cp2":[lambda x: round(x.mean(), 1)],
                "txAbdcp2ce":[lambda x: round(x.mean(), 1)],
                "txAbdcecm1":[lambda x: round(x.mean(), 1)],
                "txAbdcm1cm2":[lambda x: round(x.mean(), 1)],
                "txAbdGlobal":[lambda x: round(x.mean(), 1)],
                "txRetentionGarcons":[lambda x: round(x.mean(), 1)],
                "txRetentionFilles":[lambda x: round(x.mean(), 1)],
                "txRetentionTotal":[lambda x: round(x.mean(), 1)],
                "red_CP1_g":[lambda x: round(x.mean(), 1)],
                "red_CP1_f":[lambda x: round(x.mean(), 1)],
                "red_CP1":[lambda x: round(x.mean(), 1)],
                "red_CP2_g":[lambda x: round(x.mean(), 1)],
                "red_CP2_f":[lambda x: round(x.mean(), 1)],
                "red_CP2":[lambda x: round(x.mean(), 1)],
                "red_CE_g":[lambda x: round(x.mean(), 1)],
                "red_CE_f":[lambda x: round(x.mean(), 1)],
                "red_CE":[lambda x: round(x.mean(), 1)],
                "red_CM1_g":[lambda x: round(x.mean(), 1)],
                "red_CM1_f":[lambda x: round(x.mean(), 1)],
                "red_CM1":[lambda x: round(x.mean(), 1)],
                "red_CM2_g":[lambda x: round(x.mean(), 1)],
                "red_CM2_f":[lambda x: round(x.mean(), 1)],
                "red_CM2":[lambda x: round(x.mean(), 1)],
                "red_garcons":[lambda x: round(x.mean(), 1)],
                "red_fille":[lambda x: round(x.mean(), 1)],
                "red_ensemble":[lambda x: round(x.mean(), 1)],
                "tx_admis_g":[lambda x: round(x.mean(), 1)],
                "tx_admis_f":[lambda x: round(x.mean(), 1)],
                "tx_admis":[lambda x: round(x.mean(), 1)],
                "sm_op":[lambda x: round(x.mean(), 1)],
                "sup_10_op":"sum",
                "sm_probleme":[lambda x: round(x.mean(), 1)],
                "sup_10_probleme":"sum",
                "sm_maths":[lambda x: round(x.mean(), 1)],
                "sup_10_maths":"sum",
                "sm_tfm":[lambda x: round(x.mean(), 1)],
                "sup_10_tfm":"sum",
                "sm_mlg":[lambda x: round(x.mean(), 1)],
                "sup_10_mlg":"sum",
                "sm_fr":[lambda x: round(x.mean(), 1)],
                "sup_10_fr":"sum",
                "sm_geo":[lambda x: round(x.mean(), 1)],
                "sup_10_geo":"sum",
                "sm_svt":[lambda x: round(x.mean(), 1)],
                "sup_10_svt":"sum",
                "nombre_eleves":"sum",
                "ens_classe":"sum",
                "ens_im":"sum",
                "fram_sub":"sum",
                "fram_nonsub":"sum",
                "nombre_section":"sum",
                "ecole_continue":[lambda x: round(x.mean()*100,1)],
                "eleve_2km":[lambda x: round(x.mean(), 1)],
                "point_eau":[lambda x: round(x.mean()*100,1)],
                "electricite":[lambda x: round(x.mean()*100,1)],
                "ratio_em":[lambda x: round(x.mean(), 1)],
                "ratio_eq":[lambda x: round(x.mean(), 1)],
                "ratio_cpsdc":[lambda x: round(x.mean(), 1)],
                "ratio_epa":[lambda x: round(x.mean(), 1)],
                "ratio_wc_com":[lambda x: round(x.mean(), 1)],
                "ratio_wc_f":[lambda x: round(x.mean(), 1)],
                "ratio_emlg":[lambda x: round(x.mean(), 1)],
                "ratio_emths":[lambda x: round(x.mean(), 1)],
                "ratio_efrs":[lambda x: round(x.mean(), 1)],
                "montant_ce":"sum",
                "ratio_ece":[lambda x: round(x.mean(), 1)],
                "mlg_sc1":[lambda x: round(x.mean(), 1)],
                "mlg_sc2" : [lambda x: round(x.mean(), 1)],
                "fr_sc1" :[lambda x: round(x.mean(), 1)],
                "fr_sc2" :[lambda x: round(x.mean(), 1)],
                "maths_sc1" :[lambda x: round(x.mean(), 1)],
                "maths_sc2" :[lambda x: round(x.mean(), 1)],
                "TPA" :[lambda x: round(x.mean(), 1)]
        }
        replace_oui = {"ecole_continue":{"OUI":1,"NON":0},"point_eau":{"OUI":1,"NON":0},"electricite":{"OUI":1,"NON":0}}
        logger.info("Lecture df ecoles")
        df_ecole = pd.read_csv("df_ecole.csv")
        logger.info(f"df ecoles {df_ecole.shape[0]} lignes")
        logger.info("Lecture df ecoles")
        df_ref = pd.read_csv("df_ref.csv")
        logger.info(f"df REF {df_ref.shape[0]} lignes")
        df_all = df_ecole.merge(df_ref,how="inner",on="CODE_ETAB")
        if "CODE_ETAB_y" in df_all.columns:
                df_all = df_all.drop(["CODE_ETAB_y"])
        if "CODE_ETAB_x" in df_all.columns:
                df_all = df_all.rename(columns={"CODE_ETAB_x":"CODE_ETAB"})

        df_all = df_all.dropna(subset=["NOM_ETAB"], axis=0)
        df_all = df_all.reset_index(drop=True)
        df_all.to_csv("df_tdbecoles.csv", index=False)
        logger.info(f"df merge all {df_all.shape[0]} lignes")

        logger.info("Lecture df zap")
        df_zap = df_all.copy()
        df_zap = df_zap.replace(replace_oui)
        df_zap = df_zap.drop(columns=["CODE_ETAB","NOM_ETAB"])
        df_zap = df_zap.groupby(["CODE_ZAP","ZAP","CODE_CISCO","CISCO","CODE_DREN","DREN"],as_index=False).agg(agg).reset_index(drop=True)
        df_zap[["CODE_ZAP", "CODE_CISCO", "CODE_DREN"]] = df_zap[["CODE_ZAP", "CODE_CISCO", "CODE_DREN"]].astype(int)
        df_zap.columns = [f"{col}" for col, func in df_zap.columns]
        df_zap.to_csv("df_zap.csv", index=False)
        logger.info(f"sauvegarde df zap {df_zap.shape[0]} lignes")

        logger.info("Lecture df cisco")
        df_cisco = df_all.copy()
        df_cisco = df_cisco.replace(replace_oui)
        df_cisco = df_cisco.drop(columns=["CODE_ETAB","NOM_ETAB","CODE_ZAP","ZAP"])
        df_cisco = df_cisco.groupby(["CODE_CISCO","CISCO","CODE_DREN","DREN"],as_index=False).agg(agg).reset_index(drop=True)
        df_cisco[["CODE_CISCO","CODE_DREN"]] = df_cisco[["CODE_CISCO","CODE_DREN"]].astype(int)
        df_cisco.columns = [f"{col}" for col, func in df_cisco.columns]
        df_cisco.to_csv("df_cisco.csv", index=False)
        logger.info(f"sauvegarde df cisco {df_cisco.shape[0]} lignes")

        logger.info("Lecture df dren")
        df_dren = df_all.copy()
        df_dren = df_dren.replace(replace_oui)
        df_dren = df_dren.drop(columns=["CODE_ETAB","NOM_ETAB","CODE_ZAP","ZAP","CODE_CISCO","CISCO"])
        df_dren = df_dren.groupby(["CODE_DREN","DREN"],as_index=False).agg(agg).reset_index(drop=True)
        df_dren["CODE_DREN"] = df_dren["CODE_DREN"].astype(int)
        df_dren.columns = [f"{col}" for col, func in df_dren.columns]
        df_dren.to_csv("df_dren.csv", index=False)
        logger.info(f"sauvegarde df dren {df_dren.shape[0]} lignes")


        logger.info("Lecture df mada")
        df_mada = df_all.copy()
        df_mada["CODE_MADA"] = 0
        df_mada = df_mada.replace(replace_oui)
        df_mada = df_mada.drop(columns=["CODE_ETAB","NOM_ETAB","CODE_ZAP","ZAP","CODE_CISCO","CISCO","CODE_DREN","DREN"])
        df_mada = df_mada.groupby(["CODE_MADA"],as_index=False).agg(agg).reset_index(drop=True)
        if isinstance(df_mada.columns, pd.MultiIndex):
                df_mada.columns = [f"{col}" for col, func in df_mada.columns]
        else:
                df_mada.columns = [str(col) for col in df_mada.columns]

        df_mada.to_csv("df_mada.csv", index=False)
        logger.info(f"sauvegarde df_mada {df_mada.shape[0]} lignes")

        logger.info("*"*40)

def generate_pdf_etab():
        df_etab_src = pd.read_csv("df_tdbecoles.csv")
        df_zap_src = pd.read_csv("df_zap.csv")
        df_cisco_src = pd.read_csv("df_cisco.csv")

        current_dren = df_etab_src.iloc[0]["DREN"]
        for _, etab in tqdm(df_etab_src.iterrows(),total=len(df_etab_src), desc="Création tdb ecole"):
                if current_dren != etab["DREN"]:
                        current_dren = etab["DREN"]
                        logger.info(current_dren)

                df_etabs_in_zap = df_etab_src[df_etab_src["CODE_ZAP"]==etab["CODE_ZAP"]]
                df_etab = df_etab_src[df_etab_src["CODE_ETAB"] == etab["CODE_ETAB"]]

                df_zap = df_zap_src[df_zap_src["CODE_ZAP"] == etab["CODE_ZAP"]]
                df_cisco = df_cisco_src[df_cisco_src["CODE_CISCO"] == etab["CODE_CISCO"]]
                tdb = TDB_ETAB(df_etab,df_etabs_in_zap,df_zap,df_cisco)
                tdb.export_etab_pdf()

def generate_pdf_zap():
        df_zap_src = pd.read_csv("df_zap.csv")
        df_cisco_src = pd.read_csv("df_cisco.csv")
        df_dren_src = pd.read_csv("df_dren.csv")

        current_dren = df_zap_src.iloc[0]["CODE_DREN"]
        for _, zap in tqdm(df_zap_src.iterrows(),total=len(df_zap_src), desc="Création tdb ecole"):
                if current_dren != zap["CODE_DREN"]:
                        current_dren = zap["CODE_DREN"]
                        logger.info(f"CODE DREN {current_dren}")

                df_zap_in_cisco = df_zap_src[df_zap_src["CODE_CISCO"]==zap["CODE_CISCO"]]
                df_zap = df_zap_src[df_zap_src["CODE_ZAP"] == zap["CODE_ZAP"]]

                df_cisco = df_cisco_src[df_cisco_src["CODE_CISCO"] == zap["CODE_CISCO"]]
                df_dren = df_dren_src[df_dren_src["CODE_DREN"] == zap["CODE_DREN"]]
                tdb = TDB_ZAP(df_zap,df_zap_in_cisco,df_cisco,df_dren)
                tdb.export_pdf()

def generate_pdf_cisco():
        df_cisco_src = pd.read_csv("df_cisco.csv")
        df_dren_src = pd.read_csv("df_dren.csv")
        df_mada_src = pd.read_csv("df_mada.csv")

        for _, cisco in tqdm(df_cisco_src.iterrows(),total=len(df_cisco_src), desc="Création tdb cisco"):
                df_cisco_in_dren = df_cisco_src[df_cisco_src["CODE_DREN"]==cisco["CODE_DREN"]]
                df_cisco = df_cisco_src[df_cisco_src["CODE_CISCO"] == cisco["CODE_CISCO"]]

                df_dren = df_dren_src[df_dren_src["CODE_DREN"] == cisco["CODE_DREN"]]
                df_mada = df_mada_src.copy()
                tdb = TDB_CISCO(df_cisco,df_cisco_in_dren,df_dren,df_mada)
                tdb.export_pdf()
        
#tsy voatery atao daholo, fa indray isantaona , na rehefa misy modif ny base
if __name__ == "__main__":
    logger.info("demarrage")
    #create_df()
    #create_df_ecole() #in 1 isantaona
    #aggregation() # in 1 isantaona koa
    #generate_pdf_etab() # rehefa misy modif
    #generate_pdf_zap() # rehefa misy modif
    generate_pdf_cisco() # rehefa misy modif



