$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('content-page', 'win8')
});
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('content-page')
});
$(document).on("ajaxStop", function () {
    utils.waitmeClose('content-page')
})

//mode minimal show pour le menu gauche
/*
$("#accordionSidebar").removeClass("toggled").addClass("toggled")
$(".nav-item .collapse").removeClass("show") //#collapseORS
*/

$(document).ready(async function () {
    utils.waitmeClose('content-page')

    // Tableau de noms de groupe d'aires et de noms de couche d'établissement
    const etabGroupNames = ['layer_etabN0S0', 'layer_etabN1S0', 'layer_etabN2S0', 'layer_etabN3S0', 'layer_etabN0S1', 'layer_etabN1S1', 'layer_etabN2S1', 'layer_etabN3S1'];
    const aireGroupNames = ['aire_etabN0S0', 'aire_etabN1S0', 'aire_etabN2S0', 'aire_etabN3S0', 'aire_etabN0S1', 'aire_etabN1S1', 'aire_etabN2S1', 'aire_etabN3S1'];

    // Créez les groupes d'etablissements et regroupé dans un layerGroup
    for (let groupName of etabGroupNames) {
        window[groupName] = new L.layerGroup()
        window[groupName].options.name = groupName
        window[groupName].options.id = groupName.substr(-4)
    }

    // Créez les groupes d'aires et regroupé dans un layerGroup
    for (let groupName of aireGroupNames) {
        window[groupName] = new L.layerGroup()
        window[groupName].options.name = groupName
        window[groupName].options.id = groupName.substr(-4)
    }

    //map et les shapes administratives
    window['map'] = null
    window['shp_dren'] = null
    window['shp_cisco'] = null
    window['shp_commune'] = null
    window['shp_fokontany'] = null
    window['layer_villages'] = new L.layerGroup()
    window["positionAvantDeplacement"] = []
    var OVER_LAYERS = {}
    var CTRL_AIRE = null
    window["deplace_chck"] = null

    //les styles
    const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 4, opacity: 1, fillOpacity: 0.03 }
    const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 3, opacity: 0.9, fillOpacity: 0.03 }
    const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 0.8, fillOpacity: 0.03 }
    const STYLE_FOKONTANY = { fillColor: '#55ff00', color: '#55ff00', weight: 0.6, opacity: 0.5, fillOpacity: 0.03 }

    var tempPositionMarker = null // pour deplacement sur carte vers lieu recherché
    var tempPositionBuffer = null // pour deplacement sur carte vers lieu recherché
    var dataEtabNonPointe = [] //tableau des données etablissement fpe sans coordonnees
    var listeSearch = [] //asiana villages sy ecoles hanaovana recherche
    //console.log(window.location.protocol + "//" + window.location.host + window.location.pathname + 'js/fr-FR.json')
    var table_etabNonPointe = $('#table-EtabNonPointe').DataTable({
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
        lengthChange: false,
        destroy: true,
        searching: false
    }) //dataTable filtre ajout etab dans sig
    var tempEtabAddedSig = [] //liste des ajouts etablissements (liste temporaire)

    var dataEtabPointe = [] //tableau des données etablissement avec coordonnees

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
                        s = (c.CODE_CISCO == USER_CISCO) ? "selected" : ""
                        $("#cisco").append(`<option value="${c.CODE_CISCO}" ${s}>${c.CISCO}</option>`)
                        if (c.CODE_CISCO == USER_CISCO) {
                            $("#cisco").change()
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
                utils.waitmeClose('content-page')
                $("#cisco").html(`<option value="0">-Aucunes Données-</option>`)
            }
        })

    }) // change DREN

    //
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
                    contextmenu: code_cisco == USER_CISCO,
                    style: STYLE_CISCO,
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            contextmenu: function (e) {
                                $(".js-latitude").val(e.latlng.lat)
                                $(".js-longitude").val(e.latlng.lng)
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        {
                                            label: 'Geolocaliser Etablissement', onClick: () => {

                                                if (USER_CISCO !== code_cisco) {
                                                    Swal.fire("Attention !", `Désolé ${USER_FNAME}, Cette action est réservée exclusivement aux responsables de la CISCO ${code_cisco}.`, "error")
                                                    return
                                                }
                                                if (map.getZoom() < 15) {
                                                    Swal.fire("Attention!", " Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.", "warning")
                                                    return
                                                }
                                                updateListeEtabNonPointe()
                                                openFormAddEtab()
                                            }
                                        },
                                        {
                                            label: 'Geolocaliser Village', onClick: async () => {

                                                if (USER_CISCO !== code_cisco) {
                                                    Swal.fire("Attention !", "Cette action est réservée exclusivement aux responsables de la CISCO.", "error")
                                                    return
                                                }
                                                if (map.getZoom() < 15) {
                                                    Swal.fire("Attention!", " Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.", "warning")
                                                    return
                                                }
                                                openFormVillage()
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
                        layer.bindTooltip(`CISCO ${feature.properties.name}`,
                            {
                                className: 'custom-tooltip',
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
                contextmenu: false,
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
                            contextmenu: function (e) {
                                $(".js-latitude").val(e.latlng.lat)
                                $(".js-longitude").val(e.latlng.lng)
                                //console.log(e, e.latlng)
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        {
                                            label: 'Geolocaliser Etablissement', onClick: () => {

                                                if (USER_CISCO !== code_cisco) {
                                                    Swal.fire("Attention !", `Désolé ${USER_FNAME}, Cette action est réservée exclusivement aux responsables de la CISCO ${code_cisco}.`, "error")
                                                    return
                                                }
                                                if (map.getZoom() < 15) {
                                                    Swal.fire("Attention!", " Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.", "warning")
                                                    return
                                                }
                                                updateListeEtabNonPointe()
                                                openFormAddEtab()
                                            }
                                        },
                                        {
                                            label: 'Geolocaliser Village', onClick: async () => {

                                                if (USER_CISCO !== code_cisco) {
                                                    Swal.fire("Attention !", "Cette action est réservée exclusivement aux responsables de la CISCO.", "error")
                                                    return
                                                }
                                                if (map.getZoom() < 15) {
                                                    Swal.fire("Attention!", " Le niveau de zoom est trop bas. Le zoom minimum autorisé est de 16.", "warning")
                                                    return
                                                }
                                                openFormVillage()
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
        $("#div-map").html(`<div id="map" style = "height: 100vh;"></div >`)
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
        var BING_KEY = 'AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L'
        var BING_LAYER = L.tileLayer.bing(BING_KEY)
        var OSM_TOPO_LAYER = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; OpenStreetMap contributors, &copy; OpenCycleMap contributors, &copy; OpenAerialMap contributors, &copy; Geodata: &copy; OpenStreetMap contributors, &copy; GeoFabrik',
            maxZoom: 19
        });
        const BASE_LAYER = {
            "DEFAULT": DEFAULT_LAYER,
            "OSM": OSM_LAYER,
            //"OSM TOPO": OSM_TOPO_LAYER,
            "IMAGERY": IMAGERY_LAYER,
            "BING": BING_LAYER,
            "MAPBOX": MAP_BOX,
        }

        map.flyTo([-18.91891771052786, 47.51385211944581], 6)

        L.easyButton('fas fa-redo-alt fa-lg  init', function (btn, map) {
            if (map.hasLayer(window['shp_dren'])) {
                map.fitBounds(window['shp_dren'].getBounds())
            } else if (map.hasLayer(window['shp_cisco'])) {
                map.fitBounds(window['shp_cisco'].getBounds())
            }
        }, 'Reinitialiser', 'init').addTo(map)
        var legend = L.control({ position: 'bottomleft' })
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'legend')
            div.innerHTML += '<p style="font-size: 16px;"><strong><u>Légende</u><strong></p>'
            div.innerHTML += '&nbsp;<i class="fa fa-square text-primary"></i>&nbsp;Secteur Public</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square text-warning"></i>&nbsp;Secteur Privé</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-bullseye"></i>&nbsp;Présco et Primaire</br>'
            div.innerHTML += '&nbsp;<i class="fas fa-circle"></i>&nbsp;Collège</br>'
            div.innerHTML += '&nbsp;<i class="fas fa-certificate"></i>&nbsp;Lycée</br>'
            div.innerHTML += '&nbsp;<i class="fas fa-caret-up"></i>&nbsp;villages</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#4e73df"></i>&nbsp;Limite DREN</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#c0c0c0"></i>&nbsp;Limite Commune</br>'
            div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#55ff00"></i>&nbsp;Limite Fokontany</br>'
            L.DomEvent.disableClickPropagation(div)
            return div
        }
        legend.addTo(map)

        map.on('zoomend', function () {
            var currentZoom = map.getZoom()
            if (currentZoom <= 12) {
                $(".label-etab").css("font-size", "0px")
                $(".label-village").css("font-size", "0px")
            }
            if (currentZoom > 12 && currentZoom <= 14) {
                $(".label-etab").css("font-size", "8px")
                $(".label-village").css("font-size", "8px")
            }
            if (currentZoom > 14 && currentZoom <= 16) {
                $(".label-etab").css("font-size", "10px")
                $(".label-village").css("font-size", "10px")
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


        //zoom control ahafahana mijery ny niveau de zoom rehefa hanao pointage
        const ZoomViewer = L.Control.extend({
            onAdd() {
                const container = L.DomUtil.create('div')
                const gauge = L.DomUtil.create('div', 'text-primary')
                container.style.width = '200px';
                container.style.background = 'rgba(255,255,255,0.5)';
                container.style.textAlign = 'left';
                map.on('zoomstart zoom zoomend', (ev) => {
                    gauge.innerHTML = `Niveau de Zoom: ${map.getZoom()}`
                })
                container.appendChild(gauge)
                return container;
            }
        }) // ZoomViewer
        const zoomViewerControl = (new ZoomViewer({ position: 'topleft' })).addTo(map)

        window['layerControl'] = L.control.layers(BASE_LAYER, {}, { position: 'topright', collapsed: false })
        window['layerControl'].addTo(map)


        utils.waitmeClose('content-page')

    } //iniMap


    initMap()


    // clicker sur le bouton appliquer filtre pour traiter l'ORS demandé
    $(document).on("click", "#btn-filter", async function () {

        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        if (CODE_DREN === 0) {
            utils.waitmeClose('content-page')
            utils.showModal("Attention", "Veuillez choisir la DREN et/ou la CISCO pour poursuivre l'opération!", "danger")
            return
        }

        // Deplacement marker
        // case a cocher pour control aire des etablissements
        if (USER_CISCO == CODE_CISCO && USER_CISCO > 0) {
            if (window["deplace_chck"]) { window["deplace_chck"].remove() }
            window["deplace_chck"] = L.control({ position: 'topleft' })
            deplace_chck.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'control-move')
                div.innerHTML += '<input class="form-control" id="check-move" type="checkbox"/><i class="fas fa-up-down-left-right"></i><label id="lbl-chkmv" for="check-move">Deplacer</label>'
                L.DomEvent.disableClickPropagation(div)
                return div
            }
            deplace_chck.addTo(map)

            $(document).on("click", "#check-move", function () {
                if (map.getZoom() <= 13) {
                    utils.showModal("<p>DEPLACEMENT", "LE NIVEAU DE ZOOM EST TROP FAIBLE</p>", "warning")
                    $(this).prop("checked", false)
                    return
                }
            })

            map.on('zoomstart zoom zoomend', (ev) => {
                if ($("#check-move").prop("checked") && map.getZoom() < 16) {
                    $("#check-move").prop("checked", false)
                }
            })
        }

        await clearBaseLayers()
        await clearEtabLayers()
        await removeOverLayer()
        await getBaseLayer()
        await getCTDLayer()

        //******************************************RECUPERATIOn DES LAYERS ETABLISSEMENTS PAR NIVEAU  ********************** */
        await downloadLayerEtab()

        $("#paramModal").modal("hide")

    })

    // recuperation et creation des layers villages
    const getLayerVillagesLayer = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        if (window['layer_villages']) { window['layer_villages'].clearLayers(); window['layer_villages'].remove() }
        url = `layerVillages/${code_dren}/${code_cisco}`
        await utils.fetchData(url, 'GET', {}, async function (data) {
            data.forEach(v => {
                id = v.id
                nom = v.name
                starIcon = L.divIcon({
                    className: 'custom-icon',
                    iconSize: [20, 20],
                    html: `<i class= "fa fa-solid fa-caret-up text-danger"></i><span class="label-village" style="font-size:8px;position: absolute;top: 10px;">${nom}</span>`
                })
                latlng = [parseFloat(v.latitude), parseFloat(v.longitude)]
                listeSearch.push({ latLng: latlng, id: v.id, name: `Village ${v.name}`, fokontany: "" })
                marker = L.marker(latlng, {
                    properties: { id, nom },
                    draggable: USER_CISCO === CODE_CISCO,
                    icon: starIcon
                })
                marker.bindTooltip(`<b>${nom}</b>`, {
                    permanent: false,
                    opacity: 1,
                    className: '',
                    direction: 'top', // La direction du tooltip (top, bottom, left, right, auto) 
                    offset: [0, 0] // Décalage du tooltip par rapport au marqueur
                })
                marker.on('dragstart', onDragMarkerStart)
                marker.on('dragend', onDragVillageEnd)
                if ((v.code_dren == CODE_DREN && CODE_CISCO == 0) || (v.code_cisco == CODE_CISCO && CODE_CISCO > 0)) {
                    window['layer_villages'].addLayer(marker)
                }

            })
            if (window[`layer_villages`]) { window['layerControl'].removeLayer(window[`layer_villages`]) }
            await window['layerControl'].addOverlay(window['layer_villages'], "VILLAGES")

        })
    } // end getVillages Exclus

    // telechargement des couches ecoles
    const downloadLayerEtab = async () => {
        CODE_DREN = parseInt($("#dren").val())
        CODE_CISCO = parseInt($("#cisco").val())
        url_n0 = `layerEtabN0/${CODE_DREN}/${CODE_CISCO}`
        url_n1 = `layerEtabN1/${CODE_DREN}/${CODE_CISCO}`
        url_n2 = `layerEtabN2/${CODE_DREN}/${CODE_CISCO}`
        url_n3 = `layerEtabN3/${CODE_DREN}/${CODE_CISCO}`
        //on enchaine les appels de creation layers pour avoir l'ordre par niveau
        await utils.fetchData(url_n0, 'GET', {}, async function (data) {
            createLayerEtab(data, 'fa fa-bullseye', 'green', '0', 2)
            window['layerControl'].addOverlay(window['layer_etabN0S0'], "PRESCO PUBLIC")
            window['layerControl'].addOverlay(window['layer_etabN0S1'], "PRESCO PRIVE")
            await utils.fetchData(url_n1, 'GET', {}, async function (data) {
                createLayerEtab(data, 'fa fa-bullseye', 'green', '1', 2)
                window['layerControl'].addOverlay(window['layer_etabN1S0'], "PRIMAIRE PUBLIC")
                window['layerControl'].addOverlay(window['layer_etabN1S1'], "PRIMAIRE PRIVE")
                await utils.fetchData(url_n2, 'GET', {}, async function (data) {
                    createLayerEtab(data, 'fas fa-circle', 'blue', '2', 5)
                    window['layerControl'].addOverlay(window['layer_etabN2S0'], "COLLEGE PUBLIC")
                    window['layerControl'].addOverlay(window['layer_etabN2S1'], "COLLEGE PRIVE")
                    await utils.fetchData(url_n3, 'GET', {}, async function (data) {
                        createLayerEtab(data, 'fas fa-certificate', 'yellow', '3', 20)
                        window['layerControl'].addOverlay(window['layer_etabN3S0'], "LYCEE PUBLIC")
                        window['layerControl'].addOverlay(window['layer_etabN3S1'], "LYCEE PRIVE")
                        // case a cocher pour control aire des etablissements
                        if (CTRL_AIRE) { CTRL_AIRE.remove() }
                        CTRL_AIRE = L.control({ position: 'topright' })
                        CTRL_AIRE.onAdd = function (map) {
                            var div = L.DomUtil.create('div', 'control-aire')
                            div.innerHTML += '<input id="N1S0" class="ctrl_aire_etab" type="checkbox" />&nbsp;Aire EPP</br>'
                            div.innerHTML += '<input id="N2S0" class="ctrl_aire_etab" type="checkbox" />&nbsp;Aire CEG</br>'
                            div.innerHTML += '<input id="N3S0" class="ctrl_aire_etab" type="checkbox" />&nbsp;Aire LYCEE</br>'
                            L.DomEvent.disableClickPropagation(div)
                            return div
                        }

                        CTRL_AIRE.addTo(map)
                        $(".control-aire .leaflet-control").css("width", "150px")
                        //event click checkboxe arie etablissement
                        $(document).on("change", ".ctrl_aire_etab", function () {
                            id = $(this).attr("id")
                            aireLayer = window[`aire_etab${id}`]
                            etabLayer = window[`layer_etab${id}`]
                            if ($(this).prop("checked") && map.hasLayer(etabLayer)) { // cochage sady misy layer etab
                                aireLayer.addTo(map)
                            } else if (!$(this).prop("checked") && map.hasLayer(etabLayer)) { // decochage sady layer etab
                                aireLayer.remove()
                            } else if ($(this).prop("checked") && !map.hasLayer(etabLayer)) { //coché fa tsisy layer etab
                                utils.showModal("Attention!", " Veuillez afficher le groupe d'établissement correspondant", "danger")
                                $(this).prop("checked", false)
                            }
                        })

                        await getLayerVillagesLayer() // rehefa azo daholo ny etab vao alaina ny villages 
                        listeS = utils.toUniqueListe(listeSearch,'id')
                        listeS.forEach(data => {
                            $("#search").append(`<option value='${data.latLng}'>${data.name}</option>`)
                        })
                        new TomSelect("#search",{
                            create: false,
                            sortField: {
                                field: "text",
                                direction: "asc"
                            }
                        });
                        modal = document.getElementById('paramModal');
                        modal.addEventListener('shown.bs.modal', function () {
                            document.querySelector('#search').tomselect.focus();
                        });
                    })
                })
            })
        })

        url = `listeEtablissementNonGeolocalise/${CODE_DREN}/${CODE_CISCO}`
        await utils.fetchData(url, 'GET', {}, async function (data) {
            data.forEach(etab => {
                dataEtabNonPointe.push(etab)
            })
        })


    } // download Layer Etab

    //transformer les donnees etab en Layer avec son class, icon fa, son id et son label sur la carte
    const createLayerEtab = (data, fa, aire_color, niveau, rayon) => {
        //console.log(data)
        CODE_CISCO = parseInt($("#cisco").val())
        data.forEach(dataEtab => {
            cls = (dataEtab.SECTEUR == 0) ? 'text-primary' : 'text-warning'
            starIcon = L.divIcon({
                className: 'custom-icon',
                iconSize: [20, 20],
                html: `<i class="${fa}  ${cls}"></i><span class="label-etab">${dataEtab.NOM_ETAB}</span>`
            })
            latLng = [parseFloat(dataEtab.latitude), parseFloat(dataEtab.longitude)]
            properties = dataEtab
            listeSearch.push({ latLng: latLng, id: dataEtab.CODE_ETAB, name: `${dataEtab.NOM_ETAB} / ${dataEtab.FOKONTANY}`  })
            marker_etab = L.marker(latLng, {
                properties: properties,
                icon: starIcon,
                draggable: USER_CISCO === CODE_CISCO
            })
            //console.log(dataEtab)
            marker_etab.bindTooltip(`<div class="custom-tooltip">${dataEtab.NOM_ETAB}</div>`, {
                permanent: false,
                opacity: 1,
                className: 'custom-tooltip',
                direction: 'top',
            })
            //marker_etab.bindPopup(popup)
            marker_etab.on('dragstart', onDragMarkerStart)
            marker_etab.on('dragend', onDragEtabEnd)
            marker_etab.on('click', openFicheEcole)
            //aire_color = dataEtab.EXISTE_LYCEE == 1 ? 'red' : dataEtab.EXISTE_COLLEGE == 'yellow' ? 5 : 'blue'

            var airePoint = turf.point([dataEtab.longitude, dataEtab.latitude], properties)
            var buffer = turf.buffer(airePoint, rayon, { units: 'kilometers' })

            var bufferPolygon = L.geoJSON(buffer, {
                style: { color: aire_color, fillColor: aire_color, weight: 1, fillOpacity: 0.05 },
                onEachFeature: (feature, layer) => {
                    layer.on('click', openFicheEcole)
                }
            })
            bufferPolygon.eachLayer(layer => {
                layer.on('mouseover', (e) => { e.target.setStyle({ weight: 2, color: '#ff0000', fillOpacity: 0.1 }) })
                layer.on('mouseout', (e) => { e.target.setStyle({ color: aire_color, fillColor: aire_color, weight: 1, fillOpacity: 0.05 }) })
            })

            window[`layer_etabN${niveau}S${dataEtab.SECTEUR}`].addLayer(marker_etab)
            window[`aire_etabN${niveau}S${dataEtab.SECTEUR}`].addLayer(bufferPolygon)

        })

    } //creation Layer des etabs

    //ouverture fiche ecole
    const openFicheEcole = async (etab) => {
        data = (etab.target && etab.target.feature && etab.target.feature.properties) ||  (etab.target && etab.target.options && etab.target.options.properties) || null
        //console.log(properties)
        /* EXEMPLE properties :
        CODE_ETAB: 509040070, CODE_DREN: 52, CODE_CISCO: 509, NOM_ETAB: "ECOLE COMMUNAUTAIRE AMBALAKINININA", SECTEUR: 0, 
        CATEGORIE_COMMUNE: "RUR 2", VILLAGE: "AMBALAKINININA", FOKONTANY: "AMBALAKINININA", point_eau: "0", TYPE_SOURCE_EAU: null
        TYPE_SOURCE_ELECTRICITE: null,bacc: 0,bacp5plus: 0,bepc: 3,licence: 0,,eff_2022: 66,eff_2023: 58,eff_2024: 77,eff_2025: 72,elec: "0",
        fonctionnaire: 0,fram_nonsub: 2,fram_sub: 0,autres: 1,latrince_g: "0",latrine: "0",latrine_f: "0",
        latitude: -16.96238437,longitude: 49.06370722,pers_total: 3,places: 0,point_eau: "0",qualifiee: 0,sdc_be: "0",sdc_me: "1"*/
        $("#f_code_etab").html(`${data.CODE_ETAB}`)
        $("#ficheEcoleModalLabel").html(`${data.NOM_ETAB}`)
        $("#f_secteur").html(`${parseInt(data.SECTEUR)==0?"PUBLIQUE":"PRIVEE"}`)
        $("#f_zone").html(`${data.CATEGORIE_COMMUNE[0] == "U" ? "URBAINE" : "RURALE"}`)
        $("#f_adresse").html(`${data.FOKONTANY}`)

        let data_eleve = {
            labels: ['2022', '2023', '2024','2025'],
            datasets: [{
                label: 'ELEVES',
                data: [parseInt(data.eff_2022),parseInt(data.eff_2023),parseInt(data.eff_2024),parseInt(data.eff_2025)],
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        }
        drawLine("ctx-eleve", data_eleve)

        $("#f_pers_total").html(`${data.pers_total}`)
        $("#f_en_classe").html(`${data.en_classe}`)
        $("#f_fonctionnaire").html(`${data.fonctionnaire}`)
        $("#f_fram_sub").html(`${data.fram_sub}`)
        $("#f_fram_nonsub").html(`${data.fram_nonsub}`)
        $("#f_autres").html(`${data.autres}`)
        $("#f_bepc").html(`${data.bepc}`)
        $("#f_bacc").html(`${data.bacc}`)
        $("#f_licence").html(`${data.licence}`)
        $("#f_bacp5plus").html(`${data.bacp5plus}`)
        $("#f_qualifiee").html(`${data.qualifiee}`)
        $("#f_be").html(`${data.sdc_be}`)
        $("#f_me").html(`${data.sdc_me}`)
        $("#f_elec").html(`${parseInt(data.elec)>0?"OUI (" + data.TYPE_SOURCE_ELECTRICITE + ")":"NON"}`)
        $("#f_eau").html(`${parseInt(data.point_eau)>0?"OUI (" + data.TYPE_SOURCE_EAU + ")":"NON"}`)
        $("#f_latrine_g").html(`${parseInt(data.latrince_g)>0?"OUI":"NON"}`)
        $("#f_latrine_f").html(`${parseInt(data.latrince_f)>0?"OUI":"NON"}`)
        $("#f_latrine").html(`${parseInt(data.latrince)>0?"OUI":"NON"}`)
    
        $("#ficheEcoleModal").modal("show")
    }
    const drawLine = async (dom, data) => {
        ctx = document.getElementById(dom).getContext('2d')
        if (!ctx) {
            $(`#dom-${dom}`).html(`<canvas id="${dom}" height="50"></canvas>`)
        } else {
            $(`#dom-${dom}`).html("")
            ctx = null
            $(`#dom-${dom}`).html(`<canvas id="${dom}" height="50"></canvas>`)
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
    const clearEtabLayers = async () => {
        for (let n = 0; n < 4; n++) {
            for (let s = 0; s < 2; s++) {
                const layerGroup = window[`layer_etabN${n}S${s}`]
                const aireGroup = window[`aire_etabN${n}S${s}`]
                if (layerGroup) { layerGroup.clearLayers(); }
                if (aireGroup) { aireGroup.clearLayers() }
            }
        }
    }
    const removeOverLayer = async () => {
        for (let n = 0; n < 4; n++) {
            window['layerControl'].removeLayer(window[`layer_etabN${n}S0`])
            window['layerControl'].removeLayer(window[`layer_etabN${n}S1`])
        }

    }
    const clearBaseLayers = async () => {
        if (window['shp_dren']) { window['shp_dren'].remove() }
        if (window['shp_cisco']) { window['shp_cisco'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window['shp_fokontany']) { window['shp_fokontany'].remove() }
    }

    const centerMap = function (e) {
        map.flyTo(e.latlng, 16)
    }

    const openFormAddEtab = function () {

        $("#modal-add-etab").modal("show")
        $("#filter-nom-etab").val("")
        $("#code-etab").val("")
    }
    const openFormVillage = function () {
        $("#modal-add-village").modal("show")
    }
    // mettre a jour liste etab non pointe apres chaque pointage fait
    const updateListeEtabNonPointe = async () => {
        CODE_DREN = $("#dren").val()
        CODE_CISCO = $("#cisco").val()
        $("#btn-save-etab").attr("disabled", "disabled")
        $("#btn-save-etab").removeClass("btn-danger").addClass("btn-danger")
        $("#code_etab").val("")
        $("#nom_etab").val("")
        table_etabNonPointe.clear().draw()
        url = `listeEtablissementNonGeolocalise/${CODE_DREN}/${CODE_CISCO}`
        await utils.fetchData(url, 'GET', {}, async function (data) {
            dataEtabNonPointe = []
            await data.forEach(etab => {
                if (!tempEtabAddedSig.includes(parseInt(etab.CODE_ETAB))) {
                    secteur = (etab.SECTEUR == 1) ? 'Privée' : 'Public'
                    table_etabNonPointe.row.add([etab.CODE_ETAB, etab.NOM_ETAB, secteur, etab.ZAP]).draw()
                }
                dataEtabNonPointe.push(etab)
            })
        })
    }
    // Sélectionnez etablissment dans table etab pour ajout
    $(document).on('click', '#table-EtabNonPointe tbody tr', function () {
        $(this).removeClass('bg-gradient-success').addClass('bg-gradient-success')
        var rowData = table_etabNonPointe.row(this).data()
        $("#nom_etab").val(rowData[1].trim())
        $("#code_etab").val(rowData[0])
        filterTable()
        $("#btn-save-etab").removeAttr("disabled")
        $("#btn-save-etab").removeClass("btn-danger").addClass("btn-primary")
    })

    // Fonction pour filtrer le tableau en fonction du nom dans la formulaire ajout etablissement
    const filterTable = () => {
        filter = $("#nom_etab").val().toLowerCase()
        table_etabNonPointe.clear().draw()
        dataEtabNonPointe.forEach(etab => {
            if ((etab.NOM_ETAB.toLowerCase().indexOf(filter) > -1) && (!tempEtabAddedSig.includes(etab.CODE_ETAB))) {
                secteur = (etab.SECTEUR == 1) ? 'Privée' : 'Public'
                table_etabNonPointe.row.add([etab.CODE_ETAB, etab.NOM_ETAB, secteur, etab.ZAP]).draw()
            }

        })
        if (filter.length == 0) {
            $("#btn-save-etab").removeClass("btn-primary").addClass("btn-danger")
            $("#btn-save-etab").attr("disabled", "disabled")
        }
    }
    document.getElementById("nom_etab").addEventListener("input", filterTable)

    $("#form-add-etab").submit(function (e) {
        e.preventDefault()
    })


    $(document).on("click", "#btn-save-etab", function () {
        const code_etab = document.getElementById("code_etab").value
        const nom_etab = document.getElementById("nom_etab").value
        const longitude = parseFloat($(".js-longitude").val())
        const latitude = parseFloat($(".js-latitude").val())
        if (latitude + longitude == 0) {
            Swal.fire("ERREUR", "Une erreur est survenue, Veuillez cliquer sur le bouton filtrer et réessayer la géolocalisation", "error")
            return
        }
        if (code_etab.length != 9) { utils.msgBox("Attention", "Veuillez séléctionner un établissement à géolocaliser", "warning"); return }
        $.post("geolocaliserEtablissement/", { code_etab, longitude, latitude }, function (data) {
            if (data) {
                if (data.status == "success") {
                    $("#modal-add-etab").modal("hide")
                    Swal.fire("Enregistrement", data.message, "success")
                    tempEtabAddedSig.push(parseInt(code_etab))
                    updateListeEtabNonPointe()
                    const marqueur = L.marker([latitude, longitude]).addTo(map)
                    marqueur.bindPopup(nom_etab).openPopup()
                } else {
                    $("#modal-add-etab").modal("hide")
                    Swal.fire("ERREUR", data.message, "error")
                }
            } else {
                utils.waitmeClose("content-page")
            }
        })
    })

    $("#form-add-village").submit(function (e) {
        e.preventDefault()
    })
    
    $(document).on("click", "#btn-save-village", function () {
        const name = $("#name").val()
        const dren = USER_DREN
        const cisco = USER_CISCO
        const population = parseInt($("#population").val())
        const airtel = $("#airtel").is(':checked') ? 1 : 0
        const orange = $("#orange").is(':checked') ? 1 : 0
        const telma = $("#telma").is(':checked') ? 1 : 0
        const elec = $("#elec").is(':checked') ? 1 : 0
        const eau = $("#eau").is(':checked') ? 1 : 0
        const longitude = parseFloat($(".js-longitude").val())
        const latitude = parseFloat($(".js-latitude").val())

        if (name.length < 4) { utils.msgBox("Attention", "Veuillez vérifier le nom du village à géolocaliser !.", "warning"); return }
        if (isNaN(population) || population < 10) { utils.msgBox("Attention", "Veuillez entrer vérifier le nombre de population du village !.", "warning"); return }

        if (latitude + longitude == 0) {
            Swal.fire("ERREUR", "Une erreur est survenue, Veuillez cliquer sur le bouton filtrer et réessayer la géolocalisation", "warning")
            return
        }
        village = {
            name,
            dren,
            cisco,
            population,
            airtel,
            orange,
            telma,
            elec,
            eau,
            longitude,
            latitude
        }
        $.post("geolocaliserVillage/", village, function (data) {
            if (data) {
                if (data.status == "success") {
                    $("#modal-add-village").modal("hide")
                    Swal.fire("Enregistrement", data.message, "success")
                    const marqueur = L.marker([latitude, longitude]).addTo(map)
                    marqueur.bindPopup(nom_etab).openPopup()
                } else {
                    $("#modal-add-village").modal("hide")
                    Swal.fire("ERREUR", data.message, "error")
                }
            } else {
                utils.waitmeClose("content-page")
            }
        })
    })

    // deplacement etablissement
    const updatePositionEtab = async function (etab) {
        $.post("updatePositionEtablissement/", etab, function (data) {
            if (data) {
                if (data.status == "success") {
                    $("#modal-add-etab").modal("hide")
                    Swal.fire("Deplacement", data.message, "success")
                } else {
                    Swal.fire("ERREUR", data.message, "error")
                }
            } else {
                utils.waitmeClose("content-page")
            }
        })
    }

    // deplacement etablissement
    const updatePositionVillage = async function (village) {
        $.post("updatePositionVillage/", village, function (data) {
            if (data) {
                if (data.status == "success") {
                    $("#modal-add-etab").modal("hide")
                    Swal.fire("Deplacement", data.message, "success")
                } else {
                    Swal.fire("ERREUR", data.message, "error")
                }
            } else {
                utils.waitmeClose("content-page")
            }
        })
    }
    // Fonction pour activer le déplacement
    const enableDragging = (e) => {
        var marker = e.target
        marker.dragging.enable()
    }

    // Fonction pour désactiver le déplacement
    const disableDragging = (e) => {
        var marker = e.target
        marker.dragging.disable()
    }
    const onDragMarkerStart = (event) => {
        window["positionAvantDeplacement"] = event.target.getLatLng()
    }

    const onDragEtabEnd = (event) => {
        if ($("#check-move").prop("checked") && map.getZoom() >= 13) {
            event.target.setLatLng(event.target.getLatLng())
            code_etab = event.target.options.properties.code_etab
            longitude = event.target.getLatLng().lng
            latitude = event.target.getLatLng().lat
            etab = { code_etab, longitude, latitude }
            updatePositionEtab(etab)
        } else {
            event.target.setLatLng(window["positionAvantDeplacement"])
        }
    }

    const onDragVillageEnd = (event) => {
        if ($("#check-move").prop("checked") && map.getZoom() >= 13) {
            event.target.setLatLng(event.target.getLatLng())
            id = event.target.options.properties.id
            longitude = event.target.getLatLng().lng
            latitude = event.target.getLatLng().lat
            village = { id, longitude, latitude }
            updatePositionVillage(village)
        } else {
            event.target.setLatLng(window["positionAvantDeplacement"])
        }
    }

    /*
        $('#search').select2({
            language: "fr",
            placeholder: 'Rehercher Villages ou Ecoles',
            allowClear: true
        })
    */
    

    //selection ecole ou village sur champ de recherche pour aller se positionner vers la selection
    $(document).on("change", "#search", function () {
        var coords = $(this).val().trim().split(",")
        latitude = parseFloat(coords[0])
        longitude = parseFloat(coords[1])
        map.flyTo([latitude, longitude], 14)
        if (tempPositionMarker) { tempPositionMarker.remove() }
        tempPositionMarker = L.circle([latitude, longitude], {
            radius: 500, //metres
            color: 'green',
            fillColor: 'yellow',
            fillOpacity: 0.3
        })
        tempPositionMarker.bindPopup($(this).text()).openPopup()
        tempPositionMarker.addTo(map)
        tempPositionMarker._path.className.baseVal += 'position-find';
        // Esorina automatique apres 10 seconde ilay marker de recherche
        setTimeout(() => {
            tempPositionMarker.remove()
            tempPositionMarker = null
        }, 10000)
    })
}) // readyfunction
