$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('content-page', 'win8')
})
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('content-page')
})
$(document).on("ajaxStop", function () {
    utils.waitmeClose('content-page')
})

//mode minimal show pour le menu gauche
/*
$("#accordionSidebar").removeClass("toggled").addClass("toggled")
$(".nav-item .collapse").removeClass("show") //#collapseORS
$("#accordionSidebar").toggleClass("toggled")
*/

$(document).ready(function () {

    $(document).on("change", "#dren", async function () {
        if ($(this).val() == 0) {
            $("#cisco").html(`<option value="0">-Toutes-</option>`)
            $("#cisco").change()
            return
        }
        code_dren = $(this).val()
        utils.waitmeShow('content-page', 'win8')
        url = `cisco/${code_dren}`
        $("#cisco").html(`<option value="0">-Toutes-</option>`)
        $.ajax({
            url: url,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
            success: function (data) {
                if (data.length) {
                    for (let c of data) {
                        $("#cisco").append(`<option value="${c.CODE_CISCO}">${c.CISCO}</option>`)
                    }
                } else {
                    console.log("Erreur d'exécution de l'url ", url)
                }

                $("#cisco").change()

            },
            error: function (xhr, status, error) {
                console.error('Erreur:', status, error);
            }
        })

    })

    $(document).on("change", "#cisco", async () => {
        get_stats()
    })

    $(document).on("change", "#secteur", async () => {
        get_stats()
    })

    get_stats()

}) // REady

