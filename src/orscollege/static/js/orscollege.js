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
    window['layer_villages'] = new L.layerGroup()
    window['layer_nc'] = new L.layerGroup()
    window['layer_etabN1S0'] = new L.layerGroup()
    window['layer_etabN1S0'].options.name = 'layer_etabN1S0'
    window['layer_etabN1S0'].options.id = 'N1S0'

    window['layer_etabN2S0'] = new L.layerGroup()
    window['layer_etabN2S0'].options.name = 'layer_etabN2S0'
    window['layer_etabN2S0'].options.id = 'N2S0'

    var tempPositionMarker = null




    //map et les shapes administratives
    window['map'] = null
    window['shp_dren'] = null
    window['shp_cisco'] = null
    window['shp_commune'] = null
    window['shp_fokontany'] = null

    var listeSearch = [] // pour liste des  recherche ecoles

    //pour l'analyse d'eligibilité
    var liste_epp = []
    var liste_epp_exclus = []
    var liste_ceg = []
    var markerLines_ceg = L.layerGroup() // Global Layer
    var markerLines_epp = L.layerGroup() // Global Layer

    var markerGroup_buffer_ceg = L.layerGroup() // Global Layer
    var markerGroup_ceg_proximite = L.layerGroup() // Global Layer
    var temp_buffer_ceg = null
    var temp_buffer_epp = null
    var temp_buffer_real = null

    //les styles
    const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 4, opacity: 1, fillOpacity: 0.03 }
    const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 3, opacity: 0.9, fillOpacity: 0.03 }
    const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 0.8, fillOpacity: 0.03 }
    const STYLE_FOKONTANY = { fillColor: '#55ff00', color: '#55ff00', weight: 0.6, opacity: 0.5, fillOpacity: 0.03 }
    const STYLE_NC = { fillColor: 'red', color: 'black', weight: 1, opacity: 1, fillOpacity: 0.3 }


    //changement DREN
    $(document).on("change", "#dren", async function () {
        code_dren = parseInt($(this).val())
        if (code_dren === 0) { return }
        await getBaseLayer()
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }
        clearEtabLayers()
        removeOverLayer()

        url = `listeCisco/${code_dren}`
        $("#cisco").html(`<option value="0">-Toutes-</option>`)
        $.ajax({
            url: url,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
            success: async function (data) {
                if (data.length) {
                    for (let c of data) {
                        selected = c.CODE_CISCO == USER_CISCO ? "selected" : ""
                        if (USER_CISCO == 0 || USER_CISCO == c.CODE_CISCO) {
                            $("#cisco").append(`<option value="${c.CODE_CISCO}" ${selected}>${c.CISCO}</option>`)
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

        $("#btn-download").addClass("d-none hidden")

    }) // change DREN

    //changement CISCO
    $(document).on("change", "#cisco", async function () {
        code_cisco = parseInt($("#cisco").val())
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }
        clearEtabLayers()
        removeOverLayer()
        await getBaseLayer()

        $("#btn-download").addClass("d-none hidden")

    }) // change CISCO

    const getBaseLayer = async () => {
        code_dren = parseInt($("#dren").val())
        code_cisco = parseInt($("#cisco").val())
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
        });

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
                        layer.on({
                            contextmenu: (e) => {
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        {
                                            label: `Télécharger les Données `, onClick: () => {
                                                window.open(`downloadOrsN2/${code_dren}/${code_cisco}`)
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
        getBaseLayer()
        utils.waitmeShow('div-map', 'win8')
        $("#div-map").html(`<div id="map" style="height: 100vh;"></div>`)
        const opts = { zoomDelta: 0.5, zoomSnap: 0.5, fullscreenControl: true, fullscreenControlOptions: { title: "Mode Plein ecran!", titleCancel: "Quitter mode plein ecran" } }
        map = L.map('map', opts).setView([-18.9189596, 47.5135653], 6) //map
        map.scrollWheelZoom.disable()
        L.control.scale().addTo(map)
        var DEFAULT_LAYER = L.tileLayer('', { maxZoom: 24, attribution: '© MEN/DPE' }).addTo(map)
        var OSM_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, attribution: '© OpenStreetMap' })
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
            image_name = (code_cisco == 0) ? `ORS_COLLEGE_DREN_${code_dren}.png` : `ORS_COLLEGE_CISCO_${code_cisco}.png`
            utils.captureScreen(image_name)
            //utils.captureScreenDom(image_name, 'div-map')
       
        }, 'Imprimer', 'print').addTo(map)

        var legend = L.control({ position: 'bottomright' })
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend')
            div.innerHTML += '<p style="font-size: 16px;"><strong><u>Légende</u><strong></p>'
            div.innerHTML += '&nbsp;<i class="fas fa-school text-danger"></i>&nbsp;COLLEGES</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-square" style="color:#36b9cc"></i>&nbsp;PRIMAIRE PUBLICS</br>' //#36b9cc' : '#ffffcc'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-square" style="color:#ffffcc"></i>&nbsp;PRIMAIRE PRIVES</br>' //#36b9cc' : '#ffffcc'            
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#e74a3b"></i>&nbsp;ELIGIBLE</br>' //rouge
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#1cc88a"></i>&nbsp;NON ELIGIBLE</br>' // vert
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#c0c0c0"></i>&nbsp;Limite Commune</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#55ff00"></i>&nbsp;Limite Fokontany</br>'
            L.DomEvent.disableClickPropagation(div)
            return div
        }
        legend.addTo(map)

        map.on('zoomend', function () {
            var currentZoom = map.getZoom()
            if (currentZoom <= 10) {
                $(".label-etab").css("font-size", "0px")
                $(".label-village").css("font-size", "0px")
            }
            if (currentZoom > 11 && currentZoom <= 14) {
                $(".label-etab").css("font-size", "6px")
                $(".label-village").css("font-size", "6px")
            }
            if (currentZoom > 14 && currentZoom <= 16) {
                $(".label-etab").css("font-size", "8px")
                $(".label-village").css("font-size", "8px")
            }
            if (currentZoom > 16) {
                $(".label-etab").css("font-size", "13px")
                $(".label-village").css("font-size", "13px")
            }
        })

        map.on('baselayerchange', function (eventLayer) {
            var currentZoom = map.getZoom()
            if (eventLayer.name === 'DEFAULT' || eventLayer.name === 'OSM') {
                if (currentZoom > 12) { $(".label-etab").css('color', 'black') }
                if (currentZoom > 12) { $(".label-village").css('color', 'black') }
            } else {
                if (currentZoom > 12) { $(".label-etab").css('color', 'white') }
                if (currentZoom > 12) { $(".label-village").css('color', 'white') }
            }
        })

        window['layerControl'] = L.control.layers(BASE_LAYER, {}, { position: 'topright', collapsed: false })
        window['layerControl'].addTo(map)

        utils.waitmeClose('div-map')

    } //iniMap


    initMap()

    //event sur click bouton filtrer
    $(document).on("click", "#btn-filter", async function () {
        RADIUS = $("#radius").val()
        $("#search").html(``)
        //selection ecole ou village sur champ de recherche pour aller se positionner vers la selection
        $(document).on("change", "#search", function () {
            var coords = $(this).val().trim().split(",")
            latitude = parseFloat(coords[0])
            longitude = parseFloat(coords[1])
            map.flyTo([latitude, longitude], 12)
            if (tempPositionMarker) { tempPositionMarker.remove() }
            tempPositionMarker = L.circle([latitude, longitude], {
                radius: 500, //metres
                color: 'yellow',
                fillColor: 'red',
                fillOpacity: 0.5
            })
            tempPositionMarker.bindPopup($(this).text()).openPopup()
            tempPositionMarker.addTo(map)
            // Esorina automatique apres 10 seconde ilay marker de recherche
            setTimeout(() => {
                tempPositionMarker.remove()
                tempPositionMarker = null
            }, 10000)
        })

        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())

        if (CODE_DREN === 0 || (CODE_CISCO == 0 && USER_CISCO > 0)) {
            utils.waitmeClose('div-map')
            utils.showModal("Attention", "Veuillez choisir la DREN et/ou la CISCO pour poursuivre l'opération!", "danger")
            return
        }

        utils.waitmeShow('div-map','win-8')
        clearBaseLayers()
        clearEtabLayers()
        removeOverLayer()
        clearAnalyseLayers()
        await getBaseLayer()
        await getCTDLayer()
        //******************************************RECUPERATIOn DES LAYERS ETABLISSEMENTS PAR NIVEAU  ********************** */
        await downloadLayerEtab()

        $(".btn-download").removeClass("d-none")

        utils.waitmeClose('div-map')



    })

    const downloadLayerEtab = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        RADIUS = $("#radius").val()

        $("#btn-download").attr("href", `downloadOrsN2/${CODE_DREN}/${CODE_CISCO}`)
        url_bn2 = `layerBesoinsN2/${CODE_DREN}/${CODE_CISCO}`
        url_n1 = `layerEtabN1/${CODE_DREN}/${CODE_CISCO}`
        //on enchaine les appels de creation layers pour avoir l'ordre par niveau
        await utils.fetchData(url_bn2, 'GET', {}, async function (data) {
            await createLayerCollege(data)
            await window['layerControl'].addOverlay(window['layer_etabN2S0'], "COLLEGES EXISTANTS")

            //rehefa azo ny besoin avec layer college dia alaina ny epp existant
            await utils.fetchData(url_n1, 'GET', {}, async function (data) {
                await data.forEach(async (etab) => {
                    //console.log(etab)

                    iconPub = parseInt(etab.SECTEUR) == 0 ? '#36b9cc' : '#ffffcc' // Publique Vs Privée
                    starIcon = L.divIcon({
                        className: 'custom-icon',
                        html: `<span style="color:${iconPub}"><i class="fa fa-solid fa-square"></i></span><span class="label-etab">${etab.NOM_ETAB}</span>`
                    })
                    properties = {
                        "CODE_ETAB" : etab.CODE_ETAB,
                        "NOM_ETAB": etab.NOM_ETAB,
                        "eff_t5": etab.eff_t5,
                    }
                    if (!isNaN(parseFloat(etab.latitude)) && !isNaN(parseFloat(etab.longitude))) {

                        latLng = [parseFloat(etab.latitude), parseFloat(etab.longitude)]

                        //listeSearch.push({ latLng: latLng, id: etab.CODE_ETAB, name: etab.NOM_ETAB })
                        $("#search").append(`<option value='${latLng}'>${etab.NOM_ETAB}</option>`)

                        marker_epp = L.marker(latLng, {
                            properties: properties,
                            contextmenu: CODE_CISCO == USER_CISCO || (USER_CISCO == 0 && USER_DREN == 0),
                            icon: starIcon
                        })
                        popup = `<div class="custom-tooltip">${etab.NOM_ETAB}<hr/><p>Effectif T5 : ${etab.eff_t5}</p><p>Effectif Total: ${parseInt(etab.eff_2024)}</p></div>`
                        marker_epp.bindTooltip(etab.NOM_ETAB)
                        marker_epp.bindPopup(popup)
                        //raha public dia azo anaovana analyse
                        if (parseInt(etab.SECTEUR) == 0) {
                            marker_epp.on({
                                contextmenu: (e) => {
                                    new Contextual({
                                        isSticky: false,
                                        items: [
                                            { label: 'Aire', onClick: () => { show_satellite_ceg(e.target) } },
                                            { type: 'seperator' },
                                            { label: 'Analyse Eligibilité', onClick: () => { analyseEPP(e.target) } },
                                        ]
                                    })
                                }
                            })
                        }


                        // obtenir toutes les epp à plus 5km des ceg existants
                        isExclus = true
                        liste_ceg.forEach(async (ceg) => {
                            d = marker_epp.getLatLng().distanceTo([ceg.latitude, ceg.longitude])
                            if (d <= RADIUS) {
                                isExclus = false
                                return
                            }
                        })
                        if (isExclus) { liste_epp_exclus.push(etab) }
                        liste_epp.push(etab)
                        window[`layer_etabN1S0`].addLayer(marker_epp)
                    }
                })

                await window['layerControl'].addOverlay(window['layer_etabN1S0'], "ECOLE PRIMAIRE")
                //traitement des nouvelles creation colleges pour les epp
                await getLayerNcN2()

                $(".label-etab").css("font-size", "5px")
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
                    etabLayer = window[`layer_etabN2S0`]
                    if ($(this).prop("checked") && map.hasLayer(etabLayer)) { // cochage sady misy layer etab
                        updateStyleLayerEtab(id)
                    } else if (!$(this).prop("checked") && map.hasLayer(etabLayer)) { // decochage sady layer etab

                    } else if ($(this).prop("checked") && !map.hasLayer(etabLayer)) { //coché fa tsisy layer etab
                        utils.showModal("Attention!", " Veuillez afficher la couche établissement", "danger")
                        $(this).prop("checked", false)
                    }
                })

                /**preparation controls */
            })

        })
        //recherche
        //listeE = utils.toUniqueListe(listeSearch, 'id')

        
        $('#search').select2({
            language: "fr",
            placeholder: 'Rehercher',
            allowClear: true
        })
        
    } // end of downloadLayerEtab

    const updateStyleLayerEtab = async (id) => {
        var tooltip = ''
        window['layer_etabN2S0'].eachLayer(function (layer) {
            if (layer instanceof L.Marker) {
                return
            }
            var properties = layer.feature ? layer.feature.properties : {}
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
            layer.setStyle({
                fillColor: text_cls,
                color: text_cls
            })

            layer.bindPopup(tooltip)

            // Mettez à jour l'icône si nécessaire
            if (layer._icon) {
                layer._icon.style.fillColor = text_cls;
            }
        })
    }

    //transformer les donnees etab en Layer avec son class, icon fa, son id et son label sur la carte
    //Obtenir layer etablissements avec les Besoins
    const createLayerCollege = async (data) => {
        /* exemple data :
        {"NOM_ETAB": "ECOLE COMMUNAUTAIRE AMBATOHARANANA", "ANNEE_SCOLAIRE": 2024, "CODE_DREN": 11, "CODE_CISCO": 105, 
          "CODE_ETAB": 105010002, "effectifs": 40, "gp_sections": 1.0, "sdc_be": 3, "sdc_me": 0,  
          "eligible_reconstruction": 0, "eligible_rehabilitation": 0, "sdc_requis": 1.0, "places": 76,
           "latitude": -18.47394597,"longitude": 47.46306854
        }
         */
        RADIUS = $("#radius").val()
        liste_ceg = []
        data.forEach(etab => {
            liste_ceg.push(etab)
            starIcon = L.divIcon({
                className: 'custom-icon',
                html: `<i class="fas fa-circle text-info"></i><span class="label-etab">${etab.NOM_ETAB}</span>`
            })
            properties = {
                "NOM_ETAB": `${etab.NOM_ETAB}`, "CODE_DREN": `${etab.CODE_DREN}`, "CODE_CISCO": `${etab.CODE_CISCO}`,
                "CODE_ETAB": `${etab.CODE_ETAB}`, "effectifs": `${parseInt(etab.effectifs)}`, "sdc_be": `${parseInt(etab.sdc_be)}`, "sdc_me": `${parseInt(etab.sdc_me)}`,
                "eligible_reconstruction": `${parseInt(etab.eligible_reconstruction)}`, "eligible_rehabilitation": `${parseInt(etab.eligible_rehabilitation)}`, "sdc_requis": `${parseInt(etab.sdc_requis)}`,
                "extensions": `${Math.max(parseInt(etab.sdc_requis) - (parseInt(etab.sdc_be) + parseInt(etab.sdc_me)), 0)}`, "places": `${parseInt(etab.places)}`,
            }
            if (!isNaN(parseFloat(etab.latitude)) && !isNaN(parseFloat(etab.longitude))) {
                latLng = [parseFloat(etab.latitude), parseFloat(etab.longitude)]
                //aire_ceg = L.marker(latLng, { icon: starIcon })
                popup = `<div class="custom-tooltip">${etab.NOM_ETAB}<br/>Effectif Total Actuel : ${parseInt(etab.effectifs)}</div>`
                aire_ceg = L.circle(latLng, {
                    //properties: properties,
                    radius: RADIUS, //metres
                    color: 'green',
                    fillColor: 'green',
                    fillOpacity: 0.3,
                    weight: 1
                })
                aire_ceg.on('mouseover', (e) => { e.target.setStyle({ weight: 2, color: "yellow", fillOpacity: 0.5 }) })
                aire_ceg.on('mouseout', (e) => { e.target.setStyle({ weight: 1, color: 'green', fillOpacity: 0.3 }) })
                aire_ceg.bindTooltip(etab.NOM_ETAB)
                aire_ceg.bindPopup(popup)
                aire_ceg.feature = {};
                aire_ceg.feature.properties = properties
                window[`layer_etabN2S0`].addLayer(aire_ceg)

                //*** ajout des markers au centre de l'aire */
                starIcon = L.divIcon({
                    className: 'custom-icon',
                    html: `<span style="color:#ff5555"><i class="fas fa-school text-danger"></i></span><span class="label-etab">${etab.NOM_ETAB}</span>`
                })
                marker_ceg = L.marker(latLng, { icon: starIcon })
                marker_ceg.bindTooltip(etab.NOM_ETAB)
                marker_ceg.bindPopup(popup)
                window[`layer_etabN2S0`].addLayer(marker_ceg)
            }
        })
        //console.log('liste etabs', liste_ceg)

    } //creation Layer des etabs


    // alaina ny college publiques existantes anaovana traitement nouvelle creation
    const getLayerNcN2 = async () => {
        //console.log("NC")
        var liste_nc = []
        liste_epp_exclus.forEach(async (ex) => {
            p1 = turf.point([parseFloat(ex.longitude), parseFloat(ex.latitude)])
            nbr_sat = 1
            coords_sat = []
            epp_sat = [`${ex.NOM_ETAB}:${ex.eff_t5}`]
            epp_sat_code = []
            total_eff_t5 = parseInt(ex.eff_t5)
            liste_epp_exclus.forEach(async (ex2) => {
                if (ex.CODE_ETAB != ex2.CODE_ETAB) {
                    p2 = turf.point([parseFloat(ex2.longitude), parseFloat(ex2.latitude)])
                    dist = turf.distance(p1, p2, turf_units)
                    if (dist <= 4.8) {
                        nbr_sat = + 1
                        total_eff_t5 += parseInt(ex2.eff_t5)
                        coords_sat.push([parseFloat(ex2.latitude), parseFloat(ex2.longitude)])
                        epp_sat.push(`${ex2.NOM_ETAB}:${ex2.eff_t5}`)
                        epp_sat_code.push(ex2.CODE_ETAB)
                    }
                }

            })
            // izay manana eff total >100 no eligible 
            if (total_eff_t5 >= 100) {
                liste_nc.push({
                    latitude: parseFloat(ex.latitude),
                    longitude: parseFloat(ex.longitude),
                    name: ex.NOM_ETAB,
                    code: ex.CODE_ETAB,
                    nbr_sat: nbr_sat,
                    total_eff_t5: total_eff_t5,
                    coords_sat: coords_sat,
                    epp_sat: epp_sat,
                    epp_sat_code: epp_sat_code
                })
            }
        })
        liste_nc = liste_nc.sort((a, b) => b.total_eff_t5 - a.total_eff_t5)

        //console.log(liste_nc)
        for (var i = 0; i < liste_nc.length; i++) {
            nc = liste_nc[i]
            marker = L.circle([nc.latitude, nc.longitude], {
                radius: RADIUS,
                color: "yellow",
                fillColor: "blue",
                opacity: 0.2,
                weight: 2
            })
            popup = `<div class="custom-tooltip">
                            <table class="table table-bordered table-condensed dataTable"  width = "100%" cellpadding='2' style = "width: 100%;" >
                                <thead>
                                    <tr role="row" align="center" style="background:#aaa;color;#fff">
                                        <th colspan="2" align="center" class="p-2">${nc.name} Effectifs Total Prevu : ${nc.total_eff_t5}</th>
                                    </tr>
                                    <tr role="row" align="center" style="background:#aaa;color;#fff">
                                        <th  align="center" >ECOLE A PROXIMITE(S)</th>
                                        <th  align="center" ">EFFECTIF T5 ACTUEL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                `
            nc.epp_sat.forEach(s => {
                st = s.split(":")
                popup += `<tr><td width="85%" style="background:#f1f1f1">${st[0]}</td><td align="right">${st[1]}</td></tr>`
            })
            popup += `
                                </tbody>
                            </table>
                        </div>`
            marker.bindPopup(popup, {
                permanent: false,
                opacity: 1,
                className: 'custom-tooltip',
                direction: 'top',
                offset: [10, -20]
            })
            marker.on('mouseover', (e) => { e.target.setStyle({ weight: 4, fillOpacity: 0.5 }) })
            marker.on('mouseout', (e) => { e.target.setStyle({ weight: 2, fillOpacity: 0.2 }) })

            starIcon = L.divIcon({
                className: 'custom-icon',
                html: `<span class="fa fa-2x" style="color:yellow">•</span>`
            })

            // on ajoute le 1er marker de la liste
            if (i == 0) {
                window['layer_nc'].addLayer(marker)
                nc.coords_sat.forEach(coords => {
                    window['layer_nc'].addLayer(L.polyline([marker.getLatLng(), coords], { opacity: 0.2, color: 'red' })) // line reliants les centres et les epp satellites
                    mrkrPt = L.marker(coords, { icon: starIcon })
                    window['layer_nc'].addLayer(mrkrPt)

                })
            }// on ajoute les lignes du 1er marker de la liste
            var inListe = false // on suppose que le code du nouvelle creation en cours n'est pas dans les satellites precedent
            for (var j = 0; j < i; j++) {
                p_nc = liste_nc[j]
                if (p_nc.epp_sat_code.includes(nc.code)) {
                    inListe = true
                }
            }
            if (!inListe) { //on ajoute dans le groupe si le code n'est pas inclus dans aucun aire 
                window['layer_nc'].addLayer(marker)
                nc.coords_sat.forEach(coords => {
                    window['layer_nc'].addLayer(L.polyline([marker.getLatLng(), coords], { opacity: 0.2, color: 'red' }))
                    mrkrPt = L.marker(coords, { icon: starIcon })
                    window['layer_nc'].addLayer(mrkrPt)// on ajoute les lignes du 1er marker de la liste
                })
            }

        }

        await window['layerControl'].addOverlay(window['layer_nc'], "NOUVELLE CREATION")


    } // end get layer NC




    const getLayerVillages = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        if (window['layer_villages']) { window['layer_villages'].clearLayers(); window['layer_villages'].remove() }
        url = `layerVillages/${code_dren}/${code_cisco}`
        await utils.fetchData(url, 'GET', {}, async function (data) {
            data.forEach(v => {
                nom = v.name
                starIcon = L.divIcon({
                    className: 'custom-icon',
                    iconSize: [20, 20],
                    html: `<i class= "fa fa-solid fa-caret-up text-danger"></i><span class="label-village" style="font-size:5px;position: absolute;top: 10px;">${nom}</span>`
                })
                latlng = [parseFloat(v.latitude), parseFloat(v.longitude)]
                marker = L.marker(latlng, { properties: { nom }, icon: starIcon })
                marker.bindTooltip(`<b>${nom}</b>`, {
                    permanent: false,
                    opacity: 1,
                    className: 'custom-tooltip',
                    direction: 'bottom', // La direction du tooltip (top, bottom, left, right, auto) 
                    offset: [10, -20] // Décalage du tooltip par rapport au marqueur
                })
                if ((v.code_dren == CODE_DREN && CODE_CISCO == 0) || (v.code_cisco == CODE_CISCO && CODE_CISCO > 0)) {
                    window['layer_villages'].addLayer(marker)
                }

            })
            if (window[`layer_villages`]) { window['layerControl'].removeLayer(window[`layer_villages`]) }
            await window['layerControl'].addOverlay(window['layer_villages'], "VILLAGES")

        })
    } // end getVillages Exclus

    const clearEtabLayers = () => {
        if (window[`layer_etabN1S0`]) { window[`layer_etabN1S0`].clearLayers(); }
        if (window[`layer_etabN2S0`]) { window[`layer_etabN2S0`].clearLayers(); }
        if (window[`layer_nc`]) { window[`layer_nc`].clearLayers(); }
        if (window['layer_villages']) { window['layer_villages'].remove() }


    }
    const removeOverLayer = () => {
        window['layerControl'].removeLayer(window[`layer_etabN1S0`])
        window['layerControl'].removeLayer(window[`layer_etabN2S0`])
        window['layerControl'].removeLayer(window[`layer_nc`])
        window['layerControl'].removeLayer(window[`layer_villages`])
    }

    const clearAnalyseLayers = () => {
        markerLines_ceg.clearLayers()
        markerLines_epp.clearLayers()
        if (markerLines_ceg) { markerLines_ceg.remove() }
        if (temp_buffer_ceg) { temp_buffer_ceg.remove() }
        if (temp_buffer_epp) { temp_buffer_epp.remove() }
        if (temp_buffer_real) { temp_buffer_real.remove() }
        if (markerLines_epp) { markerLines_epp.remove() }
        if (markerLines_epp) { markerLines_epp.remove() }
        if (markerGroup_buffer_ceg) { markerGroup_buffer_ceg.remove() }
        if (markerGroup_ceg_proximite) { markerGroup_ceg_proximite.remove() }
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


    //Telechargement des aires collèges avec ses ecoles satéllites
    $(document).on("click", "#btn-download-aire", async function () {
        RADIUS = $("#radius").val()
        liste = []
        utils.waitmeShow("div-map", "win8")
        //parcour des EPP
        await window[`layer_etabN1S0`].eachLayer((epp) => { 
            airesCEG = []
            window[`layer_etabN2S0`].eachLayer((layer) => { 
                d = layer.getLatLng().distanceTo(epp.getLatLng())
                if (layer.feature && epp.options) {
                    airesCEG.push(
                        {
                            CODE_CEG: layer.feature.properties.CODE_ETAB,
                            NOM_CEG: layer.feature.properties.NOM_ETAB,
                            DISTANCE : parseFloat(d)
                        }
                    )
                }
            })
            //alaina izay CEG le plus proche an'ilay Ecole Primaire
            const minDistanceCEG = airesCEG.sort((a, b) => a.DISTANCE - b.DISTANCE)[0];
            //console.log(airesCEG,minDistanceCEG)
            liste.push({
                CODE_CEG: minDistanceCEG.CODE_CEG,
                NOM_CEG: minDistanceCEG.NOM_CEG,
                CODE_ECOLE: epp.options.properties.CODE_ETAB,
                NOM_ECOLE: epp.options.properties.NOM_ETAB,
                EFFECTIF_T5: epp.options.properties.eff_t5,
                DISTANCE_EN_KM: (minDistanceCEG.DISTANCE / 1000).toFixed(1),
                INCLUS_DANS_AIRE : (minDistanceCEG.DISTANCE <= RADIUS) ? "OUI":"NON"
            })
        })
            //preparation fichier en csv telecgargeable
        //on elimine d'abord les doublons CODE_LYCEE_CODE_CEG
        listeU = []
		const seenIds = new Set()
        listeU = liste.filter(obj => {
            keys = `${obj["CODE_CEG"]}_${obj["CODE_ECOLE"]}`
			if (seenIds.has(keys)){
				return false
			} else {
				seenIds.add(keys)
				return true
			}
        })
        //console.log(listeU)
        csvContent = utils.convertObjectToCSV(listeU.sort((a, b) => a.CODE_CEG - b.CODE_CEG))
        await utils.downloadCSV(csvContent,"COLLEGE_AVEC_ECOLE_SATELLITES.csv")
        utils.waitmeClose("div-map")
    })
        
    const show_satellite_ceg = async (epp) => {
        RADIUS = $("#radius").val()

        map.flyTo(epp.getLatLng(), 12)
        name = epp.options.properties.name
        epp_satellites = []
        markerLines_epp.clearLayers()
        if (markerLines_epp) { markerLines_epp.remove() }
        if (temp_buffer_epp) { temp_buffer_epp.remove() }
        //console.log(liste_epp_exclus.length)
        //console.log(liste_epp.length)
        liste_epp_exclus.forEach(ex => {
            d = epp.getLatLng().distanceTo([ex.latitude, ex.longitude])
            mV = L.marker([ex.latitude, ex.longitude], { name: ex.name, distance: d })
            if (d <= RADIUS) {
                epp_satellites.push(mV)
                markerLines_epp.addLayer(L.polyline([epp.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })
        liste_ceg.forEach(ceg => {
            d = epp.getLatLng().distanceTo([ceg.latitude, ceg.longitude])
            mE = L.marker([ceg.latitude, ceg.longitude], { name: ceg.NOM_ETAB, distance: d })
            if (d <= RADIUS) {
                markerLines_epp.addLayer(L.polyline([epp.getLatLng(), mE.getLatLng()], { color: 'red' }))
            }
        })
        temp_buffer_epp = L.circle(epp.getLatLng(), {
            radius: RADIUS,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)
        markerLines_epp.addTo(map)
    }

    //analyse d'éligibilité d'une epp
    const analyseEPP = async (epp) => {
        RADIUS = $("#radius").val()

        if (!map.hasLayer(window['layer_etabN2S0'])) {
            window['layer_etabN2S0'].addTo(map)
        }
        map.flyTo(epp.getLatLng(), 12)
        nom = epp.options.properties.NOM_ETAB

        epp_satellites = []
        ceg_proximite = []
        markerLines_epp.clearLayers()

        if (markerLines_epp) { markerLines_epp.remove() }
        if (temp_buffer_epp) { temp_buffer_epp.remove() }
        if (markerGroup_buffer_ceg) { markerGroup_buffer_ceg.remove() }
        if (markerGroup_ceg_proximite) { markerGroup_ceg_proximite.remove() }

        liste_epp_exclus.forEach(async (ex) => {
            d = epp.getLatLng().distanceTo([ex.latitude, ex.longitude])
            //izay EPP moins de 5km amin'ireo EPP ivelan'ny aire ceg existant ihany no alaina
            if (d <= RADIUS) {
                mV = L.marker([ex.latitude, ex.longitude], { name: ex.NOM_ETAB, eff_t5: ex.eff_t5, distance: d })
                epp_satellites.push(mV)
                markerLines_epp.addLayer(L.polyline([epp.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })

        dp = 48000 //distance etablissement le plus proche du village
        ceg_pp = "" // CEG la plus proche
        c_p = [] // coords etab plus proche

        markerGroup_buffer_ceg.clearLayers()
        markerGroup_ceg_proximite.clearLayers()
        liste_ceg.forEach(ceg => {
            coords_etab = [ceg.latitude, ceg.longitude]
            d = epp.getLatLng().distanceTo(coords_etab)

            if (d <= dp) {
                ceg_pp = ceg.NOM_ETAB
                dp = d
                c_p = [ceg.latitude, ceg.longitude]
            }
            if (d <= RADIUS) {
                bf_e = L.circle([ceg.latitude, ceg.longitude], {
                    properties: { name: ceg.NOM_ETAB, distance: d },
                    radius: RADIUS,
                    color: 'red',
                    fillOpacity: 0.6
                })
                ceg_proximite.push(bf_e)
                markerGroup_buffer_ceg.addLayer(bf_e)
                markerLines_epp.addLayer(L.polyline([epp.getLatLng(), coords_etab], { color: 'red' }))
            }
        })

        //lokoina mena ny circonférence an izay ceg plus proche
        markerGroup_ceg_proximite.addLayer(
            L.circle(c_p, {
                properties: { name: ceg_pp, distance: dp },
                radius: RADIUS,
                color: 'red',
                fillOpacity: 0.3
            })
        )

        markerLines_epp.addTo(map)
        markerGroup_buffer_ceg.addTo(map)
        markerGroup_ceg_proximite.addTo(map)
        //tampon de l' epp en cours d'analyse
        temp_buffer_epp = L.circle(epp.getLatLng(), {
            radius: RADIUS,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)

        setTimeout(() => {
            temp_buffer_epp.remove()
            temp_buffer_epp = null
            markerLines_epp.remove()
        }, 15000)
        dom = ` <div class="panel panel-info" style="padding: 5px;">
                    <div class="panel-heading"></div>
                    <div class="panel-body">
                        <div class='row'>
                            <dl>
                                <dt>Collège le plus proche:</dt>
                                <dd> ${ceg_pp}: à ${(dp / 1000).toFixed(1)} km</dd>
                            </dl>
                        </div>
                        <div class='row'>
                            <dl>
                                <dt>COLLEGE(S) PUBLIC(S) à moins de 5km (0${ceg_proximite.length})</dt>
                        `
        for (let i = 0; i < ceg_proximite.length; i++) {
            dom += `<dd> ${ceg_proximite[i].options.properties.NOM_ETAB} : à ${(ceg_proximite[i].options.properties.distance / 1000).toFixed(1)}km</dd>`
        }
        dom += `    </dl>
                        </div>
                        <div class='row'>
                            <div class='col-lg-12 text-center' style="background:#aaa">EPP A PROXIMITE (MOINS DE 5km) </div>
                        </div>
                        <div class='row'>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped" id='tableVD'>
                                    <thead>
                                        <tr style='background:#ddd'>
                                            <th>NOM ECOLE</th>
                                            <th>DISTANCE</th>
                                            <th>EFFECTIFS T5</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `
        for (let i = 0; i < epp_satellites.length; i++) {
            //console.log(epp_satellites[i])
            dom += `<tr>`
            dom += `<td> ${epp_satellites[i].options.name}</td>`
            dom += `<td> 0${(epp_satellites[i].options.distance / 1000).toFixed(1)} km</td>`
            dom += `<td> <input type="number" value="${parseInt(epp_satellites[i].options.eff_t5)}" readonly class="form-control eff_t5"  /></td>`
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
                        <div class="col-lg-12"><a id="btn-analyse" class="btn btn-primary btn-sm d-none">Analyser</a></div>
                    </div>
                </div>`

        $("#dom-analyse").html(dom)
        $("#dom-analyse-ModalLabel").html(`${nom.toUpperCase()}`)
        $("#dom-analyse-Modal").modal('show')

        $(document).on("click", "#btn-analyse", function () {
            //traitement_village()
            result = ``
            if (ceg_proximite.length > 0) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais l'ecole n’est pas éligible pour la mise en place d’un nouveau collège. Il existe déjà un collège à proximité qui est à moins de 5 km. Nous vous encourageons à utiliser les ressources de cette école existante.</div>`
                $("#result").html(result)
                return
            }
            effT = 0
            $('.eff_t5').each(function () {
                effT += ($(this).val() == "") ? 0 : parseInt($(this).val())
            })
            if (effT < 100) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais l'ecole n’est pas éligible pour la mise en place d’un nouveau collège car l'effectif total des T5 scolarisable est très faible.</div>`
                $("#result").html(result)
            } else {
                result += `<div class="alert alert-success">L'ecole est éligible pour la mise en place d’un nouveau collège car tous les critères nécessaires sont remplis.</div>`
                $("#result").html(result)
            }
        })
        $("#btn-analyse").click()
    }




}) // readyfunction
