$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('div-map', 'win8')
})
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('div-map')
})
$(document).on("ajaxStop", function () {
    utils.waitmeClose('div-map')
})

//mode minimal show pour le menu gauche
/*
$("#accordionSidebar").removeClass("toggled").addClass("toggled")
$(".nav-item .collapse").removeClass("show") //#collapseORS
*/

$(document).ready(async function () {
    $(document).on("input", "#radius", function () {
        $("#radius_value").html(`${$(this).val()/1000}km`)
    })
    
    const turf_units = { units: 'kilometers' }
    var OVER_LAYERS = {}
    var CTRL_AIRE = null
    window['layer_village'] = new L.layerGroup() // pour les villages
    window['layer_nc'] = new L.layerGroup() // pour les nouvelles création
    window['layer_etabN1S0'] = new L.layerGroup() // pour les epp
    window['layer_etabN1S0'].options.name = 'layer_etabN1S0'
    window['layer_etabN1S0'].options.id = 'N1S0'
    window['layer_etabN1S1'] = new L.layerGroup() // pour les ecoles privées

    var clusterVillages = new L.markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 50,
        chunkDelay: 100,
        disableClusteringAtZoom: 12
    })

    window[`layer_villages_exclu`] = new L.layerGroup()

    //map et les shapes administratives
    window['map'] = null
    window['shp_dren'] = null
    window['shp_cisco'] = null
    window['shp_commune'] = null
    window['shp_fokontany'] = null
    window['liste_nc'] = []

    //pour l'analyse d'eligibilité
    var liste_villages = []
    var liste_etabs = []
    var listeSearch = [] // pour liste des  recherche villages et ecoles
    var tempPositionMarker = null // pour deplacement sur carte vers lieu recherché

    var markerLines_etab = L.layerGroup() // Global Layer
    var markerLines_village = L.layerGroup() // Global Layer

    var markerGroup_buffer_etab = L.layerGroup() // Global Layer
    var markerGroup_etab_proximite = L.layerGroup() // Global Layer
    var temp_buffer_etab = null
    var temp_buffer_village = null
    var temp_buffer_real = null

    //les styles
    const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 4, opacity: 1, fillOpacity: 0.03 }
    const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 3, opacity: 0.9, fillOpacity: 0.03 }
    const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 0.8, fillOpacity: 0.03 }
    const STYLE_FOKONTANY = { fillColor: '#55ff00', color: '#55ff00', weight: 0.6, opacity: 0.5, fillOpacity: 0.03 }
    const STYLE_NC = { fillColor: 'red', color: 'black', weight: 1, opacity: 1, fillOpacity: 0.3 }


    //changement DREN
    $(document).on("change", "#dren", async function () {
        if (parseInt($(this).val()) === 0) { return }
        await getBaseLayer(parseInt($(this).val()), parseInt($("#cisco").val()))
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }
        clearEtabLayers()
        removeOverLayer()

        url = `listeCisco/${parseInt($(this).val())}`
        $("#cisco").html(`<option value="0" selected >-Toutes-</option>`)
        $.ajax({
            url: url,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
            success: async function (data) {
                if (data.length) {
                    for (let c of data) {
                        selected = c.CODE_CISCO == USER_CISCO ? "selected" : ""
                        if (USER_CISCO == 0 || USER_CISCO == c.CODE_CISCO) {
                            $("#cisco").append(`<option value="${c.CODE_CISCO}">${c.CISCO}</option>`)
                        }

                    }
                    $("#cisco").removeAttr("disabled")
                    $("#btn-filter").removeAttr("disabled")
                } else {
                    console.log("Erreur d'exécution de l'url ", url)
                }

            },
            error: function (xhr, status, error) {
                console.error('Erreur:', status, error)
                utils.waitmeClose('div-map')
                $("#cisco").html(`<option value="0">-Aucunes Données-</option>`)
            }
        })

        $(".btn-download").addClass("d-none hidden")

    }) // change DREN

    //changement CISCO
    $(document).on("change", "#cisco", async function () {
        code_cisco = parseInt($(this).val())
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }
        clearEtabLayers()
        removeOverLayer()
        await getBaseLayer(parseInt($("#dren").val()), parseInt($(this).val()))

        $(".btn-download").addClass("d-none hidden")

    }) // change CISCO

    const getBaseLayer = async (code_dren, code_cisco) => {
        if (code_dren == 0) {
            return
        }
        url_dren = `layerDren/${code_dren}`
        url_cisco = `layerCisco/${code_dren}/${code_cisco}`
        $.ajax({
            url: url_dren,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
        }).done(async function (data1) {
            l1 = data1[0].shape
            window['shp_dren'] = L.geoJSON(l1, {
                style: STYLE_DREN
            })
            $.ajax({
                url: url_cisco,
                type: 'GET',
                headers: { 'Access-Control-Allow-Origin': '*' },
            }).done(async function (data2) {
                l2 = data2[0].shape
                window['shp_cisco'] = L.geoJSON(l2, {
                    contextmenu: true,
                    style: STYLE_CISCO,
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            contextmenu: (e) => {
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        { label: 'Zoom +', onClick: () => { map.setZoom(map.getZoom() + 0.5) } },
                                        { label: 'Zoom -', onClick: () => { map.zoomOut() } },
                                        { type: 'seperator' },
                                        { label: 'Aller vers cet endroit.', onClick: () => { centerMap(e) } }
                                    ]
                                })
                            }
                        })
                        layer.bindTooltip(`CISCO ${feature.properties.name}`,
                            {
                                className: '',
                                permanent: false,
                                opacity: 1,
                                direction: 'top',
                            }
                        )
                    }
                })

                if (code_cisco >= 101) {
                    await window['shp_dren'].remove()
                    await window['shp_cisco'].addTo(map)
                    await map.fitBounds(window['shp_cisco'].getBounds())
                } else {
                    await window['shp_dren'].addTo(map)
                    await window['shp_cisco'].addTo(map)
                    await map.fitBounds(window['shp_dren'].getBounds())
                }

            })
        }).fail(function (jqXHR, textStatus) {
            console.log("Erreur loading layer DREN et CISCO : " + textStatus);
        })

        $("#btn-filter").removeAttr("disabled")
    }

    //preparation couche commune, fokontany
    const getCTDLayer = async () => {
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($("#cisco").val())

        if (code_dren == 0) {
            return
        }
        url_comm = `layerCommune/${code_dren}/${code_cisco}`
        url_fkt = `layerFokontany/${code_dren}/${code_cisco}`
        $.ajax({
            url: url_comm,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
        }).done(async function (data1) {
            
            l1 = data1[0].shape
            window['shp_commune'] = L.geoJSON(l1, {
                style: STYLE_COMMUNE,
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(`Commune ${feature.properties.name}`,
                        {
                            className: '',
                            permanent: false,
                            opacity: 1
                        }
                    )
                    polygonCoords = feature.geometry.coordinates
                    polyName = feature.properties.name
                    //console.log(polyName, polygonCoords)
                    const polygon = turf.multiPolygon(polygonCoords)
                    isWithin = false
                    for (const v of liste_villages) {
                        point = [parseFloat(v.longitude), parseFloat(v.latitude)]
                        const pointFeature = turf.point(point)
                        isWithin = turf.booleanPointInPolygon(pointFeature, polygon)
                        if (isWithin) {
                            v.commune = polyName
                        }
                    }
                },
            })
            $.ajax({
                url: url_fkt,
                type: 'GET',
                headers: { 'Access-Control-Allow-Origin': '*' },
            }).done(async function (data2) {
                l2 = data2[0].shape
                window['shp_fokontany'] = L.geoJSON(l2, {
                    contextmenu: true,
                    style: STYLE_FOKONTANY,
                    onEachFeature: (feature, layer) => {
                        polygonCoords = feature.geometry.coordinates
                        polyName = feature.properties.name
                        //console.log(polyName, polygonCoords)
                        const polygon = turf.multiPolygon(polygonCoords)
                        isWithin = false
                        for (const v of liste_villages) {
                            point = [parseFloat(v.longitude), parseFloat(v.latitude)]
                            const pointFeature = turf.point(point)
                            isWithin = turf.booleanPointInPolygon(pointFeature, polygon)
                            if (isWithin) {
                                v.fokontany = polyName
                            }
                        }

                        layer.on({
                            contextmenu: (e) => {
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        {
                                            label: `Télécharger les Données `, onClick: () => {
                                                window.open(`downloadOrsN1/${code_dren}/${code_cisco}`)
                                            }
                                        },
                                        { type: 'seperator' },
                                        { label: 'Zoom +', onClick: () => { map.setZoom(map.getZoom() + 0.5) } },
                                        { label: 'Zoom -', onClick: () => { map.zoomOut() } },
                                        { label: 'Aller vers cet endroit.', onClick: () => { centerMap(e) } },
                                    ]
                                })
                            }
                        })
                        layer.bindTooltip(`Fokontany ${feature.properties.name}`,
                            {
                                className: '',
                                permanent: false,
                                opacity: 1,
                                direction: 'top'
                            }
                        )
                    },
                })
                await window['shp_commune'].addTo(map)
                await window['shp_fokontany'].addTo(map)
            })
        }).fail(function (jqXHR, textStatus) {
            console.log("Erreur loading layer COMMUNE et FOKONTANY : " + textStatus);
        });

    }

    const initMap = async () => {
        await getBaseLayer(parseInt($("#dren").val()), parseInt($("#cisco").val()))
        utils.waitmeShow('div-map', 'win8')
        $("#div-map").html(`<div id="map" style="height: 100vh;"></div>`)
        const opts = { zoomDelta: 0.5, zoomSnap: 0.5, fullscreenControl: true, fullscreenControlOptions: { title: "Mode Plein ecran!", titleCancel: "Quitter mode plein ecran" } }
        map = L.map('map', opts).setView([-18.9189596, 47.5135653], 6) //map
        map.scrollWheelZoom.disable()
        L.control.scale().addTo(map)
        var DEFAULT_LAYER = L.tileLayer('', { maxZoom: 24, attribution: '© MEN/DPE' })
        var OSM_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, attribution: '© OpenStreetMap' }).addTo(map)
        const mapBoxApiKey = "pk.eyJ1IjoidG9reSIsImEiOiJjbTE4djVndXIxNmQwMmxzam1nY3JzcWU0In0.KtMOpNhicsXZkbmcFtVd8w"
        const opts_mapBox = {
            maxZoom: 24,
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.mapbox.com/">Mapbox</a>',
            id: 'mapbox/streets-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: `${mapBoxApiKey}`
        }
        var MAP_BOX = L.tileLayer(`https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${mapBoxApiKey}`, opts_mapBox)
        var IMAGERY_LAYER = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, attribution: '&copy; Esri' })
        const BASE_LAYER = {
            "DEFAULT": DEFAULT_LAYER,
            "OSM": OSM_LAYER,
            "IMAGERY": IMAGERY_LAYER,
            "MAPBOX": MAP_BOX
        }

        map.flyTo([-18.91891771052786, 47.51385211944581], 6)

        L.easyButton('fas fa-redo-alt fa-lg  init', function (btn, map) {
            if (map.hasLayer(window['shp_dren'])) {
                map.fitBounds(window['shp_dren'].getBounds())
            } else if (map.hasLayer(window['shp_cisco'])) {
                map.fitBounds(window['shp_cisco'].getBounds())
            }

            clearAnalyseLayers()

        }, 'Reinitialiser', 'init').addTo(map)

        L.easyButton('fas fa-print', function (btn, map) {
            //print()
            code_cisco = parseInt($("#cisco").val())
            image_name = (code_cisco == 0) ? `ORS_PRIMAIRE_DREN_${code_dren}.png` : `ORS_PRIMAIRE_CISCO_${code_cisco}.png`
            utils.captureScreen(image_name)
        }, 'Imprimer', 'print').addTo(map)

        /*var legend = L.control({ position: 'bottomright' })
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend')
            div.innerHTML += '<p style="font-size: 16px;"><strong><u>Légende</u><strong></p>'
            div.innerHTML += '&nbsp;<span class="fa fa-2x" style="color:#36b9cc">•</span>&nbsp;Ecoles Publiques</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-caret-up text-danger"></i>&nbsp;villages</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#e74a3b"></i>&nbsp;ELIGIBLE</br>' //rouge
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#1cc88a"></i>&nbsp;NON ELIGIBLE</br>' // vert
            /*div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:green"></i>&nbsp;RATIO ELEVE-SALLE [20-50]</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#c0c0c0"></i>&nbsp;Limite Commune</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#55ff00"></i>&nbsp;Limite Fokontany</br>'
            L.DomEvent.disableClickPropagation(div)
            return div
        }
        legend.addTo(map)*/

        
        map.on('zoomend', function () {
            var currentZoom = map.getZoom()
            if (currentZoom <= 10) {
                $(".label").css("font-size", "0px")
            }
            if (currentZoom > 11 && currentZoom <= 14) {
                $(".label").css("font-size", "10px")
            }
            if (currentZoom > 14 && currentZoom <= 16) {
                $(".label").css("font-size", "12px")
            }
            if (currentZoom > 16) {
                $(".label").css("font-size", "14px")
            }
        })
        

        /*
        map.on('baselayerchange', function (eventLayer) {
            var currentZoom = map.getZoom()
            if (eventLayer.name === 'DEFAULT' || eventLayer.name === 'OSM') {
                if (currentZoom > 12) { $(".label").css('color', 'black') }
            } else {
                if (currentZoom > 12) { $(".label").css('color', 'white') }
            }
        })
        */

        window['layerControl'] = L.control.layers(BASE_LAYER, {}, { position: 'topright', collapsed: false })
        window['layerControl'].addTo(map)

        //await getBaseLayer(parseInt(USER_DREN), parseInt(USER_CISCO))
        utils.waitmeClose('div-map')

    } //iniMap




    $(document).on("click", "#btn-filter", async function () {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        RADIUS = $("#radius").val()

        if (CODE_DREN === 0) {
            utils.waitmeClose('div-map')
            utils.showModal("Attention", "Veuillez choisir la DREN et/ou la CISCO pour poursuivre l'opération!", "danger")
            return
        }
        listeSearch = []
        clearBaseLayers()
        clearEtabLayers()
        removeOverLayer()
        clearAnalyseLayers()
        //******************************************RECUPERATIOn DES LAYERS ETABLISSEMENTS PAR NIVEAU  ********************** */
        utils.waitmeShow('div-map','win-8')
        await downloadLayerEtab(CODE_DREN, CODE_CISCO)
        await getAllVillages()
        /**** BASE LAYER POUR LES STD ET FOND ****************/
        await getLayerNc()
        await getBaseLayer(parseInt($("#dren").val()), parseInt($("#cisco").val()))
        await getCTDLayer()
        utils.waitmeClose('div-map')

        //await getLayerVilllages()

    })

    const downloadLayerEtab = async (code_dren, code_cisco) => {
        RADIUS = $("#radius").val()

        $("#btn-download").attr("href", `downloadOrsN1/${code_dren}/${code_cisco}`)
        //$("#btn-download-nat").attr("href", `downloadOrsN1Nationale/`)


        url = `layerBesoinsN1/${code_dren}/${code_cisco}`
        //on enchaine les appels de creation layers pour avoir l'ordre par niveau
        await utils.fetchData(url, 'GET', {}, async function (data) {
            await createLayerEtab(data)
            await window['layerControl'].addOverlay(window['layer_etabN1S0'], "ECOLES PUBLIQUES")
            $(".label").css("font-size", "5px")

            // case a cocher pour control aire des etablissements
            if (CTRL_AIRE) { CTRL_AIRE.remove() }
            CTRL_AIRE = L.control({ position: 'topright' })
            CTRL_AIRE.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'control-aire')
                div.innerHTML += '<div><b>CATEGORISER LA CARTE</b></div><hr/>'
                div.innerHTML += '<input id="aucune" class="ctrl_aire_etab" checked type="radio" name="ctrl_aire" style=""/>&nbsp;AUCUNE</br>'
                div.innerHTML += '<input id="extension" class="ctrl_aire_etab" type="radio" name="ctrl_aire" style=""/>&nbsp;EXTENSION</br>'
                div.innerHTML += '<input id="reconst" class="ctrl_aire_etab" type="radio" name="ctrl_aire" style=""/>&nbsp;RECONSTRUCTION</br>'
                div.innerHTML += '<input id="rehab" class="ctrl_aire_etab" type="radio" name="ctrl_aire" style=""/>&nbsp;REHABILITATION</br>'
                div.innerHTML += '<input id="tablebanc" class="ctrl_aire_etab" type="radio" name="ctrl_aire" style=""/>&nbsp;TABLE-BANCS</br>'
                L.DomEvent.disableClickPropagation(div)
                return div
            }
            CTRL_AIRE.addTo(map)
            //event click checkboxe arie etablissement
            $(document).on("change", ".ctrl_aire_etab", function () {
                id = $(this).attr("id")
                etabLayer = window[`layer_etabN1S0`]
                if ($(this).prop("checked") && map.hasLayer(etabLayer)) { // cochage sady misy layer etab
                    updateStyleLayerEtab(id)
                } else if (!$(this).prop("checked") && map.hasLayer(etabLayer)) { // decochage sady layer etab

                } else if ($(this).prop("checked") && !map.hasLayer(etabLayer)) { //coché fa tsisy layer etab
                    utils.showModal("Attention!", " Veuillez afficher la couche établissement", "danger")
                    $(this).prop("checked", false)
                }
            })

        })

        //chargement des couches etablissements privées
        url_n1s1 = `layerEtabN1/${code_dren}/${code_cisco}`
        await utils.fetchData(url_n1s1, 'GET', {}, async function (data) {
            //console.log("ECOLE PRIVEES", data)
            //return
            data.forEach(etab => {
                if (parseInt(etab.SECTEUR) == 1) {
                    starIcon = L.divIcon({
                        className: 'custom-icon',
                        html: `<i class="fas fa-circle text-warning"></i><span style="font-size:8px" class="label">${etab.NOM_ETAB}</span>`
                    })
                    properties = {
                        "NOM_ETAB": `${etab.NOM_ETAB}`, "CODE_DREN": `${etab.CODE_DREN}`, "CODE_CISCO": `${etab.CODE_CISCO}`,
                        "CODE_ETAB": `${etab.CODE_ETAB}`, "effectifs": `${parseInt(etab.effectifs)}`, "gp_sections": `${parseInt(etab.gp_sections)}`, "sdc_be": `${parseInt(etab.sdc_be)}`, "sdc_me": `${parseInt(etab.sdc_me)}`,
                    }
                    if (!isNaN(parseFloat(etab.latitude)) && !isNaN(parseFloat(etab.longitude))) {
                        latLng = [parseFloat(etab.latitude), parseFloat(etab.longitude)]
                        marker_etab = L.marker(latLng, { icon: starIcon })
                        marker_etab.bindTooltip(etab.NOM_ETAB)
                        marker_etab.feature = {};
                        marker_etab.feature.properties = properties
                        window['layer_etabN1S1'].addLayer(marker_etab)

                    }
                }

            })
            await window['layerControl'].addOverlay(window['layer_etabN1S1'], "ECOLES PRIVEES")

        })
    }

    //mettre à jour les styles des layers ecoles publiques selon le thème choisit
    const updateStyleLayerEtab = async (id) => {
        var tooltip = ''

        window['layer_etabN1S0'].eachLayer(function (marker) {
            var properties = marker.feature ? marker.feature.properties : {}
            is_reconst = (parseInt(properties.eligible_reconstruction) == 1) ? 'OUI' : 'NON'
            is_rehab = (parseInt(properties.eligible_rehabilitation) == 1) ? 'OUI' : 'NON'
            tooltip = `<div class="custom-tooltip">
                            <table class="table table-bordered table-condensed dataTable"  width = "100%" cellspacing = "10" style = "width: 100%;" >
                                <thead>
                                    <tr role="row" align="center"><th colspan="2" align="center" class="p-2">${properties.NOM_ETAB}</th></tr>
                                </thead>
                                <tbody>
                                    <tr><th>EFFECTIFS</th><td align="right">${properties.effectifs}</td></tr>
                                    <tr><th>SALLE EN BON ETAT</th><td align="right" class="${properties.sdc_be == '0' ? "alert alert-danger" : ""}">${properties.sdc_be}</td></tr>
                                    <tr><th>SALLE EN MAUVAIS ETAT</th><td align="right">${properties.sdc_me}</td></tr>
                                    <tr><th>SALLE REQUIS</th><td align="right">${properties.sdc_requis}</td></tr>
                                    <tr><th>PLACES ASSISES</th><td align="right" class="${properties.places == '0' ? "alert alert-danger" : ""}">${properties.places}</td></tr>
                                    <tr style="background:${(id == "extension") ? '#ddd' : ''}"><th>BESOIN EXTENSIONS</th><td align="right">${properties.extensions}</td></tr>
                                    <tr style="background:${(id == "rehab") ? '#ddd' : ''}"><th>BESOIN REHABILITATION</th><td align="right">${is_rehab}</td></tr>
                                    <tr style="background:${(id == "reconst") ? '#ddd' : ''}"><th>BESOIN RECONSTRUCTION</th><td align="right">${is_reconst}</td></tr>
                                    <tr style="background:${(id == "tablebanc") ? '#ddd' : ''}"><th>BESOIN TABLE-BANCS 2PLACES</th><td align="right">${Math.ceil(Math.max(parseInt(properties.effectifs) - parseInt(properties.places), 0) / 2)}</td></tr>
                                </tbody>
                            </table>
                        </div>`
            if (id == "aucune") {
                text_cls = "#36b9cc"
                tooltip = `${properties.NOM_ETAB}`
            }
            if (id == "extension") {
                text_cls = parseInt(properties.extensions) > 0 ? "#e74a3b" : "#1cc88a"
            }

            if (id == "reconst") {
                text_cls = parseInt(properties.eligible_reconstruction) == 1 ? "#e74a3b" : "#1cc88a"
            }
            if (id == "rehab") {
                text_cls = parseInt(properties.eligible_rehabilitation) == 1 ? "#e74a3b" : "#1cc88a"
            }
            if (id == "tablebanc") {
                text_cls = parseInt(properties.places) < parseInt(properties.effectifs) ? "#e74a3b" : "#1cc88a"
            }
            starIcon = L.divIcon({
                className: 'custom-icon',
                html: `<i class="fas fa-circle" style="color:${text_cls};"></i><span class="label">${properties.NOM_ETAB}</span>`
            })
            marker.setIcon(starIcon)
            marker.bindTooltip(tooltip, {
                permanent: false,
                opacity: 1,
                className: 'custom-tooltip',
                direction: 'left'
            })
        })
    }

    //transformer les donnees etab en Layer avec son class, icon fa, son id et son label sur la carte
    //Obtenir layer etablissements avec les Besoins
    const createLayerEtab = async (data) => {
        /* exemple data :
        {"NOM_ETAB": "ECOLE COMMUNAUTAIRE AMBATOHARANANA", "ANNEE_SCOLAIRE": 2024, "CODE_DREN": 11, "CODE_CISCO": 105, 
          "CODE_ETAB": 105010002, "effectifs": 40, "gp_sections": 1.0, "sdc_be": 3, "sdc_me": 0,  
          "eligible_reconstruction": 0, "eligible_rehabilitation": 0, "sdc_requis": 1.0, "places": 76,
           "latitude": -18.47394597,"longitude": 47.46306854
        }
         */
        RADIUS = $("#radius").val()
        liste_etabs = []
        data.forEach(etab => {
            liste_etabs.push(etab)
            starIcon = L.divIcon({
                className: 'custom-icon',
                html: `<i class="fas fa-circle text-info"></i><span class="label">${etab.NOM_ETAB}</span>`
            })
            properties = {
                "NOM_ETAB": `${etab.NOM_ETAB}`, "CODE_DREN": `${etab.CODE_DREN}`, "CODE_CISCO": `${etab.CODE_CISCO}`,
                "CODE_ETAB": `${etab.CODE_ETAB}`, "effectifs": `${parseInt(etab.effectifs)}`, "gp_sections": `${parseInt(etab.gp_sections)}`, "sdc_be": `${parseInt(etab.sdc_be)}`, "sdc_me": `${parseInt(etab.sdc_me)}`,
                "eligible_reconstruction": `${parseInt(etab.eligible_reconstruction)}`, "eligible_rehabilitation": `${parseInt(etab.eligible_rehabilitation)}`, "sdc_requis": `${parseInt(etab.sdc_requis)}`,
                "extensions": `${Math.max(parseInt(etab.sdc_requis) - (parseInt(etab.sdc_be) + parseInt(etab.sdc_me)), 0)}`, "places": `${parseInt(etab.places)}`,
            }
            if (!isNaN(parseFloat(etab.latitude)) && !isNaN(parseFloat(etab.longitude))) {

                latLng = [parseFloat(etab.latitude), parseFloat(etab.longitude)]
                marker_etab = L.marker(latLng, { contextmenu: true,icon: starIcon })
                marker_etab.bindTooltip(etab.NOM_ETAB)
                marker_etab.feature = {};
                marker_etab.feature.properties = properties
                marker_etab.on({
                    contextmenu: (e) => {
                        new Contextual({
                            isSticky: false,
                            items: [
                                { type: 'seperator' },
                                { label: '<i class="fa fa-circle text-white"></i>&nbsp;Afficher l\'aire', onClick: () => { show_aire_etab(e.target) } },
                                { type: 'seperator' },
                            ]
                        })
                    }
                })
                window[`layer_etabN1S0`].addLayer(marker_etab)

                //preparation lsite pour recherche
                listeSearch.push({ latLng: latLng, id: etab.CODE_ETAB, name: etab.NOM_ETAB })

            }
        })
        //console.log('liste etabs', liste_etabs)

    } //creation Layer des etabs


    //création layer nouvelle création et liste des villages pour NC
    const getLayerNc = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        if (window['layer_nc']) { window['layer_nc'].remove() }
        window['liste_nc'] = [] // liste village eligible NC pour download
        url = 'layerNouvelleCreation/'
        await utils.fetchData(url, 'GET', {}, async function (data) {
            window['layer_nc'] = await L.geoJSON(data[0].shape, {
                style: STYLE_NC,

                onEachFeature: (feature, layer) => { // action atao isaky ny feature
                    //console.log(feature.properties)
                    nom = feature.properties.name
                    satelittes = feature.properties.satelittes
                    population = parseInt(feature.properties.population)
                    row = { CODE_DREN: feature.properties.code_dren, CODE_CISCO: feature.properties.code_cisco, SITE: feature.properties.name, Y: parseFloat(feature.properties.y), X: parseFloat(feature.properties.x) }
                    row.NOMBRE_SAT = satelittes.length
                    row.SATELLITES = ''
                    tooltip = `<div class="custom-tooltip">
                            <table class="table table-bordered table-condensed dataTable"  width = "100%" cellpadding='2' style = "width: 100%;" >
                                <thead>
                                    <tr role="row" align="center" style="background:#aaa;color;#fff"><th colspan="2" align="center" class="p-2">${nom}</th></tr>
                                    <tr role="row" align="center" style="background:#feee"><th colspan="2" align="center" class="p-2">POPULATION TOTAL : ${population}</th></tr>
                                    <tr role="row" align="center" style="background:#f1f1f1"><th colspan="2" align="center" class="p-2">VILLAGES INCLUS DANS L'AIRE</th></tr>
                                </thead>
                                <tbody>
                                `

                    satelittes.forEach(s => {
                        st = s.split(":")
                        tooltip += `<tr><td width="85%" style="background:#f1f1f1">${st[0]}</td><td align="right">${st[1]}</td></tr>`
                        row.SATELLITES += st[0] + " - "

                    })
                    tooltip += `
                                </tbody>
                            </table>
                        </div>`

                    //mettre à jour liste village nouvelle creation pour download
                    window['liste_nc'].push(row)

                    layer.bindTooltip(tooltip, {
                        permanent: false, opacity: 1,
                        className: 'custom-tooltip',
                        direction: 'top',
                        offset: [10, -20]
                    })
                    layer.on({
                        //mouseup: (e) => { map.fitBounds(e.target.getBounds()) },

                    })
                },
                filter: (feature) => {
                    // return true si on veut toutes les NC Madagascar
                    ///return true
                    if (CODE_CISCO == 0) {
                        return (parseInt(feature.properties.code_dren) == CODE_DREN)
                    } else {
                        return (parseInt(feature.properties.code_cisco) == CODE_CISCO)
                    }

                }
            })
            //console.log(window['liste_nc'])
            await window['layerControl'].addOverlay(window['layer_nc'], "NOUVELLE CREATION")
        })
    } // end get layer NC


    const getAllVillages = async () => {
        RADIUS = $("#radius").val()

        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        url = `layerVillages/${CODE_DREN}/${CODE_CISCO}`

        liste_villages = []
        await utils.fetchData(url, 'GET', {}, async function (data) {

            utils.waitmeShow('div-map', 'win8')
            
            await data.forEach(async (v) => {
                latlng = [parseFloat(v.latitude), parseFloat(v.longitude)]
                lnglat = [parseFloat(v.longitude), parseFloat(v.latitude)]

                turfPoint = turf.point(lnglat)
                vID = v.id
                name = v.name
                distToEtabpp = 100 //km
                window[`layer_etabN1S0`].eachLayer(async (layer) => {
                    p1 = turf.point([layer.getLatLng().lng, layer.getLatLng().lat])
                    p2 = turf.point(lnglat)
                    dist = turf.distance(p1, p2, turf_units)
                    if (dist < distToEtabpp) {
                        distToEtabpp = dist
                    }
                })

                //on considère seulement les villages éloignés de 2km au moins d'une école publiqque
                // sinon, on peut considerer tous les villages en modifiant  >= 0 la distanceToEPP
                if (distToEtabpp > (RADIUS / 1000)) { color = "#FF0000"; is_exclu = true }
                else { color = "#FFFFFF"; is_exclu = false }
                
                //preparation liste pour recherche
                listeSearch.push({ latLng: latlng,id:v.id, name: v.name })

                liste_villages.push(v)

                starIcon = L.divIcon({
                    className: 'custom-icon',
                    iconSize: [20, 20],
                    html: `<i class="fa fa-circle" style="color:${color}"></i><span class="label" style="color:${color};font-size:7px;position: absolute;top: 10px;">${name}</span>`
                })
                marker = L.marker(latlng, {
                    properties: { vID, name, distToEtabpp, is_exclu: is_exclu },
                    contextmenu: is_exclu ,//&& (CODE_CISCO == USER_CISCO || (USER_CISCO == 0 && USER_DREN == 0)),
                    icon: starIcon
                })
                marker.bindTooltip(`<b>${name}</b>`, {
                    permanent: false,
                    opacity: 1,
                    className: 'custom-tooltip',
                    direction: 'bottom', // La direction du tooltip (top, bottom, left, right, auto) 
                    offset: [10, -20] // Décalage du tooltip par rapport au marqueur
                })
                if (distToEtabpp > (RADIUS / 1000)) {
                    marker.on({
                        contextmenu: (e) => {
                            new Contextual({
                                isSticky: false,
                                items: [
                                    { label: 'Afficher l\'aire', onClick: () => { show_satellite_village(e.target) } },
                                    { type: 'seperator' },
                                    { label: 'Analyse Eligibilité Création ', onClick: () => { analyseVillage(e.target) } },
                                ]
                            })
                        }
                    })
                }
                clusterVillages.addLayer(marker)
                
            })

        })


        //ajout du control des layers villages sur la carte
        window['layerControl'].addOverlay(clusterVillages, "VILLAGES")

        //Telecharger les donnees villages 
        $(document).on("click", "#btn-download-v", () => {
            if (liste_villages.length) {
                listes = utils.toUniqueListe(liste_villages,'id')
                csvContent = utils.convertObjectToCSV(listes)
                utils.downloadCSV(csvContent, 'VILLAGES_HORS_AIRE_ECOLES.csv');
            } else {
                alert("Aucune Données")
            }

        })

        //Telecharger les donnees villages 
        $(document).on("click", "#btn-download-nc", () => {
            if (window['liste_nc'].length) {
                csvContent = utils.convertObjectToCSV(window['liste_nc'])
                utils.downloadCSV(csvContent, 'VILLAGES_NOUVELLE_CREATION.csv');
            } else {
                alert("Aucune Données")
            }
        })

        $(".btn-download").removeClass("d-none hidden")
        utils.waitmeClose('div-map')
        $("#search").html(``)
        listeS = utils.toUniqueListe(listeSearch,'id')
        listeS.forEach(data => {
            $("#search").append(`<option value='${data.latLng}'>${data.name}</option>`)
        })
        $('#search').select2({
            language: "fr",
            placeholder: 'Rehercher Villages ou Ecoles',
            allowClear: true
        })
        //selection ecole ou village sur champ de recherche pour aller se positionner vers la selection
        $(document).on("change", "#search", function () {
            var coords = $(this).val().trim().split(",")
            latitude = parseFloat(coords[0])
            longitude = parseFloat(coords[1])
            map.flyTo([latitude, longitude], 12)
            if (tempPositionMarker) { tempPositionMarker.remove() }
            tempPositionMarker = L.circle([latitude, longitude], {
                radius: 1000, //metres
                color: 'yellow',
                fillColor: 'red',
                fillOpacity: 0.3
            })
            tempPositionMarker.bindPopup($(this).text()).openPopup()
            tempPositionMarker.addTo(map)
            // Esorina automatique apres 10 seconde ilay marker de recherche
            setTimeout(() => {
                tempPositionMarker.remove()
                tempPositionMarker = null
            }, 10000)
        })

    }


    //effacer les layerd etablissement et les clusters villages
    const clearEtabLayers = () => {
        if (window[`layer_etabN1S0`]) { window[`layer_etabN1S0`].clearLayers() }
        if (window[`layer_nc`]) { window[`layer_nc`].clearLayers() }
        if (clusterVillages) { clusterVillages.clearLayers() }

    }

    //supprimer les layers de la carte 
    const removeOverLayer = () => {
        if (window[`layer_etabN1S0`]) { window['layerControl'].removeLayer(window[`layer_etabN1S0`]) }
        if (window[`layer_etabN1S1`]) { window['layerControl'].removeLayer(window[`layer_etabN1S1`]) }
        if (window[`layer_nc`]) { window['layerControl'].removeLayer(window[`layer_nc`]) }
        if (window[`layer_villages_exclu`]) { window['layerControl'].removeLayer(window[`layer_villages_exclu`]) }
        if (clusterVillages) { window['layerControl'].removeLayer(clusterVillages) }
    }


    const clearAnalyseLayers = () => {
        markerLines_etab.clearLayers()
        markerLines_village.clearLayers()
        if (markerLines_etab) { markerLines_etab.remove() }
        if (temp_buffer_etab) { temp_buffer_etab.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        if (temp_buffer_real) { temp_buffer_real.remove() }
        if (markerLines_village) { markerLines_village.remove() }
        if (markerLines_village) { markerLines_village.remove() }
        if (markerGroup_buffer_etab) { markerGroup_buffer_etab.remove() }
        if (markerGroup_etab_proximite) { markerGroup_etab_proximite.remove() }
    }
    const clearBaseLayers = () => {
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }

    }

    const centerMap = function (e) {
        map.flyTo(e.latlng, 16)
    }

    const show_aire_etab = async (e) => {
        RADIUS = $("#radius").val()
        map.flyTo(e.getLatLng(), 14)
        villages_satellites = []
        if (markerLines_village) { markerLines_village.remove() }
        if (temp_buffer_etab) { temp_buffer_etab.remove() }
        listesV = utils.toUniqueListe(liste_villages,'id')
        listesV.forEach(v => {
            p1 = turf.point([e.getLatLng().lng, e.getLatLng().lat])
            p2 = turf.point([v.longitude, v.latitude])
            dist = turf.distance(p1, p2, turf_units);
            mV = L.marker([v.latitude, v.longitude], { name: v.name, distance: dist })
            if (dist <= 2) {
                villages_satellites.push(mV)
                markerLines_village.addLayer(L.polyline([e.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })
        temp_buffer_etab = L.circle(e.getLatLng(), {
            radius: RADIUS,
            color: 'green',
            fillOpacity: 0.2
        }).addTo(map)
        markerLines_village.addTo(map)

        setTimeout(() => {
            temp_buffer_etab.remove()
            markerLines_village.remove()
        }, 10000)
    }

    const show_satellite_village = async (e) => {
        RADIUS = $("#radius").val()

        map.flyTo(e.getLatLng(), 14)
        name = e.options.properties.nom
        villages_satellites = []
        markerLines_village.clearLayers()
        if (markerLines_village) { markerLines_village.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        listesV = utils.toUniqueListe(liste_villages,'id')
        listesV.forEach(v => {
            p1 = turf.point([e.getLatLng().lng, e.getLatLng().lat])
            p2 = turf.point([v.longitude, v.latitude])
            dist = turf.distance(p1, p2, turf_units);
            mV = L.marker([v.latitude, v.longitude], { name: v.name, distance: dist })
            if (dist <= 2) {
                villages_satellites.push(mV)
                markerLines_village.addLayer(L.polyline([e.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })
        listesE = utils.toUniqueListe(liste_etabs,'CODE_ETAB') //suppression doublon par CODE_ETAB
        listesE.forEach(etab => {
            p1 = turf.point([e.getLatLng().lng, e.getLatLng().lat])
            p2 = turf.point([etab.longitude, etab.latitude])
            dist = turf.distance(p1, p2, turf_units);

            mE = L.marker([etab.latitude, etab.longitude], { name: etab.NOM_ETAB, distance: dist })
            if (dist <= (RADIUS/1000)) {
                markerLines_village.addLayer(L.polyline([e.getLatLng(), mE.getLatLng()], { color: 'red' }))
            }
        })
        temp_buffer_village = L.circle(e.getLatLng(), {
            radius: RADIUS,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)
        markerLines_village.addTo(map)
    }

    //analyse d'éligibilité d'une village
    const analyseVillage = async (village) => {
        RADIUS = $("#radius").val()

        if (!map.hasLayer(window['layer_etabN1S0'])) {
            window['layer_etabN1S0'].addTo(map)
        }
        map.flyTo(village.getLatLng(), 14)
        nom = village.options.properties.name

        villages_satellites = []
        etab_proximite = []
        markerLines_village.clearLayers()

        if (markerLines_village) { markerLines_village.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        if (markerGroup_buffer_etab) { markerGroup_buffer_etab.remove() }
        if (markerGroup_etab_proximite) { markerGroup_etab_proximite.remove() }

        listesV = utils.toUniqueListe(liste_villages, 'id')
        listesV.forEach(v => {
            //console.log(v)
            p1 = turf.point([village.getLatLng().lng, village.getLatLng().lat])
            p2 = turf.point([v.longitude, v.latitude])
            dist = turf.distance(p1, p2, turf_units);
            //console.log(dist)
            if (dist <= (RADIUS/1000)) {
                mV = L.marker([v.latitude, v.longitude], { name: v.name, population: v.population, distance: dist })
                villages_satellites.push(mV)
                markerLines_village.addLayer(L.polyline([village.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })

        dp = 100 //distance etablissement le plus proche du village
        etab_p = "" // Ecole la plus proche
        c_p = [] // coords etab plus proche

        markerGroup_buffer_etab.clearLayers()
        markerGroup_etab_proximite.clearLayers()
        listesE = utils.toUniqueListe(liste_etabs, 'CODE_ETAB')
        listesE.forEach(etab => {
            coords_etab = [etab.latitude, etab.longitude]
            p1 = turf.point([village.getLatLng().lng, village.getLatLng().lat])
            p2 = turf.point([etab.longitude, etab.latitude])
            dist = turf.distance(p1, p2, turf_units)
            if (dist <= dp) {
                etab_p = etab.NOM_ETAB
                dp = dist
                c_p = [etab.latitude, etab.longitude]
            }
            if (dist <= (RADIUS/1000)) {
                bf_e = L.circle([etab.latitude, etab.longitude], {
                    properties: { name: etab.NOM_ETAB, distance: dist },
                    radius: RADIUS,
                    color: 'blue',
                    fillOpacity: 0.3
                })
                etab_proximite.push(bf_e)
                markerGroup_buffer_etab.addLayer(bf_e)
                markerLines_village.addLayer(L.polyline([village.getLatLng(), coords_etab], { color: 'red' }))
            }
        })
        markerGroup_etab_proximite.addLayer(
            L.circle(c_p, {
                properties: { name: etab_p, distance: dp },
                radius: RADIUS,
                color: 'blue',
                fillOpacity: 0.2
            })
        )

        markerLines_village.addTo(map)
        markerGroup_buffer_etab.addTo(map)
        markerGroup_etab_proximite.addTo(map)
        //tampon du village en cours d'analyse
        temp_buffer_village = L.circle(village.getLatLng(), {
            radius: RADIUS,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)

        chiffres = ["zero", "Un", "Deux", "Trois", "Quatre", "Cing", "Six", "Sept", "Huit", "Neuf", "Dix", "Onze", "Douze", "Treize", "Quatorze", "Quinze", "Seize"]

        dom = ` <div class="panel panel-info" style="padding: 5px;">
                    <div class="panel-heading"></div>
                    <div class="panel-body">
                        <div class='row'>
                            <dl>
                                <dt>Etablissement le plus proche</dt>
                                <dd> ${etab_p}: à ${parseFloat(dp).toFixed(1)} km</dd>
                            </dl>
                        </div>
                        <div class='row'>
                            <dl>
                                <dt>Etablissement(s) à moins de 2km (${etab_proximite.length <= 16 ? chiffres[etab_proximite.length] : etab_proximite.length})</dt>
                        `
        for (let i = 0; i < etab_proximite.length; i++) {
            dom += `<dd> ${etab_proximite[i].options.properties.name} : à ${(etab_proximite[i].options.properties.distance).toFixed(1)}km</dd>`
        }
        dom += `    </dl>
                        </div>
                        <div class='row '>
                            <div style="background:#ddd">Villages de zone de desserte</div>
                        </div>
                        <div class='row'>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped" id='tableVD'>
                                    <thead>
                                        <tr style='background:#ddd'>
                                            <th>Village</th>
                                            <th>Distance</th>
                                            <th>Population</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `
        for (let i = 0; i < villages_satellites.length; i++) {
            dom += `<tr>`
            dom += `<td> ${villages_satellites[i].options.name}</td>`
            dom += `<td> ${(villages_satellites[i].options.distance).toFixed(1)} km</td>`
            dom += `<td> <input type="number" value="${parseInt(villages_satellites[i].options.population)}" class="form-control population"  placeholder="Population" /></td>`
            dom += `</tr>`
        }
        dom += ` 
                                    </tbody>
                                </table>
                            </div><!-- /.table-responsive -->
                        </div><!-- /.row -->
                    </div>
                    <div class="panel panel-info" >
                        <div class="panel-heading" style="padding: 10px;">Eligibilité pour Nouvelle Création</div>
                    </div>
                    <div class="row">
                        <div class="col-lg-12" id="result"></div>
                    </div>
                    <div class="row">
                        <div class="col-lg-12"><a id="btn-analyse-vlg" class="btn btn-primary btn-sm d-none">Analyser</a></div>
                    </div>
                </div>`

        $("#dom-analyse").html(dom)
        $("#dom-analyse-ModalLabel").html(`${nom.toUpperCase()}`)
        $("#dom-analyse-Modal").modal('show')

        $(document).on("click", "#btn-analyse-vlg", function () {
            //traitement_village()
            result = ``
            if (etab_proximite.length > 0) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais le village n’est pas éligible pour la création d’une nouvelle école. Il existe déjà une école à proximité qui est à moins de 2 km. Nous vous encourageons à utiliser les ressources de cette école existante.</div>`
                $("#result").html(result)
                return
            }
            pop = 0
            $('.population').each(function () {
                pop += ($(this).val() == "") ? 0 : parseInt($(this).val())
            })
            if (pop < 300) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais le village n’est pas éligible pour la création d’une nouvelle école car la population scolarisable est très faible.</div>`
                $("#result").html(result)
            } else {
                result += `<div class="alert alert-success">Félicitations! Le village est éligible pour la création d’une nouvelle école car tous les critères nécessaires sont remplis.</div>`
                $("#result").html(result)
            }
        })
        $("#btn-analyse-vlg").click()
    }
    initMap()



}) // readyfunction
