import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import * as L from 'leaflet';
import 'leaflet-textpath';
import 'leaflet-search';

import { ConfigService } from './config.service';

@Injectable({
    providedIn: 'root'
})
export class MapService {

    //-------------------------------------------------------
    // Variables
    //-------------------------------------------------------

    private map!: L.Map;

    private roadLayer?: L.GeoJSON;

    private searchControl: any = null;

    private legend!: L.Control;

    private roadStats = {
        total: 0,
        yes: 0,
        no: 0,
        pending: 0,
        unknown: 0
    };

    //-------------------------------------------------------
    // Constructor
    //-------------------------------------------------------

    constructor(
        private http: HttpClient,
        private config: ConfigService
    ) { }
//-------------------------------------------------------
// Basic Map Methods
//-------------------------------------------------------

getRoadLayer(): L.GeoJSON | undefined {
    return this.roadLayer;
}

setMap(map: L.Map): void {
    this.map = map;
    this.addLegend();
}

getMap(): L.Map {
    return this.map;
}

clearLayer(): void {

    if (this.roadLayer) {
        this.map.removeLayer(this.roadLayer);
        this.roadLayer = undefined;
    }

    if (this.searchControl) {
        this.map.removeControl(this.searchControl);
        this.searchControl = null;
    }

}
//-------------------------------------------------------
// Popup HTML
//-------------------------------------------------------

private createPopupHtml(props: any): string {
    const entrusted = (props.Entrusted ?? '')
        .toString()
        .toLowerCase()
        .trim();

    const showUpc = entrusted === 'yes';
    return `
    <table class="table table-bordered">

        <thead class="table-light">
            <tr>
                <th colspan="2" class="text-center">
                    Project Information
                </th>
            </tr>
        </thead>

        <tbody>

            <tr>
                <th>UID</th>
                <td>${props.UID ?? ''}</td>
            </tr>

            <tr>
                <th>NH Number</th>
                <td>${props.NH_Number ?? ''}</td>
            </tr>

            <tr>
                <th>State</th>
                <td>${props.Chainage_S ?? ''}</td>
            </tr>

            <tr>
                <th>RO</th>
                <td>${props.Chainage_R ?? ''}</td>
            </tr>

            <tr>
                <th>PIU</th>
                <td>${props.Chainage_P ?? ''}</td>
            </tr>

            <tr>
                <th>Length</th>
                <td>${props.LengthInKM ?? ''}</td>
            </tr>

            <tr>
                <th>Entrusted</th>

                <td>
                    <label>
                        <input
                            type="radio"
                            name="entrusted"
                            value="yes"
                            ${entrusted === 'yes' ? 'checked' : ''}
                        >
                        Yes
                    </label>

                    <label class="ms-3">
                        <input
                            type="radio"
                            name="entrusted"
                            value="no"
                            ${entrusted === 'no' ? 'checked' : ''}
                        >
                        No
                    </label>

                    <label class="ms-3">
                        <input
                            type="radio"
                            name="entrusted"
                            value="pending"
                            ${entrusted === 'pending' ? 'checked' : ''}
                        >
                        Pending
                    </label>
                </td>
            </tr>

            <tr
                id="upcRow"
                style="display: ${showUpc ? 'table-row' : 'none'};"
            >
                <th>UPC</th>

                <td>
                    <input
                        id="upc"
                        type="text"
                        class="form-control"
                        value="${showUpc ? (props.UPC ?? '') : ''}"
                    >
                </td>
            </tr>
            <tr>

                <td colspan="2" class="text-center">

                    <button
                        id="btnSave"
                        type="button"
                        class="btn btn-primary">

                        Save

                    </button>
                    <div id="saveStatus" class="text-success mt-2"></div>
                </td>

            </tr>

        </tbody>

    </table>
    `;

}//-------------------------------------------------------
// Save Feature
//-------------------------------------------------------

private saveFeature(
    feature: any,
    layer: L.Layer,
    popup: HTMLElement
): void {

    const entrusted =
        (
            popup.querySelector(
                'input[name="entrusted"]:checked'
            ) as HTMLInputElement
        ).value;

    const upc =(popup.querySelector('#upc')as HTMLInputElement).value;

    this.updateFeature(
        feature.properties.id,
        {
            entrust: entrusted,
            upc: upc
        }
    ).subscribe({

        next: () => {

            feature.properties.UPC = upc;
            feature.properties.Entrusted = entrusted;

            layer.setPopupContent(
                this.createPopupHtml(feature.properties)
            );
            const status = popup.querySelector('#saveStatus') as HTMLElement;

            //alert('Updated Successfully');
            (layer as L.Path).setStyle(
                this.getRoadStyle(feature.properties)
            );
            // Show success message
            if (status) {
                status.innerText = '✔ Updated successfully';
            }

            // Wait before closing
            setTimeout(() => {

                layer.setPopupContent(
                    this.createPopupHtml(feature.properties)
                );

                if ('closePopup' in layer) {
                    (layer as L.Layer & { closePopup(): void }).closePopup();
                }
                        // Focus map on this road
                if (layer instanceof L.Polyline) {

                    this.map.fitBounds(
                        layer.getBounds(),
                        {
                            padding: [50, 50],
                            maxZoom: 16
                        }
                    );

                }

            }, 1500);

        },

        error: (err) => {

            console.error(err);

            alert('Update Failed');

        }

    });

}
    //-------------------------------------------------------
    // Popup Events
    //-------------------------------------------------------

private attachPopupEvents(
    feature: any,
    layer: any
): void {

    layer.on('popupopen', (e: any) => {

        const popup = e.popup.getElement();

        if (!popup) {
            return;
        }
        const entrustedRadios = popup.querySelectorAll(
            'input[name="entrusted"]'
        ) as NodeListOf<HTMLInputElement>;

        const upcRow = popup.querySelector('#upcRow') as HTMLElement;

        const upcInput = popup.querySelector('#upc') as HTMLInputElement;

        const btn = popup.querySelector('#btnSave');

        if (!btn) {
            return;
        }
        entrustedRadios.forEach((radio) => {

            radio.addEventListener('change', () => {

                if (radio.checked && radio.value === 'yes') {

                    // Show UPC
                    upcRow.style.display = 'table-row';

                    // Optional: put cursor directly in UPC
                    upcInput.focus();

                } else if (radio.checked) {

                    // Clear UPC
                    upcInput.value = '';

                    // Hide UPC
                    upcRow.style.display = 'none';
                }

            });

        });
        btn.addEventListener(
            'click',
            () => {
 
                this.saveFeature(
                    feature,
                    layer,
                    popup
                );

            },
            {
                once: true
            }
        );

    });

}
private getRoadStyle(props: any): L.PathOptions {

    const choiceColor: Record<string, string> = {
        yes: '#28a745',
        no: '#fa2c03',
        pending: '#0d6efd',
    };

    const status = (props.Entrusted ?? '')
        .toString()
        .toLowerCase()
        .trim();

    const hasStatus = status in choiceColor;

    return {
        color: choiceColor[status] ?? '#03080d',
        weight: hasStatus ? 5 : 4
    };
}
private addLegend() {

    this.legend = new L.Control({
        position: 'bottomright'
    });

    this.legend.onAdd = () => {

        const div = L.DomUtil.create('div', 'legend');

        div.id = 'roadLegend';

        return div;
    };

    this.legend.addTo(this.map);

    this.updateLegend();
}
private updateLegend() {

    const div = document.getElementById('roadLegend');

    if(!div) return;

    const s = this.roadStats;

    const completed =
        s.yes + s.no + s.pending;

    const percent =
        s.total
        ? (completed * 100 / s.total).toFixed(1)
        : '0';

    div.innerHTML = `
        <h6>NH Entrustment Status</h6>

        <div><span class="legend-line yes"></span>Entrusted <b>${s.yes}</b></div>

        <div><span class="legend-line no"></span>Not Entrusted <b>${s.no}</b></div>

        <div><span class="legend-line pending"></span>Pending <b>${s.pending}</b></div>

        <div><span class="legend-line unknown"></span>Not Updated <b>${s.unknown}</b></div>

        <hr>

        <div>Total Roads : <b>${s.total}</b></div>

        <div>Completion : <b>${percent}%</b></div>
    `;
}

private calculateStats(features: any[]) {

    this.roadStats = {
        total: features.length,
        yes: 0,
        no: 0,
        pending: 0,
        unknown: 0
    };

    features.forEach(f => {

        const status = (f.properties.Entrusted ?? '')
            .toLowerCase()
            .trim();

        switch(status){

            case 'yes':
                this.roadStats.yes++;
                break;

            case 'no':
                this.roadStats.no++;
                break;

            case 'pending':
                this.roadStats.pending++;
                break;

            default:
                this.roadStats.unknown++;
        }

    });

   this.updateLegend();
}

//-------------------------------------------------------
// Display GeoJSON
//-------------------------------------------------------

displayGeoJson(data: any): void {

    this.clearLayer();

    //-------------------------------------------------------
    // Build Search Text
    //-------------------------------------------------------

    data.features.forEach((feature: any) => {

        feature.properties.searchText =
            `${feature.properties.NH_Number ?? ''} ` +
            `${feature.properties.UID ?? ''} ` +
            `${feature.properties.Chainage_P ?? ''} ` +
            `${feature.properties.Chainage_S ?? ''} ` +
            `${feature.properties.Chainage_R ?? ''}`;

    });

    //-------------------------------------------------------
    // Create Layer
    //-------------------------------------------------------

    this.roadLayer = L.geoJSON(data, {

        style:(feature: any)=> this.getRoadStyle(feature.properties),

        onEachFeature: (feature: any, layer: any) => {

            const props = feature.properties;

            //-------------------------------------------------------
            // Tooltip
            //-------------------------------------------------------

            layer.bindTooltip(
                `<b>UID :</b> ${props.UID}<br>
                <b>NH :</b> ${props.NH_Number}`,
                {
                    sticky: true
                }
            );

            //-------------------------------------------------------
            // Hover Highlight
            //-------------------------------------------------------

            layer.on('mouseover', () => {

                layer.setStyle(
                    this.getRoadStyle(feature.properties)
                );

            });

            layer.on('mouseout', () => {

                layer.setStyle(
                    this.getRoadStyle(feature.properties)
                );

            });

            //-------------------------------------------------------
            // Popup
            //-------------------------------------------------------

            layer.bindPopup(
                this.createPopupHtml(props),
                {
                    maxWidth: 450
                }
            );

            //-------------------------------------------------------
            // Attach Save Button Events
            //-------------------------------------------------------

            this.attachPopupEvents(
                feature,
                layer
            );

            //-------------------------------------------------------
            // Click
            //-------------------------------------------------------



        }

    });
    //-------------------------------------------------------
// Add Layer
//-------------------------------------------------------
this.calculateStats(data.features);


this.roadLayer.addTo(this.map);

//-------------------------------------------------------
// Search Control
//-------------------------------------------------------

this.searchControl = new (L.Control as any).Search({

    layer: this.roadLayer,

    propertyName: 'searchText',

    marker: false,

    initial: false,

    zoom: 16,

    moveToLocation: (
        latlng: L.LatLng,
        title: string,
        map: L.Map
    ) => {

        map.setView(latlng, 16);

    }

});

this.map.addControl(this.searchControl);

//-------------------------------------------------------
// Zoom to Layer
//-------------------------------------------------------

if (this.roadLayer.getLayers().length > 0) {

    this.map.fitBounds(
        this.roadLayer.getBounds()
    );

}

}
//-------------------------------------------------------
// API Calls
//-------------------------------------------------------

getRoads(): Observable<any> {

    console.log(this.config.apiUrl);
    return this.http.get(
        `${this.config.apiUrl}/roads`
    );

}

getFilters(): Observable<any> {

    return this.http.get(
        `${this.config.apiUrl}/filters`
    );

}

searchRoad(search: any): Observable<any> {

    return this.http.post(
        `${this.config.apiUrl}/search`,
        search
    );

}

updateFeature(
    id: number,
    data: any
): Observable<any> {

    return this.http.post(
        `${this.config.apiUrl}/feature/${id}`,
        data
    );

}

}