const get_stats = async () => {
    code_dren = $("#dren").val()
    code_cisco = $("#cisco").val()
    secteur = $("#secteur").val()

    const labels = ['2022', '2023', '2024','2025']
    url_stats_etab = `statsEtablissements/${code_dren}/${code_cisco}/${secteur}`
    url_stats_elevesN0N1 = `statsElevesN0N1/${code_dren}/${code_cisco}/${secteur}`
    url_stats_elevesN2N3 = `statsElevesN2N3/${code_dren}/${code_cisco}/${secteur}`
    url_stats_ens = `statsEnseignantsEnClasse/${code_dren}/${code_cisco}/${secteur}`
    url_stats_places = `statsPlaceAssises/${code_dren}/${code_cisco}/${secteur}`

    var data_eleves_n0, data_eleves_n1, data_eleves_n2, data_eleves_n3 = []
    var data_etab_n0, data_etab_n1, data_etab_n2, data_etab_n3 = []
    await utils.fetchData(url_stats_etab, 'GET', {}, async function (data) {
       //console.log("ETABS", data)
        $("#etab_n0").html(`<b>${data[0].n0_2025}</b>`)
        $("#etab_n1").html(`<b>${data[0].n1_2025}</b>`)
        $("#etab_n2").html(`<b>${data[0].n2_2025}</b>`)
        $("#etab_n3").html(`<b>${data[0].n3_2025}</b>`)
        data_etab_n0 = [parseInt(data[0].n0_2022), parseInt(data[0].n0_2023), parseInt(data[0].n0_2024), parseInt(data[0].n0_2025)]
        data_etab_n1 = [parseInt(data[0].n1_2022), parseInt(data[0].n1_2023), parseInt(data[0].n1_2024), parseInt(data[0].n1_2025)]
        data_etab_n2 = [parseInt(data[0].n2_2022), parseInt(data[0].n2_2023), parseInt(data[0].n2_2024), parseInt(data[0].n2_2025)]
        data_etab_n3 = [parseInt(data[0].n3_2022), parseInt(data[0].n3_2023), parseInt(data[0].n3_2024), parseInt(data[0].n3_2025)]

        // preparation des data pour le graphique line
        
        let data_n0 = {
            labels: labels,
            datasets: [{ label: 'PRESCOLAIRE', data: data_etab_n0, }]
        }
        drawLine("ctx-etabs-n0", data_n0)
        let data_n1 = {
            labels: labels,
            datasets: [{ label: 'PRIMAIRE', data: data_etab_n1, }]
        }
        drawLine("ctx-etabs-n1", data_n1)
        let data_n2 = {
            labels: labels,
            datasets: [{ label: 'COLLEGE', data: data_etab_n2, }]
        }
        drawLine("ctx-etabs-n2", data_n2)
        let data_n3 = {
            labels: labels,
            datasets: [{ label: 'LYCEE', data: data_etab_n3, }]
        }
        drawLine("ctx-etabs-n3", data_n3)

    })
    await utils.fetchData(url_stats_elevesN0N1, 'GET', {}, async function (data) {
        $("#eleves_n0").html(`<b>${data[0].n0_2025}</b>`)
        $("#eleves_n1").html(`<b>${data[0].n1_2025}</b>`)
        data_eleves_n0 = [parseInt(data[0].n0_2022), parseInt(data[0].n0_2023), parseInt(data[0].n0_2024), parseInt(data[0].n0_2025)]
        data_eleves_n1 = [parseInt(data[0].n1_2022), parseInt(data[0].n1_2023), parseInt(data[0].n1_2024), parseInt(data[0].n1_2025)]

        // preparation des data pour le graphique line
        let data_n0 = {
            labels: labels,
            datasets: [{
                label: 'PRESCOLAIRE', data: data_eleves_n0, fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
        drawLine("ctx-eleve-n0", data_n0)
        let data_n1 = {
            labels: labels,
            datasets: [{
                label: 'PRIMAIRE', data: data_eleves_n1, fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
        drawLine("ctx-eleve-n1", data_n1)
    })

    await utils.fetchData(url_stats_elevesN2N3, 'GET', {}, async function (data) {
        $("#eleves_n2").html(`<b>${data[0].n2_2025}</b>`)
        $("#eleves_n3").html(`<b>${data[0].n3_2025}</b>`)
        data_eleves_n2 = [parseInt(data[0].n2_2022), parseInt(data[0].n2_2023), parseInt(data[0].n2_2024), parseInt(data[0].n2_2025)]
        data_eleves_n3 = [parseInt(data[0].n3_2022), parseInt(data[0].n3_2023), parseInt(data[0].n3_2024), parseInt(data[0].n3_2025)]

        // preparation des data pour le graphique line
        let data_n2 = {
            labels: labels,
            datasets: [{
                label: 'COLLEGE', data: data_eleves_n2, fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
        drawLine("ctx-eleve-n2", data_n2)
        let data_n3 = {
            labels: labels,
            datasets: [{
                label: 'LYCEE', data: data_eleves_n3, fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
        drawLine("ctx-eleve-n3", data_n3)
    }) //stat effectif N22 sy N3
    
    //obtenir les stats sur les enseignants en salle
    await utils.fetchData(url_stats_ens, 'GET', {}, async function (data) {
        console.log(data[0].n0_2025,data[0].n1_2025)
        $("#ens_en_classe_n0").html(`<b>${data[0].n0_2025}</b>`)
        $("#ens_en_classe_n1").html(`<b>${data[0].n1_2025}</b>`)
        $("#ens_en_classe_n2").html(`<b>${data[0].n2_2025}</b>`)
        $("#ens_en_classe_n3").html(`<b>${data[0].n3_2025}</b>`)
    })

    //obtenir les statistiques sur les places assises
    await utils.fetchData(url_stats_places, 'GET', {}, async function (data) {
        $("#places_n0").html(`<b>${data[0].n0_2025}</b>`)
        $("#places_n1").html(`<b>${data[0].n1_2025}</b>`)
        $("#places_n2").html(`<b>${data[0].n2_2025}</b>`)
        $("#places_n3").html(`<b>${data[0].n3_2025}</b>`)
    })

}
const drawLine = async (dom, data) => {
    ctx = document.getElementById(dom).getContext('2d')
    if (!ctx) {
        $(`#dom-${dom}`).html(`<canvas id="${dom}" height="200"></canvas>`)
    } else {
        $(`#dom-${dom}`).html("")
        ctx = null
        $(`#dom-${dom}`).html(`<canvas id="${dom}" height="200"></canvas>`)
    }
    ctx = document.getElementById(dom).getContext('2d')
    new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        },
    })
}