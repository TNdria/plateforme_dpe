$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('div-map', 'win8')
});
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('div-map')
});
$(document).on("ajaxStop", function () {
    utils.waitmeClose('div-map')
})

const etabGroupNames = ['layer_etabN0S0', 'layer_etabN1S0', 'layer_etabN2S0', 'layer_etabN3S0']
// Créez les groupes d'etablissements et regroupé dans un layerGroup
for (let groupName of etabGroupNames) {
    window[groupName] = new L.layerGroup()
    window[groupName].options.name = groupName
    window[groupName].options.id = groupName.substr(-4)
}
window['map'] = null
window['shp_dren'] = null
window['shp_cisco'] = null
window['shp_commune'] = null
window["heatLayer"] = null
const DEFAULT_DATAVIZ_NIVEAU = 1

$(document).ready(async function () {
    utils.waitmeClose('div-map')

    //initialiser le slider
    initSliderValue = async function (){
        const slider = document.getElementById('slider');
        const minValue = document.getElementById('minValue');
        const maxValue = document.getElementById('maxValue');
        noUiSlider.create(slider, {
            start: [10, 30], 
            connect: true,  
            range: {'min': 0,'max': 100},
            step: 1         
        });

        slider.noUiSlider.on('update', function (values, handle) {
            minValue.textContent = Math.round(values[0]);
            maxValue.textContent = Math.round(values[1]);
            $(".minL").html(Math.round(values[0]))
            $(".maxL").html(Math.round(values[1]))
        });
    }
    
    initSliderValue()
    
    var OVER_LAYERS = {}
    var CTRL_AIRE = null
    //les styles
    const STYLE_DREN = { fillColor: '#4e73df', color: '#4e73df', weight: 1, opacity: 1, fillOpacity: 0.02 }
    const STYLE_CISCO = { fillColor: '#22afbe', color: '#22afbe', weight: 1, opacity: 1, fillOpacity: 0.05 }

    const getBaseLayer = async () => {
        url_dren = `layerDren/`
        url_cisco = `layerCisco/`
        $.ajax({
            url: url_dren,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
        }).done(async function (data1) {
            l1 = data1[0].shape
            //console.log(l1)
            window['shp_dren'] = L.geoJSON(l1, {
                style: STYLE_DREN,
                onEachFeature: (feature, layer) => {
                    layer.on({
                       contextmenu: function (e) {
                            new Contextual({
                                isSticky: false,
                                items: [
                                    {
                                        label: '<i class="fa fa-map text-white" ></i>&nbsp;Carte par Commune', onClick: () => {
                                            updateStyleLayerCommune(e,feature.properties.CODE)
                                        }
                                    },
                                    { type: 'seperator' },
                                    {
                                        label: '<i class="fa fa-map-marker text-white" ></i>&nbsp;Carte des Etablissement', onClick: () => {
                                            show_carte_etablissement(e,feature.properties.CODE)
                                        }
                                    },
                                    { type: 'seperator' }
                                ]
                            })
                        }
                    })
                    layer.bindTooltip(`DREN ${feature.properties.NAME}`,
                        {
                            className: 'custom-tooltip',
                            permanent: false,
                            opacity: 1,
                            direction: 'top',
                        }
                    )
                }
            })

            await window['shp_dren'].addTo(map)
            //rehefa azo ny couche dren dia alaina indray ny couche cisco
            $.ajax({
                url: url_cisco,
                type: 'GET',
                headers: { 'Access-Control-Allow-Origin': '*' },
            }).done(async function (data2) {
                l2 = data2[0].shape
                window['shp_cisco'] = L.geoJSON(l2, {
                    style: STYLE_CISCO,
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            contextmenu: function (e) {
                                new Contextual({
                                    isSticky: false,
                                    items: [
                                        {
                                            label: '<i class="fa fa-map text-white" ></i>&nbsp;Carte par Commune', onClick: () => {
                                                updateStyleLayerCommune(e,feature.properties.CODE)
                                            }
                                        },
                                        { type: 'seperator' },
                                        {
                                            label: '<i class="fa fa-map-marker text-white"></i>&nbsp;Carte des Etablissement', onClick: () => {
                                               show_carte_etablissement(e,feature.properties.CODE)
                                            }
                                        },
                                        { type: 'seperator' }
                                    ]
                                })
                            }
                        })
                        layer.bindTooltip(`CISCO ${feature.properties.NAME}`,
                            {
                                className: 'custom-tooltip',
                                permanent: false,
                                opacity: 1,
                                direction: 'top',
                            }
                        )
                    }
                })

                //await window['shp_cisco'].addTo(map) 

            })
        }).fail(function (jqXHR, textStatus) {
            console.log("Erreur loading layer DREN et CISCO : " + textStatus);
        })

        
    }// get_base_layer

  
    const initMap = async () => {
            $("#div-map").html(`<div id="map" style = "height: 100vh;"></div >`)
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
            const BASE_LAYER = {
                "DEFAULT": DEFAULT_LAYER,
                "OSM": OSM_LAYER,
                "MAPBOX": MAP_BOX,
            }

            map.flyTo([-18.91891771052786, 47.51385211944581], 6)
        L.easyButton('fas fa-redo-alt fa-lg  init', function (btn, map) {
            clearLayers()
            window['shp_dren'].addTo(map)
            window['shp_cisco'].addTo(map)
            if (map.hasLayer(window['shp_dren'])) {
                map.fitBounds(window['shp_dren'].getBounds())
            } else if (map.hasLayer(window['shp_cisco'])) {
                map.fitBounds(window['shp_cisco'].getBounds())
            }
            $("#chk_cisco").prop("checked", true)
                
        }, 'Reinitialiser', 'init').addTo(map)
        
            var legend = L.control({ position: 'bottomright' })
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'legend')
                div.innerHTML += '<p style="font-size: 16px;"><strong><u>Légende</u><strong></p>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#ffffff"></i>&nbsp;Inférieur à <span class="minL">0</span></br>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#00aa00"></i>&nbsp;[<span class="minL">0</span> - <span class="maxL">0</span> ]</br>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#ff0000"></i>&nbsp;Supérieur à <span class="maxL">0</span></br>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#4e73df"></i>&nbsp;Limite DREN</br>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#22afbe"></i>&nbsp;Limite CISCO</br>'
                div.innerHTML += '&nbsp;<i class="fa fa-square" style="color:#c0c0c0"></i>&nbsp;Limite Commune</br>'
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

        window['layerControl'] = L.control.layers(BASE_LAYER, {}, { position: 'topright', collapsed: false })
        window['layerControl'].addTo(map)

        //Control d'affichage couche DREN / CISCO / ETAB
        CTRL_AIRE = L.control({ position: 'topright' })
        CTRL_AIRE.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'control-aire')
            div.innerHTML += '<input id="chk_dren" class="ctrl_shp" type="radio" name="std" checked />&nbsp;DREN</br>'
            div.innerHTML += '<input id="chk_cisco" class="ctrl_shp" type="radio" name="std"  />&nbsp;CISCO</br>'
            div.innerHTML += '<input id="chk_commune" class="ctrl_shp d-none" type="radio" name="std"/>&nbsp;Commune</br>'
            div.innerHTML += '<input id="chk_etab" class="ctrl_shp d-none" type="checkbox"  />&nbsp;Ecole</br>'
            L.DomEvent.disableClickPropagation(div)
            return div
        }

        CTRL_AIRE.addTo(map)
        $(".control-aire").css("width", "97px")

        $(document).on("click", ".ctrl_shp", async function () {
            if ($(this).prop("checked")) {
                if ($(this).attr("id") == "chk_dren") {
                    window['shp_cisco'].remove()
                    window['shp_dren'].remove()
                    if (window['shp_commune']) { window['shp_commune'].remove() }
                    await window['shp_dren'].addTo(map)
                    map.fitBounds(window['shp_dren'].getBounds())
                }
                if ($(this).attr("id") == "chk_cisco") {
                    window['shp_cisco'].remove()
                    window['shp_dren'].remove()
                    if (window['shp_commune']) { window['shp_commune'].remove() }
                    await window['shp_cisco'].addTo(map)
                    map.fitBounds(window['shp_cisco'].getBounds())
                }
                if ($(this).attr("id") == "chk_commune") {
                    window['shp_cisco'].remove()
                    window['shp_dren'].remove()
                    await window['shp_commune'].addTo(map)
                    map.fitBounds(window['shp_commune'].getBounds())
                }
                if ($(this).attr("id") == "chk_etab") {
                    if (window[`layer_etabN1S0`]) {
                        window[`layer_etabN1S0`].addTo(map)
                    }
                }
                
            } else {
                if ($(this).attr("id") == "chk_etab"){
                    if (window[`layer_etabN1S0`]) {
                        window[`layer_etabN1S0`].remove()
                    }
                }
            }
        })


        utils.waitmeClose('div-map')

    } //iniMap


    $(document).on("change", "#theme", function () {
        updateMinMaxFilterValue();
        $(this).val() == "0" ? $(".filter-key").addClass("d-none") : $(".filter-key").removeClass("d-none")

    })


    const clearLayers = function () {
        if (window['shp_dren']) {window['shp_dren'].remove()}
        if (window['shp_cisco']) { window['shp_dren'].remove() }
        if (window['shp_commune']) { window['shp_commune'].remove() }
        if (window["heatLayer"]){window["heatLayer"].remove()}
        if (window["layer_etabN1S0"]){window["layer_etabN1S0"].remove()}
    }


    $(document).on("click", "#btn-filter", async function () {
        
        if ($("#theme").val() == "hm") {renderHeatmap();return}
        updateStyleLayer()
       
    })

    updateMinMaxFilterValue = async function () {
        indKey = $("#theme").val()
        switch (indKey) {
            case 'hm':
                newRange = { 'min': 1, 'max': 1 }
                newStart = [1, 1]
                break
            case 'rem':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [25, 50]
                break
            case 're-sdc':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [25, 60]
                break
            case 'ratio-pa':
                newRange = { 'min': 0, 'max': 10 }
                newStart = [0, 1]
                break
            case 'elec':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [50, 75]
                break
            case 'eau':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [50, 75]
                break
            case 'exist-lat-g':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'exist-lat-f':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'exist-lat':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'ens-f':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'ens-fsub':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'ens-fnsub':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [30, 60]
                break
            case 'ens-q':
                newRange = { 'min': 0, 'max': 100 }
                newStart = [35, 75]
                break
            case 'extra-ens':
                newRange = { 'min': 0, 'max': 20 }
                newStart = [1, 2]
                break
            default:
                newRange = { 'min': 0, 'max': 100 }
                newStart = [25, 75]
        }
        slider.noUiSlider.updateOptions({
            range: newRange
        });
        slider.noUiSlider.set(newStart);
    } // updateMinMax   



    // Fonction principale pour récupérer et préparer les données de la couche
    const create_heatmap_n1 = async () => {
        const url = 'layerHeatmapEtabN1/';
        const markers = [];
        
        try {
            // Afficher l'indicateur de chargement une seule fois
            utils.waitmeShow('div-map', 'win8');
            
            // Récupérer les données
            const data = await utils.fetchData(url, 'GET', {});
            
            // Récupérer les bornes du slider une seule fois
            const [minBound, maxBound] = slider.noUiSlider.get();
            
            // Traiter chaque établissement
            data.forEach(etab => {
                const latitude = parseFloat(etab.latitude);
                const longitude = parseFloat(etab.longitude);
                
                if (!isNaN(latitude) && !isNaN(longitude)) {
                    //const intensity = calculateIntensity(etab, minBound, maxBound);
                    const intensity = 1.0
                    markers.push([latitude, longitude, intensity]);
                }
            });
            
            //console.log('Markers générés :', markers);
            return markers;
        } catch (error) {
            console.error('Erreur lors de la création de la couche EtabN1 :', error);
            return [];
        } finally {
            // Fermer l'indicateur de chargement
            utils.waitmeClose('div-map');
        }
    };

    // Calcul de l'intensité en fonction du ratio et des bornes
    const calculateIntensity = (etab, minBound, maxBound) => {
        const theme = $("#theme").val();
        let ratio;

        switch (theme) {
            case 'rem':
                ratio = parseFloat(etab.eff_2025) / parseFloat(etab.en_classe) || 0;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 're-sdc':
                const sdc = parseFloat(etab.sdc_be) + parseFloat(etab.sdc_me);
                ratio = sdc === 0 ? 0 : parseFloat(etab.eff_2025) / sdc;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'ratio-pa':
                ratio = parseInt(etab.places) === 0 ? 0 : parseFloat(etab.eff_2025) / parseFloat(etab.places);
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'elec':
                return clamp(parseFloat(etab.elec) || 0, 0, 1);
            
            case 'eau':
                return clamp(parseFloat(etab.point_eau) || 0, 0, 1);
            
            case 'exist-lat':
                const latrines = parseInt(etab.latrince_g) * 3; // Corrigé : répétition dans ton code
                return latrines > 0 ? 1 : 0;
            
            case 'ens-f':
                ratio = (parseInt(etab.fonctionnaire) / parseFloat(etab.total_pers)) * 100 || 0;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'ens-fsub':
                ratio = (parseInt(etab.fram_sub) / parseFloat(etab.total_pers)) * 100 || 0;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'ens-fnsub':
                ratio = (parseInt(etab.fram_nonsub) / parseFloat(etab.total_pers)) * 100 || 0;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'ens-q':
                ratio = (parseInt(etab.qualifiee) / parseFloat(etab.total_pers)) * 100 || 0;
                return normalizeIntensity(ratio, minBound, maxBound);
            
            case 'extra-ens':
                const sdcExtra = parseFloat(etab.sdc_be) + parseFloat(etab.sdc_me);
                ratio = parseInt(etab.en_classe) - (sdcExtra * 2);
                return normalizeIntensity(ratio, minBound, maxBound);
            
            default:
                return 0.5; // Valeur par défaut
        }
    };

    // Normaliser l'intensité entre 0 et 1 selon les bornes
    const normalizeIntensity = (ratio, minBound, maxBound) => {
        if (isNaN(ratio)) return 0;
        if (ratio < minBound) return 0;
        if (ratio > maxBound) return 1;
        return 0.5; // Entre les bornes
    };

    // Limiter une valeur entre 0 et 1
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    //utilisation avec Leaflet.heat
    renderHeatmap = async () => {
        clearLayers()
        const markers = await create_heatmap_n1();
        //console.log(markers)
        if (markers.length === 0) return;
        window["heatLayer"] = L.heatLayer(markers, {
            radius: 10,
            blur: 5,
            maxZoom: 18,
            gradient: {
                /*0.0: '#FFFFFF',   // Intensité faible*/
                1.0: '#0000FF'     // Intensité élevée
            }
        }).addTo(map)

        const bounds = L.latLngBounds(markers.map(m => [m[0], m[1]]));
        map.fitBounds(bounds);
    };

    const getDataDren = async function () {
        const url = `getDataDren/${DEFAULT_DATAVIZ_NIVEAU}/`;
        try {
            // Afficher l'indicateur de chargement une seule fois
            utils.waitmeShow('div-map', 'win8');
            // Récupérer les données
            const data = await utils.fetchData(url, 'GET', {});
            return data;
        } catch (error) {
            console.error('Erreur lors de la création données DREN :', error);
            return [];
        } finally {
            // Fermer l'indicateur de chargement
            utils.waitmeClose('div-map');
        }
    }
    const getDataCisco = async function () {
        const url = `getDataCisco/${DEFAULT_DATAVIZ_NIVEAU}/`;
        try {
            // Afficher l'indicateur de chargement une seule fois
            utils.waitmeShow('div-map', 'win8');
            // Récupérer les données
            const data = await utils.fetchData(url, 'GET', {});
            return data;
        } catch (error) {
            console.error('Erreur lors de la création données CISCO :', error);
            return [];
        } finally {
            // Fermer l'indicateur de chargement
            utils.waitmeClose('div-map');
        }
    }
    const getDaCommune = async function (code_cisco) {
        const url = `getDataCommune/${code_cisco}/${DEFAULT_DATAVIZ_NIVEAU}/`;
        try {
            // Afficher l'indicateur de chargement une seule fois
            utils.waitmeShow('div-map', 'win8');
            // Récupérer les données
            const data = await utils.fetchData(url, 'GET', {});
            return data;
        } catch (error) {
            console.error('Erreur lors de la création données COMMUNE :', error);
            return [];
        } finally {
            // Fermer l'indicateur de chargement
            utils.waitmeClose('div-map');
        }
    }

    const updateStyleLayer = async function (){
        const dataDren = await getDataDren();
        const dataCisco = await getDataCisco();
        
        const ptg = $("#theme").find(":selected").text().toLowerCase().includes("pourcentage") ? "%" : ""
        clearLayers()
        dataDren.forEach((dren) => {
            //console.log(parseInt(dren.CODE_DREN))
            window['shp_dren'].eachLayer(function (layer) {
                if (layer.feature.properties && layer.feature.properties.CODE == parseInt(dren.CODE_DREN)) {
                    ratio = calculateRatio(dren)
                    color = getColor(ratio)
                    //console.log(dren.CODE_DREN,"==>",ratio)
                    layer.setStyle({
                        fillColor:color,
                        fillOpacity:1
                    });
                    t = `${layer.feature.properties.NAME} : ${ratio.toFixed(1)}${ptg}`
                    layer.bindTooltip(t, { permanent: false })
                    layer.bindPopup(t)
                }
            })
        })
        window['shp_dren'].addTo(map)
        map.fitBounds(window['shp_dren'].getBounds())
        dataCisco.forEach((cisco) => {
            //console.log(parseInt(dren.CODE_DREN))
            window['shp_cisco'].eachLayer(function (layer) {
                if (layer.feature.properties && layer.feature.properties.CODE == parseInt(cisco.CODE_CISCO)) {
                    ratio = calculateRatio(cisco)
                    color = getColor(ratio)
                    layer.setStyle({
                        fillColor:color,
                        fillOpacity:1
                    });
                    t = `${layer.feature.properties.NAME} : ${ratio.toFixed(1)}${ptg}`
                    layer.bindTooltip(t, { permanent: false })
                    layer.bindPopup(t)
                }
            })

        })

        $("#chk_dren").prop("checked", true)
        $("#chk_commune").addClass("d-none")
        $("#chk_etab").addClass("d-none")

    }

    const updateStyleLayerCommune = async function (e, code) {
        if ($("#theme").val() == 0) {
            utils.msgBox("ATTENTION", "Veuillez choisir un theme", "error")
            return
        }
        const ptg = $("#theme").find(":selected").text().toLowerCase().includes("pourcentage") ? "%" : ""
        await show_carte_commune(e,code)
        const dataCommune = await getDaCommune(code);
        dataCommune.forEach((c) => {
            //console.log(parseInt(dren.CODE_DREN))
            window['shp_commune'].eachLayer(function (layer) {
                if (layer.feature.properties && layer.feature.properties.CODE == parseInt(c.CODE_COMMUNE)) {
                    ratio = calculateRatio(c)
                    color = getColor(ratio)
                    layer.setStyle({
                        fillColor:color,
                        fillOpacity:1
                    });
                    t = `${layer.feature.properties.NAME} : ${ratio.toFixed(1)}${ptg}`
                    layer.bindTooltip(t, { permanent: false })
                    layer.bindPopup(t)
                }
            })

        })
    }

    // Normaliser l'intensité entre 0 et 1 selon les bornes
    const getColor = (ratio) => {
        const [minBound, maxBound] = slider.noUiSlider.get();
        if (isNaN(ratio)) return 0;
        if (ratio < minBound) return '#FFFFFF';
        if (ratio > maxBound) return '#FF0000';
        return '#00AA00'; // entre les bornes
    };
    const calculateRatio = (data) => {
        const theme = $("#theme").val();
        let ratio;
        switch (theme) {
            case 'rem':
                ratio = parseFloat(data.eff_2025) / parseFloat(data.en_classe) || 0;
                return ratio
            
            case 're-sdc':
                const sdc = parseFloat(data.sdc_be) + parseFloat(data.sdc_me);
                ratio = sdc === 0 ? 0 : parseFloat(data.eff_2025) / sdc;
               return ratio
            
            case 'ratio-pa':
                ratio = parseInt(data.places) === 0 ? 0 : parseFloat(data.eff_2025) / parseFloat(data.places);
                return ratio
            
            case 'elec':
                ratio = Math.round(parseFloat(data.elec) / parseFloat(data.nbr_etab) * 100)
                return ratio
            
            case 'eau':
                ratio = Math.round(parseFloat(data.eau) / parseFloat(data.nbr_etab) * 100)
                return ratio
            
            case 'exist-lat-g':
                ratio = Math.round(parseInt(data.latrine_g) / parseFloat(data.nbr_etab) * 100)
                return ratio
            
            case 'exist-lat-f':
                ratio = Math.round(parseInt(data.latrine_f)  / parseFloat(data.nbr_etab) * 100)
                return ratio
            
            case 'exist-lat':
                ratio = Math.round(parseInt(data.latrine) / parseFloat(data.nbr_etab) * 100)
                return ratio
            
            case 'ens-f':
                ratio = (parseInt(data.fonct) / parseFloat(data.pers_total)) * 100 || 0;
                return ratio
            
            case 'ens-fsub':
                ratio = (parseInt(data.fs) / parseFloat(data.pers_total)) * 100 || 0;
                return ratio
            
            case 'ens-fnsub':
                ratio = (parseInt(data.fns) / parseFloat(data.pers_total)) * 100 || 0;
                return ratio
            
            case 'ens-q':
                ratio = (parseInt(data.qualifiee) / parseFloat(data.pers_total)) * 100 || 0;
                return ratio
            
            case 'extra-ens':
                const sdcExtra = parseFloat(data.sdc_be) + parseFloat(data.sdc_me);
                ratio = parseInt(data.en_classe) - (sdcExtra * 2);
                return ratio
            
            default:
                return 0; // Valeur par défaut
        }
    };

    //creation des markers pour les etablissements niveau 1 par code_dren ou code_cisco
    const create_markers_n1 = async (code) => {
        const ptg = $("#theme").find(":selected").text().toLowerCase().includes("pourcentage") ? "%" : ""
        const url = `getDataEtab/${code}/${DEFAULT_DATAVIZ_NIVEAU}/`;
        let markers = []
        try {
            // Afficher l'indicateur de chargement une seule fois
            utils.waitmeShow('div-map', 'win8');
            
            // Récupérer les données
            const data = await utils.fetchData(url, 'GET', {});
            // Récupérer les bornes du slider une seule fois
            const [minBound, maxBound] = slider.noUiSlider.get();
            // Traiter chaque établissement
            data.forEach(etab => {
                const latitude = parseFloat(etab.latitude);
                const longitude = parseFloat(etab.longitude);
                if (!isNaN(latitude) && !isNaN(longitude)) {
                    const ratio = calculateRatio(etab)
                    color = getColor(ratio)
                    icon = L.divIcon({
                        className: 'custom-icon',
                        iconSize: [20, 20],
                        html: `<i class= "fa fa-circle" style="color:${color}"></i>`
                    })
                    properties = {NAME:etab.NOM_ETAB,RATIO:ratio}
                    latlng = [latitude,longitude]
                    marker = L.marker(latlng, {
                        properties: etab,
                        draggable: false,
                        icon: icon
                    })
                    t = `${etab.NOM_ETAB} : ${ratio.toFixed(1)}${ptg}`
                    marker.bindTooltip(t, { permanent: false, direction:'top' })
                    marker.bindPopup(t)
                    markers.push(marker)

                }
            })
            
            //console.log('Markers générés :', markers);
            return markers;
        } catch (error) {
            console.error('Erreur lors de la création de la couche Ecoles Primaire :', error);
            return [];
        } finally {
            // Fermer l'indicateur de chargement
            utils.waitmeClose('div-map');
        }
    }
    const show_carte_etablissement = async (e, code) => {
        if ($("#theme").val() == 0) {
            utils.msgBox("ATTENTION", "Veuillez choisir un theme", "error")
            return
        }
        show_carte_commune(e,code)
        window['shp_dren'].remove()
        window['shp_cisco'].remove()
        
        $("#chk_commune").prop("checked",true)
        const markers = await create_markers_n1(code)
        markers.forEach(marker => {
            window["layer_etabN1S0"].addLayer(marker)
        })
        window["layer_etabN1S0"].addTo(map)
        $("#chk_etab").removeClass("d-none")
        $("#chk_etab").prop("checked",true)
        map.fitBounds(e.target.getBounds())
    }

    const show_carte_commune = async (e, code) => {
        const STYLE_COMMUNE = { fillColor: '#c0c0c0', color: '#c0c0c0', weight: 2, opacity: 1, fillOpacity: 0.03 }
        url_layer_commune = `layerCommune/${code}`
        $.ajax({
            url: url_layer_commune,
            type: 'GET',
            headers: { 'Access-Control-Allow-Origin': '*' },
        }).done(async function (data) {
            l1 = data[0].shape
            window['shp_commune'] = L.geoJSON(l1, {
                style: STYLE_COMMUNE,
                onEachFeature: (feature, layer) => { 
                    layer.bindTooltip(`COMMUNE ${feature.properties.NAME}`,
                        {
                            className: 'custom-tooltip',
                            permanent: false,
                            opacity: 1,
                            direction: 'top',
                        }
                    )
                }
            })
            window['shp_dren'].remove()
            window['shp_cisco'].remove()
            window['shp_commune'].addTo(map)
            $("#chk_commune").prop("checked",true)
            $("#chk_commune").removeClass("d-none")
        })
        map.fitBounds(e.target.getBounds())
    }


    //
    //appel de tous les initialisations
    await initMap()
    await getBaseLayer()

})