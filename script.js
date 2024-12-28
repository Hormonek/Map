// Inicjalizacja mapy
const map = L.map('map').setView([51.505, -0.09], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Dane użytkownika — zapisane w Local Storage
let places = JSON.parse(localStorage.getItem('places')) || [];
const countryLayerGroup = L.layerGroup().addTo(map);

// Flaga określająca tryb edycji
const isLocal = location.protocol === "file:" || location.hostname === "localhost";
let isEditMode = isLocal;

// Zapis danych do Local Storage
function savePlaces() {
    localStorage.setItem('places', JSON.stringify(places));
}

// Funkcja dodawania pinezki
function addMarker(lat, lng, description = "Brak opisu") {
    const marker = L.marker([lat, lng]).addTo(map).bindPopup(description);

    // Edycja lub usuwanie — tylko w trybie edycji
    if (isEditMode) {
        marker.on('click', function () {
            const action = prompt("Wybierz opcję: [1] Edytuj opis, [2] Usuń pinezkę");
            if (action === "1") {
                const newDescription = prompt("Podaj nowy opis:", description);
                if (newDescription !== null) {
                    marker.setPopupContent(newDescription);
                    const placeIndex = places.findIndex(p => p.lat === lat && p.lng === lng);
                    if (placeIndex !== -1) {
                        places[placeIndex].description = newDescription;
                        savePlaces();
                    }
                }
            } else if (action === "2") {
                map.removeLayer(marker);
                places = places.filter(p => !(p.lat === lat && p.lng === lng));
                savePlaces();
                updateCountryHighlights();
            }
        });
    }

    return marker;
}

// Wczytywanie zapisanych miejsc
function loadPlaces() {
    // Wyświetl wszystkie pinezki
    places.forEach(place => addMarker(place.lat, place.lng, place.description));
    updateCountryHighlights();
}

// Obsługa kliknięć na mapę — tylko w trybie edycji
function onMapClick(e) {
    if (!isEditMode) return;

    const { lat, lng } = e.latlng;
    const description = prompt("Podaj opis dla tego miejsca:");
    if (description) {
        addMarker(lat, lng, description);
        places.push({ lat, lng, description });
        savePlaces();
        updateCountryHighlights();
    }
}

// Aktualizacja podświetlenia krajów
async function updateCountryHighlights() {
    countryLayerGroup.clearLayers();
    const countries = new Set();

    // Pobierz unikalne kody krajów z API Nominatim
    for (const place of places) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${place.lat}&lon=${place.lng}`);
            const data = await response.json();
            if (data.address && data.address.country_code) {
                countries.add(data.address.country_code);
            }
        } catch (error) {
            console.error("Błąd podczas pobierania danych kraju:", error);
        }
    }

    // Pobierz geometrie krajów i dodaj je do warstwy
    for (const countryCode of countries) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=geojson&countrycodes=${countryCode}&polygon_geojson=1`);
            const geoData = await response.json();

            if (geoData.features) {
                geoData.features.forEach(feature => {
                    L.geoJSON(feature.geometry, {
                        style: {
                            color: "#3388ff",
                            weight: 2,
                            opacity: 0.65,
                            fillColor: "#3388ff",
                            fillOpacity: 0.2,
                        },
                    }).addTo(countryLayerGroup);
                });
            }
        } catch (error) {
            console.error(`Błąd podczas rysowania kraju ${countryCode}:`, error);
        }
    }
}

// Włączanie/wyłączanie trybu edycji
function setMode(editMode) {
    isEditMode = editMode;
    if (editMode) {
        map.on('click', onMapClick);
        alert("Tryb edycji włączony.");
    } else {
        map.off('click', onMapClick);
        alert("Tryb podglądu włączony.");
    }
}

// Ustaw tryb działania
if (isLocal) {
    setMode(true); // Lokalnie włącz tryb edycji
} else {
    setMode(false); // Publicznie tylko podgląd
}

// Wczytaj miejsca przy uruchomieniu
loadPlaces();
