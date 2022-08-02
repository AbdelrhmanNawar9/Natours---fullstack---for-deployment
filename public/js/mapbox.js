/* eslint-disable */

export const displayMap = (locations) => {
  // Style point
  const point_style = new ol.style.Style({
    image: new ol.style.Icon(
      /** @type {olx.style.IconOptions} */ {
        scale: 0.15,
        // x/y
        anchor: [0.5, 0],
        anchorOrigin: 'bottom-left',
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: '/img/pin.png',
      }
    ),
  });

  // Create Map
  const map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
    ],
    // Disable zoom while scrolling the page
    interactions: ol.interaction.defaults({ mouseWheelZoom: false }),
  });

  // Add markers on the map
  // define a layer for the markers
  const vectorLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      className: 'marker',
    }),
  });

  // Add the markers layer (vectorLayer) to the map for the markers
  map.addLayer(vectorLayer);

  function createMarker(lng, lat, data, id) {
    const feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lng, lat])),
      data: data,
      id: id,
    });
    feature.setStyle(point_style);
    return feature;
  }

  // The callback will recieve a pointer move event when there is a pointer move
  map.on('pointermove', function (evt) {
    const hit = this.forEachFeatureAtPixel(
      evt.pixel,
      function (feature, layer) {
        return true;
      }
    );

    if (hit) {
      this.getTargetElement().style.cursor = 'pointer';
    } else {
      this.getTargetElement().style.cursor = '';
    }
  });

  ///////////////

  function createPopupMarkupInDom(index) {
    // Create a document fragment:
    const dFrag = document.createDocumentFragment();

    // Popup for each marker
    const el = document.createElement('div');
    el.className = 'ol-popup';
    el.id = `popup-${index}`;
    el.innerHTML = ` <a href="/" id="popup-closer-${index}" class="ol-popup-closer"></a>
<p id="popup-content-${index}" class="ol-popup-content"></p>`;

    // Add li elements to the fragment:
    dFrag.appendChild(el);

    // Add fragment to DOM
    document.getElementById('map').appendChild(dFrag);

    /**
     * Elements that make up the popup.
     */

    const container = document.getElementById(`popup-${index}`);
    const content = document.getElementById(`popup-content-${index}`);
    const closer = document.getElementById(`popup-closer-${index}`);

    return { container, content, closer };
  }

  // Add markers to vectorLayer (markers layer)
  for (let i = 0; i < locations.length; i++) {
    // create a mark
    const lng = locations[i].coordinates[0];
    const lat = locations[i].coordinates[1];
    vectorLayer.getSource().addFeature(createMarker(lng, lat, locations[i], i));

    // Create overlay for the marker
    // create mark up
    const { container, content, closer } = createPopupMarkupInDom(i);
    content.innerHTML = `Day ${locations[i].day}: ${locations[i].description}`;

    // Create an overlay to anchor the popup to the map.
    const overlay = new ol.Overlay({
      element: container,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    });

    overlay.setPosition(ol.proj.fromLonLat([lng, lat]));
    // Add the overlay to the map
    map.addOverlay(overlay);

    // Will work because of closure closure
    closer.onclick = function () {
      container.style.display = 'none';
      // overlay.setPosition(undefined);
      closer.blur();
      return false;
    };
  }

  // Handle clicks on markers
  map.on('click', function (evt) {
    let point;

    const hit = this.forEachFeatureAtPixel(
      evt.pixel,
      function (feature, layer) {
        console.log('marker clicked');
        point = feature.A;
        return true;
      }
    );

    if (hit) {
      console.log('hit');
      console.log({ id: point.id });
      document.getElementById(`popup-${point.id}`).style.display = 'block';
    }
  });

  //  get the boundries(extent) for all the markers in vectorLayer
  // extent is an array of numbers representing an extent: [minx, miny, maxx, maxy].
  const extent = vectorLayer.getSource().getExtent();
  // Set the map view to extent (markers boundries)
  map.getView().fit(extent, {
    size: map.getSize(),
    maxZoom: 12,
    minZoom: 4,
    padding: [180, 250, 120, 150],
  });
};
