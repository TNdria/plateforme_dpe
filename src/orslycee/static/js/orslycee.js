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
    var OVER_LAYERS = {}
    var CTRL_AIRE = null
    window['layer_villages'] = new L.layerGroup()
    window['layer_nc'] = new L.layerGroup()
    window['layer_etabN2S0'] = new L.layerGroup()
    window['layer_etabN2S0'].options.name = 'layer_etabN2S0'
    window['layer_etabN2S0'].options.id = 'N2S0'
    window['layer_etabN2S1'] = new L.layerGroup()

    window['layer_etabN3S0'] = new L.layerGroup()
    window['layer_etabN3S0'].options.name = 'layer_etabN3S0'
    window['layer_etabN3S0'].options.id = 'N3S0'

    var tempPositionMarker = null
    var listeSearch = []


    //map et les shapes administratives
    window['map'] = null
    window['shp_dren'] = null
    window['shp_cisco'] = null
    window['shp_commune'] = null
    window['shp_fokontany'] = null

    //pour l'analyse d'eligibilité
    var liste_villages = []
    var liste_etabs = []
    var markerLines_etab = L.layerGroup() // Global Layer
    var markerLines_COLLEGES = L.layerGroup() // Global Layer

    var markerGroup_buffer_etab = L.layerGroup() // Global Layer
    var markerGroup_COLLEGES_proximite = L.layerGroup() // Global Layer
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
                        $("#cisco").append(`<option value="${c.CODE_CISCO}">${c.CISCO}</option>`)
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
            image_name = (code_cisco == 0) ? `ORS_LYCEE_DREN_${code_dren}.png` : `ORS_LYCEE_CISCO_${code_cisco}.png`
            utils.captureScreen(image_name)
        }, 'Imprimer', 'print').addTo(map)

        var legend = L.control({ position: 'bottomright' })
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend')
            div.innerHTML += '<p style="font-size: 16px;"><strong><u>Légende</u><strong></p>'
            div.innerHTML += '&nbsp;<i class="fas fa-school text-danger"></i>&nbsp;LYCEES</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-square" style="color:#36b9cc"></i>&nbsp;COLLEGES PUBLICS</br>' //#36b9cc' : '#ffffcc'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-square" style="color:#ffffcc"></i>&nbsp;COLLEGES PRIVES</br>' //#36b9cc' : '#ffffcc'
            div.innerHTML += '&nbsp;<i class="fa fa-solid fa-caret-up text-danger"></i>&nbsp;villages</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#e74a3b"></i>&nbsp;ELIGIBLE </br>' //rouge
            div.innerHTML += '&nbsp;<i class="fa fa-circle" style="color:#1cc88a"></i>&nbsp;NON ELIGIBLE</br>' // vert
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO</br>'
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

    $(document).on("click", "#btn-filter", async function () {
        $("#search").html(``)
        $('#search').select2({
            language: "fr",
            placeholder: 'Rehercher Collège',
            allowClear: true
        })
        $(".btn-download").addClass("d-none")

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

        if (CODE_DREN === 0) {
            utils.waitmeClose('div-map')
            utils.showModal("Attention", "Veuillez choisir la DREN et/ou la CISCO pour poursuivre l'opération!", "danger")
            return
        }

        await utils.waitmeShow('div-map', 'win-8')
        
        clearBaseLayers()
        clearEtabLayers()
        removeOverLayer()
        clearAnalyseLayers()
        await getBaseLayer()
        await getCTDLayer()
        //******************************************RECUPERATIOn DES LAYERS ETABLISSEMENTS PAR NIVEAU  ********************** */
        await downloadLayerEtab()
        //await getLayerNc()
        await getLayerVillages()

        await utils.waitmeClose('div-map')


    })

    const downloadLayerEtab = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        //lien telechargement des données ORS lycées 
        $("#btn-download").attr("href", `downloadOrsN3/${CODE_DREN}/${CODE_CISCO}`)
        $(".btn-download").removeClass("d-none")

        url = `layerBesoinsN3/${CODE_DREN}/${CODE_CISCO}`
        url_n2 = `layerEtabN2/${CODE_DREN}/${CODE_CISCO}`
        //on enchaine les appels de creation layers pour avoir l'ordre par niveau
        await utils.fetchData(url, 'GET', {}, async function (data) {
            await createLayerLycee(data)
            await window['layerControl'].addOverlay(window['layer_etabN3S0'], "LYCEES")

            //rehefa azo ny besoin avec layer college dia alaina ny COLLEGES existant
            await utils.fetchData(url_n2, 'GET', {}, async function (data) {
                //console.log(data)
                data.forEach(etab => {
                    liste_etabs.push(etab)
                    iconPub = parseInt(etab.SECTEUR) == 0 ? '#36b9cc' : '#ffffcc' // Publique Vs Privée
                    starIcon = L.divIcon({
                        className: 'custom-icon',
                        html: `<span style="color:${iconPub}"><i class="fa fa-solid fa-square"></i></span><span class="label-etab">${etab.NOM_ETAB}</span>`
                    })
                    if (!isNaN(parseFloat(etab.latitude)) && !isNaN(parseFloat(etab.longitude))) {
                        properties = {CODE_ETAB: etab.CODE_ETAB, NOM_ETAB: etab.NOM_ETAB,eff_t9 : etab.eff_t9}
                        latLng = [parseFloat(etab.latitude), parseFloat(etab.longitude)]
                        etab_ceg = L.marker(latLng, { icon: starIcon, properties: properties })
                        popup = `<div class="custom-tooltip"><b>${etab.NOM_ETAB}</b><hr/>Effectif Total Actuel: ${parseInt(etab.eff_2025)}<hr/>Effectif T9 Actuel: ${parseInt(etab.eff_t9)}</div>`
                        etab_ceg.bindTooltip(etab.NOM_ETAB)
                        etab_ceg.bindPopup(popup)
                        window[`layer_etabN2S0`].addLayer(etab_ceg)
                        $("#search").append(`<option value='${latLng}'>${etab.NOM_ETAB}</option>`)
                    }
                })

                await window['layerControl'].addOverlay(window['layer_etabN2S0'], "COLLEGES EXISTANTS")
                //$(".label-etab").css("font-size", "5px")
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
                    etabLayer = window[`layer_etabN3S0`]
                    if ($(this).prop("checked") && map.hasLayer(etabLayer)) { // cochage sady misy layer etab
                        updateStyleLayerEtab(id)
                    } else if (!$(this).prop("checked") && map.hasLayer(etabLayer)) { // decochage sady layer etab

                    } else if ($(this).prop("checked") && !map.hasLayer(etabLayer)) { //coché fa tsisy layer etab
                        utils.showModal("Attention!", " Veuillez afficher la couche établissement", "danger")
                        $(this).prop("checked", false)
                    }
                })

                /** activena ny boutun download rehefa pret daholo ny couches
                 */
                $(".btn-download").removeClass("d-none")
            })


        })

        $("#btn-download").removeClass("d-none")
    }

    //manao mise à jour an'ireo cirle lycee selon an'ireo valeur indicateur besoin choisit
    const updateStyleLayerEtab = async (id) => {
        var tooltip = ''

        window['layer_etabN3S0'].eachLayer(function (layer) {
            //ici on saute si le layer en cours est un point mais pas un circle
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
    const createLayerLycee = async (data) => {
        /* exemple data :
        {"NOM_ETAB": "ECOLE COMMUNAUTAIRE AMBATOHARANANA", "ANNEE_SCOLAIRE": 2024, "CODE_DREN": 11, "CODE_CISCO": 105, 
          "CODE_ETAB": 105010002, "effectifs": 40, "gp_sections": 1.0, "sdc_be": 3, "sdc_me": 0,  
          "eligible_reconstruction": 0, "eligible_rehabilitation": 0, "sdc_requis": 1.0, "places": 76,
           "latitude": -18.47394597,"longitude": 47.46306854
        }
         */
        //console.log('data', data)
        RADIUS = $("#radius").val()
        liste_etabs = []
        data.forEach(etab => {
            liste_etabs.push(etab)
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
                //etab_ceg = L.marker(latLng, { icon: starIcon })
                popup = `<div class="custom-tooltip">${etab.NOM_ETAB}<br/>Effectif : ${parseInt(etab.effectifs)}</div>`
                aire_lycee = L.circle(latLng, {
                    radius: RADIUS, //metres
                    color: 'yellow',
                    fillColor: 'green',
                    fillOpacity: 0.03
                })
                aire_lycee.bindTooltip(etab.NOM_ETAB)
                aire_lycee.bindPopup(popup)
                aire_lycee.feature = {};
                aire_lycee.feature.properties = properties
                window[`layer_etabN3S0`].addLayer(aire_lycee)

                starIcon = L.divIcon({
                    className: 'custom-icon',
                    html: `<span style="color:#ff5555"><i class="fas fa-school fa-2x text-danger"></i></span><span class="label-etab">${etab.NOM_ETAB}</span>`
                })
                marker_lycee = L.marker(latLng, { icon: starIcon })
                marker_lycee.bindTooltip(etab.NOM_ETAB)
                marker_lycee.bindPopup(popup)
                window[`layer_etabN3S0`].addLayer(marker_lycee)
            }
        })
        

    } //creation Layer des etabs


    //telecharger les couches lycees et ses satellites
    const donwloadAireEtabAvecSatellites = async () => {
        RADIUS = $("#radius").val()
        liste = []
        utils.waitmeShow("div-map","win8")
        await window[`layer_etabN2S0`].eachLayer((ceg) => { 
            airesLycee = []
            window[`layer_etabN3S0`].eachLayer((layer) => { 
                d = layer.getLatLng().distanceTo(ceg.getLatLng())
                if (layer.feature && ceg.options) {
                    airesLycee.push(
                        {
                            CODE_LYCEE: layer.feature.properties.CODE_ETAB,
                            NOM_LYCEE: layer.feature.properties.NOM_ETAB,
                            DISTANCE : parseFloat(d)
                        }
                    )
                }
            })
            //alaina izay CEG le plus proche an'ilay Ecole Primaire
            const minDistanceLYCEE = airesLycee.sort((a, b) => a.DISTANCE - b.DISTANCE)[0];
            liste.push({
                CODE_LYCEE: minDistanceLYCEE.CODE_LYCEE,
                NOM_LYCEE: minDistanceLYCEE.NOM_LYCEE,
                CODE_COLLEGE: ceg.options.properties.CODE_ETAB,
                NOM_COLLEGE: ceg.options.properties.NOM_ETAB,
                EFFECTIF_T9: ceg.options.properties.eff_t9,
                DISTANCE_EN_KM: (minDistanceLYCEE.DISTANCE / 1000).toFixed(1),
                INCLUS_DANS_AIRE : (minDistanceLYCEE.DISTANCE <= RADIUS) ? "OUI":"NON"
            })
        })
        //preparation fichier en csv telecgargeable
        //on elimine d'abord les doublons CODE_LYCEE_CODE_CEG
        listeU = []
		const seenIds = new Set()
        listeU = liste.filter(obj => {
            keys = `${obj["CODE_LYCEE"]}_${obj["CODE_COLLEGE"]}`
			if (seenIds.has(keys)){
				return false
			} else {
				seenIds.add(keys)
				return true
			}
        })
        listeU = listeU.sort((a, b) => a.CODE_LYCEE - b.CODE_LYCEE)
        csvContent = utils.convertObjectToCSV(listeU)
        await utils.downloadCSV(csvContent,"LYCEE_AVEC_CEG.csv")
        utils.waitmeClose("div-map")
    }
    $(document).on("click", "#btn-download-aire", function () {
        donwloadAireEtabAvecSatellites()
    })

    const getLayerNc = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        if (window['layer_nc']) { window['layer_nc'].remove() }
        url = 'layerNouvelleCreation/'
        await utils.fetchData(url, 'GET', {}, async function (data) {
            //console.log(data[0].shape)
            window['layer_nc'] = await L.geoJSON(data[0].shape, {
                style: STYLE_NC,

                onEachFeature: (feature, layer) => { // action atao isaky ny feature
                    nom = feature.properties.name
                    satelittes = feature.properties.satelittes
                    population = parseInt(feature.properties.population)
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
                    })
                    tooltip += `
                                </tbody>
                            </table>
                        </div>`
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
                    if (CODE_CISCO == 0) {
                        return (parseInt(feature.properties.code_dren) == CODE_DREN)
                    } else {
                        return (parseInt(feature.properties.code_cisco) == CODE_CISCO)
                    }

                }
            })
            //await window[`layer_nc`].addTo(map)
            await window['layerControl'].addOverlay(window['layer_nc'], "NOUVELLE CREATION")
        })
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
        if (window[`layer_etabN2S0`]) { window[`layer_etabN2S0`].clearLayers(); }
        if (window[`layer_etabN3S0`]) { window[`layer_etabN3S0`].clearLayers(); }
        if (window[`layer_nc`]) { window[`layer_nc`].clearLayers(); }
        if (window['layer_villages']) { window['layer_villages'].remove() }


    }
    const removeOverLayer = () => {
        window['layerControl'].removeLayer(window[`layer_etabN2S0`])
        window['layerControl'].removeLayer(window[`layer_etabN3S0`])
        window['layerControl'].removeLayer(window[`layer_nc`])
        window['layerControl'].removeLayer(window[`layer_villages`])
    }

    const clearAnalyseLayers = () => {
        markerLines_etab.clearLayers()
        markerLines_COLLEGES.clearLayers()
        if (markerLines_etab) { markerLines_etab.remove() }
        if (temp_buffer_etab) { temp_buffer_etab.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        if (temp_buffer_real) { temp_buffer_real.remove() }
        if (markerLines_COLLEGES) { markerLines_COLLEGES.remove() }
        if (markerLines_COLLEGES) { markerLines_COLLEGES.remove() }
        if (markerGroup_buffer_etab) { markerGroup_buffer_etab.remove() }
        if (markerGroup_COLLEGES_proximite) { markerGroup_COLLEGES_proximite.remove() }
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



    const show_satellite_etab = async (e) => {
        map.flyTo(e.getLatLng(), 14)
        name = e.options.properties.nom
        COLLEGES_satellites = []
        markerLines_COLLEGES.clearLayers()
        if (markerLines_COLLEGES) { markerLines_COLLEGES.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        liste_villages.forEach(v => {
            d = e.getLatLng().distanceTo([v.latitude, v.longitude])
            mV = L.marker([v.latitude, v.longitude], { name: v.name, distance: d })
            if (d <= 2000) {
                COLLEGES_satellites.push(mV)
                markerLines_COLLEGES.addLayer(L.polyline([e.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })
        liste_etabs.forEach(etab => {
            d = e.getLatLng().distanceTo([etab.latitude, etab.longitude])
            mE = L.marker([etab.latitude, etab.longitude], { name: etab.NOM_ETAB, distance: d })
            if (d <= 2000) {
                markerLines_COLLEGES.addLayer(L.polyline([e.getLatLng(), mE.getLatLng()], { color: 'red' }))
            }
        })
        temp_buffer_village = L.circle(e.getLatLng(), {
            radius: 2000,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)
        markerLines_COLLEGES.addTo(map)
    }

    //analyse d'éligibilité d'une village
    const analyseEtab = async (village) => {
        if (!map.hasLayer(window['layer_etabN3S0'])) {
            window['layer_etabN3S0'].addTo(map)
        }
        map.flyTo(village.getLatLng(), 14)
        nom = village.options.properties.nom

        COLLEGES_satellites = []
        COLLEGES_proximite = []
        markerLines_COLLEGES.clearLayers()

        if (markerLines_COLLEGES) { markerLines_COLLEGES.remove() }
        if (temp_buffer_village) { temp_buffer_village.remove() }
        if (markerGroup_buffer_etab) { markerGroup_buffer_etab.remove() }
        if (markerGroup_COLLEGES_proximite) { markerGroup_COLLEGES_proximite.remove() }

        liste_villages.forEach(v => {
            d = village.getLatLng().distanceTo([v.latitude, v.longitude])
            if (d <= 2000) {
                mV = L.marker([v.latitude, v.longitude], { name: v.name, population: v.population, distance: d })
                COLLEGES_satellites.push(mV)
                markerLines_COLLEGES.addLayer(L.polyline([village.getLatLng(), mV.getLatLng()], { color: 'yellow' }))
            }
        })

        dp = 50000 //distance etablissement le plus proche du village
        etab_p = "" // Ecole la plus proche
        c_p = [] // coords etab plus proche

        markerGroup_buffer_etab.clearLayers()
        markerGroup_COLLEGES_proximite.clearLayers()
        liste_etabs.forEach(etab => {
            coords_etab = [etab.latitude, etab.longitude]
            d = village.getLatLng().distanceTo(coords_etab)

            if (d <= dp) {
                etab_p = etab.NOM_ETAB
                dp = d
                c_p = [etab.latitude, etab.longitude]
            }
            if (d <= 2000) {
                bf_e = L.circle([etab.latitude, etab.longitude], {
                    properties: { name: etab.NOM_ETAB, distance: d },
                    radius: 2000,
                    color: 'blue',
                    fillOpacity: 0.2
                })
                COLLEGES_proximite.push(bf_e)
                markerGroup_buffer_etab.addLayer(bf_e)
                markerLines_COLLEGES.addLayer(L.polyline([village.getLatLng(), coords_etab], { color: 'red' }))
            }
        })
        markerGroup_COLLEGES_proximite.addLayer(
            L.circle(c_p, {
                properties: { name: etab_p, distance: dp },
                radius: 2000,
                color: 'blue',
                fillOpacity: 0.2
            })
        )

        markerLines_COLLEGES.addTo(map)
        markerGroup_buffer_etab.addTo(map)
        markerGroup_COLLEGES_proximite.addTo(map)
        //tampon du village en cours d'analyse
        temp_buffer_village = L.circle(village.getLatLng(), {
            radius: 2000,
            color: 'yellow',
            fillOpacity: 0.2
        }).addTo(map)


        dom = ` <div class="panel panel-info" style="padding: 5px;">
                    <div class="panel-heading"></div>
                    <div class="panel-body">
                        <div class='row'>
                            <dl>
                                <dt>Etablissement le plus proche</dt>
                                <dd> ${etab_p}: à ${(dp / 1000).toFixed(1)} km</dd>
                            </dl>
                        </div>
                        <div class='row'>
                            <dl>
                                <dt>Etablissement(s) à moins de 2km (0${COLLEGES_proximite.length})</dt>
                        `
        for (let i = 0; i < COLLEGES_proximite.length; i++) {
            dom += `<dd> ${COLLEGES_proximite[i].options.properties.name} : à ${(COLLEGES_proximite[i].options.properties.distance / 1000).toFixed(1)}km</dd>`
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
        for (let i = 0; i < COLLEGES_satellites.length; i++) {
            console.log(COLLEGES_satellites[i])
            dom += `<tr>`
            dom += `<td> ${COLLEGES_satellites[i].options.name}</td>`
            dom += `<td> 0${(COLLEGES_satellites[i].options.distance / 1000).toFixed(1)} km</td>`
            dom += `<td> <input type="number" value="${parseInt(COLLEGES_satellites[i].options.population)}" class="form-control population"  placeholder="Population" /></td>`
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
                        <div class="col-lg-12"><a id="btn-analyse-vlg" class="btn btn-primary btn-sm">Analyser</a></div>
                    </div>
                </div>`

        $("#dom-analyse").html(dom)
        $("#dom-analyse-ModalLabel").html(`${nom.toUpperCase()}`)
        $("#dom-analyse-Modal").modal('show')

        $(document).on("click", "#btn-analyse-vlg", function () {
            //traitement_village()
            result = ``
            if (COLLEGES_proximite.length > 0) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais le village n’est pas éligible pour la création d’une nouvelle école. Il existe déjà une école à proximité qui est à moins de 2 km. Nous vous encourageons à utiliser les ressources de cette école existante.</div>`
                $("#result").html(result)
                return
            }
            pop = 0
            $('.population').each(function () {
                pop += ($(this).val() == "") ? 0 : parseInt($(this).val())
            })
            if (pop < 200) {
                result += `<div class="alert alert-danger">Nous sommes désolé, mais le village n’est pas éligible pour la création d’une nouvelle école car la population scolarisable est très faible.</div>`
                $("#result").html(result)
            } else {
                result += `<div class="alert alert-success">Félicitations! Le village est éligible pour la création d’une nouvelle école car tous les critères nécessaires sont remplis.</div>`
                $("#result").html(result)
            }
        })
        $("#btn-analyse-vlg").click()
    }

}) // readyfunction
