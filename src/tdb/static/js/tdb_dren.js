$(document).on("ajaxSend", function (event, jqXHR, ajaxSettings) {
    utils.waitmeShow('div-data', 'win8')
})
$(document).on("ajaxComplete", function (event, jqXHR, ajaxSettings) {
    utils.waitmeClose('div-data')
})
$(document).on("ajaxStop", function () {
    utils.waitmeClose('div-data')
})
//mode minimal show pour le menu gauche
/*
$("#accordionSidebar").removeClass("toggled").addClass("toggled")
$(".nav-item .collapse").removeClass("show") //#collapseORS
*/

$(document).ready(async function () {


    $('#btn-apply').click(function () {
        let niveau = parseInt($("#niveau").val())
        let code_dren = parseInt($("#dren").val())
        let dren_name = $("#dren option:selected").text();
        const TEMPLATE_PATH = ["/static/templates_tdb_dren/tdb_dren_n0.html", "/static/templates_tdb_dren/tdb_dren_n1.html", "/static/templates_tdb_dren/tdb_dren_n2.html", "/static/templates_tdb_dren/tdb_dren_n3.html"]
        //if (niveau != 2) { return }
        if (code_dren == 0) { return }
        $(".p-bar-info").removeClass("d-none")
        $("#btn-pdf").addClass("d-none")
        $('#div-data').html("")
        utils.waitmeShow('div-data', 'win8')
        $.get(TEMPLATE_PATH[niveau], function (data) {
            //console.log("template load path : ", TEMPLATE_PATH[niveau])
            $('#div-data').html(eval("data"));
            $(".p-bar-info").addClass("d-none")
            $("#paramModal").modal("hide")
            $("#btn-pdf").removeClass("d-none")
            $("#dren_name").html(dren_name)
            utils.waitmeClose('div-data')
        }).fail(function () {
            console.error(`Error loading ${TEMPLATE_PATH[niveau]}`)
            utils.waitmeClose('div-data')
        })
    })
})