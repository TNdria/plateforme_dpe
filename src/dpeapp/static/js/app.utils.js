
const utils = {
	//BASE_URL: 'https://102.16.134.116:8210/',
	BASE_URL: 'http://127.0.0.1:8000/',
	isNumber: (n) => {
		return !isNaN(parseFloat(n)) && isFinite(n)
	},
	showModal: (title, message, status) => {
		$("#msgTitle").html(title)
		$("#msgBody").html(message)
		$("#msgBody").attr('class', `alert-${status}`)
		//$("#msgBody").removeClass(`alert-${status}`).addClass(`alert-${status}`)
		$("#app-dialog").modal("show")
		//$(document).on("click",".quit-app-modal",()=>{$("#app-dialog").modal("hide"); alert(message)})
	},
	msgBox: (title, message, icon) => {
		Swal.fire({
			title: title,
			text: message,
			icon: icon,
			onOpen: function () {
				document.querySelector(".swal-overlay").style.zIndex = 99999999;
			},
			allowOutsideClick: false
		})
		return
	},
	waitmeShow: (container, effect) => {
		$(`#${container}`).waitMe({
			effect: effect, //stretch win8
			text: '',
			color: '#000',
			maxSize: '',
			waitTime: -1,
			textPos: 'vertical',
			fontSize: '',
			source: '',
			onClose: function () { }
		})
	},
	waitmeClose: (container) => {
		$(`#${container}`).waitMe('hide')
	},
	capitalizeFirstLetter: (str) => {
		//return str.charAt(0).toUpperCase() + str.slice(1);
		return str.replace(/\b\w/g, char => char.toUpperCase());

	},
	
	toUniqueListe: (arr, id) => {
		const seenIds = new Set()
		return arr.filter(obj => {
			if (seenIds.has(obj[id])){
				return false
			} else {
				seenIds.add(obj[id])
				return true
			}
		})
	},
	//convertir des objets array en fichier csv, ie: convertir chaque élément d'un array en fichier texte séparer par des ";"
    convertObjectToCSV : async function (data) {
        const headers = Object.keys(data[0]);
        let csvContent = headers.join(';') + '\n';
        data.forEach(item => {
            const row = headers.map(header => item[header] || '');
            csvContent += row.join(';') + '\n';
        });
        return csvContent;
	},
    // function pour lancer le téléchargement des contenues csv
    downloadCSV : async (csvContent, link_download) => {
        csvContent.then(content => {
            if (typeof content === 'string') {
                const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = link_download;
                link.click();
            }
        })

    },
	//recuperation fecth des layers sur postgis
	fetchData: async function (url, type = 'GET', data = null, successCallback, errorCallback) {
		utils.waitmeShow('content-page', 'win8');
		return $.ajax({
			url: url,
			type: type,
			headers: { 'Access-Control-Allow-Origin': '*' },
			data: data,
			success: function (response) {
				utils.waitmeClose('content-page');
				if (successCallback) {
					successCallback(response)
				}
			},
			error: function (xhr, status, error) {
				utils.waitmeClose('content-page')
				if (errorCallback) {
					errorCallback(status, error);
				}
			}
		});
	},
	captureScreen : async function(image_name) {
		try {
			// Demander la permission de capturer l'écran
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true
			});
			
			// Créer un élément vidéo temporaire
			const video = document.createElement('video');
			video.srcObject = stream;
			
			// Attendre que la vidéo soit prête
			await new Promise(resolve => {
				video.onloadedmetadata = () => {
					video.play();
					resolve();
				};
			});
			
			// Créer un canvas pour dessiner l'image
			const canvas = document.createElement('canvas');
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			
			// Convertir en PNG et télécharger
			const imageData = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.download = image_name;
			link.href = imageData;
			link.click();
			
			// Arrêter le flux
			stream.getTracks().forEach(track => track.stop());
		} catch (err) {
			console.error('Erreur lors de la capture :', err);
		}
	},
	captureScreenDom: async function (image_name, dom) {
		const elementToCapture = document.getElementById(`${dom}`);
		html2canvas(elementToCapture).then(canvas => {
			// Convertir le canvas en URL de données
			const imageData = canvas.toDataURL('image/png');
			
			// Créer un lien de téléchargement
			const link = document.createElement('a');
			link.download = image_name;
			link.href = imageData;
			link.click();dom
		});
	}


}