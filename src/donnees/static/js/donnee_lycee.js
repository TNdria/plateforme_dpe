$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('div-map', 'win8')
})
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('div-map')
})
$(document).on("ajaxStop", function () {
    utils.waitmeClose('div-map')
})

$(document).ready(function () {

    $('#datatable').DataTable({
        dom: 'Bfrtip', // Positionne les boutons et le filtre
        buttons: [
            {
                extend: 'excelHtml5', // Bouton pour exporter en Excel
                text: 'Exporter en Excel',
                title: 'Donnees_lycees' // Nom du fichier Excel
            }
        ],
        language: {
            search: "Rechercher :", // Texte du filtre de recherche
            lengthMenu: "Afficher _MENU_ entrées",
            info: "Affichage de _START_ à _END_ sur _TOTAL_ entrées",
            paginate: {
                first: "Premier",
                last: "Dernier",
                next: "Suivant",
                previous: "Précédent"
            }
        }
    })

    $(document).on("change", "#dren", async function () {
        code_dren = parseInt($(this).val())
        if (code_dren == 0) {
            $("#cisco").html(`<option value="0" selected>-Toutes-</option>`)
            return
        }
        url_cisco = `listeCisco/${code_dren}`
        ciscos = await utils.fetchData(url_cisco, 'GET', {})
        $("#cisco").html(`<option value="0">-Toutes-</option>`)
        ciscos.forEach(c => {
            $("#cisco").append(`<option value="${c.CODE_CISCO}">${c.CISCO}</option>`)
        });
        $("#cisco").trigger("change")
    })

    $(document).on("change", "#cisco", async function () {
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($(this).val())
        if (code_cisco == 0) {
            $("#commune").html(`<option value="0" selected>-Toutes-</option>`)
            $("#zap").html(`<option value="0" selected>-Toutes-</option>`)
            return
        }
        url_commune = `listeCommune/${code_dren}/${code_cisco}/0`
        communes = await utils.fetchData(url_commune, 'GET', {})
        $("#commune").html(`<option value="0">-Toutes-</option>`)
        communes.forEach(c => {
            $("#commune").append(`<option value="${c.CODE_COMMUNE}">${c.COMMUNE}</option>`)
        });
        //les ZAPs
        url_zap = `listeZap/${code_dren}/${code_cisco}/0`
        zaps = await utils.fetchData(url_zap, 'GET', {})
        $("#zap").html(`<option value="0" selected>-Toutes-</option>`)
        zaps.forEach(z => {
            $("#zap").append(`<option value="${z.CODE_ZAP}">${z.ZAP}</option>`)
        });
    })
    $(document).on("change", "#commune", async function () {
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($("#cisco").val())
        code_commune = parseInt($(this).val())
        //les ZAPs
        url_zap = `listeZap/${code_dren}/${code_cisco}/${code_commune}`
        zaps = await utils.fetchData(url_zap, 'GET', {})
        $("#zap").html(`<option value="0" selected>-Toutes-</option>`)
        zaps.forEach(c => {
            $("#zap").append(`<option value="${c.CODE_ZAP}">${c.ZAP}</option>`)
        });
    })
    $(document).on("change", "#zap", async function () {
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($("#cisco").val())
        code_zap = parseInt($(this).val())
        //les ZAPs
        url_commune = `listeCommune/${code_dren}/${code_cisco}/${code_zap}`
        communes = await utils.fetchData(url_commune, 'GET', {})
        $("#commune").html(`<option value="0" selected>-Toutes-</option>`)
        communes.forEach(c => {
            $("#commune").append(`<option value="${c.CODE_COMMUNE}">${c.COMMUNE}</option>`)
        });
    })
    $(document).on("click", "#btn-filter", async function () {
        loading_data()
    })

    //charger les ecoles selon les criteres

    //charger les ecoles selon les criteres
    loading_data = async () => {
        utils.waitmeShow('div-map', 'win8')
        $("#data-etab").html(`<div id="loading-spinner" class="text-center"><div class="spinner text-center p-5"></div></div>`)
        $("#data-effectif").html(`<div id="loading-spinner" class="text-center"><div class="spinner text-center p-5"></div></div>`)
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($("#cisco").val())
        code_commune = parseInt($("#commune").val())
        code_zap = parseInt($("#zap").val())
        niveau = 0
        secteur = parseInt($("#secteur").val())
        try {
            url_data = `dataLycee/${code_dren}/${code_cisco}/${code_commune}/${code_zap}/${secteur}`
            data = await utils.fetchData(url_data, 'GET', {})
            const table = $('#datatable');
            cols = [
                { data: 'CODE_ETAB' },
                { data: 'DREN' },
                { data: 'CISCO' },
                { data: 'COMMUNE' },
                { data: 'ZAP' },
                { data: 'FOKONTANY' },
                { data: 'NOM_ETAB' },
                { data: 'CATEGORIE_COMMUNE' },
                { data: 'places' },
                { data: 'sdc_be' },
                { data: 'sdc_me' },
                { data: 'TYPE_SOURCE_EAU' },
                { data: 'TYPE_SOURCE_ELECTRICITE' },
            ]
            populateDataTable(table, "Listes des Etablissements Lycées", data, cols)
            //Obtenir les autres donnees  comme effectif, personnels, sdc, autres info
            
            const table_eff = $('#datatable-effectif');
            cols = [
                { data: 'CODE_ETAB' },
                { data: 'DREN' },
                { data: 'CISCO' },
                { data: 'COMMUNE' },
                { data: 'ZAP' },
                { data: 'NOM_ETAB' },
                { data: 'CATEGORIE_COMMUNE' },
                { data: 'eff_2022' },
                { data: 'eff_2023' },
                { data: 'eff_2024' },
                { data: 'eff_2025' },
                { data: '_2nde' },
                { data: '_1re' },
                { data: 'tle' },
            ]
            populateDataTable(table_eff, "Effectifs Lycées", data, cols)

            //personnels
            const table_pers = $('#datatable-personnel');
            cols = [
                { data: 'CODE_ETAB' },
                { data: 'DREN' },
                { data: 'CISCO' },
                { data: 'COMMUNE' },
                { data: 'ZAP' },
                { data: 'NOM_ETAB' },
                { data: 'CATEGORIE_COMMUNE' },
                { data: 'pers_total' },
                { data: 'en_classe' },
                { data: 'fonctionnaire' },
                { data: 'fram_sub' },
                { data: 'fram_nonsub' },
                { data: 'bepc' },
                { data: 'bacc' },
                { data: 'qualifiee' },
            ]
            populateDataTable(table_pers, "Personnels Lycées", data, cols)
                        
        } catch (error) {
            console.error('Erreur lors de la récuperation des données Ecoles Lycées :', error);
        } finally {
            utils.waitmeClose('div-map')  
        }

    }

    const populateDataTable = async function (dom, title, data, colums) {
        // Vérifier si le DataTable existe déjà et le détruire
        if ($.fn.DataTable.isDataTable(dom)) {dom.DataTable().clear().destroy();}
        dom.DataTable({
            dom: 'Bfrtip', // Positionne les boutons et le filtre
            buttons: [
                {
                    extend: 'excelHtml5', // Bouton pour exporter en Excel
                    text: 'Exporter en Excel',
                    title: `${title}` // Nom du fichier Excel
                }
            ],
            language: {
                search: "Rechercher :", // Texte du filtre de recherche
                lengthMenu: "Afficher _MENU_ entrées",
                info: "Affichage de _START_ à _END_ sur _TOTAL_ entrées",
                paginate: {
                    first: "Premier",
                    last: "Dernier",
                    next: "Suivant",
                    previous: "Précédent"
                }
            },
            data: data,
            columns: colums,
        })
    }

})
