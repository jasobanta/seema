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

    // -------------------------------------------------------
    // Map and layer state
    // -------------------------------------------------------

    private map!: L.Map;
    private roadLayer?: L.GeoJSON;
    private searchControl: any = null;
    private legend?: L.Control;

    // The side panel is managed by this service as requested.
    private sidePanel?: HTMLElement;
    // Keep the loaded features so statistics can be recalculated.
    private features: any[] = [];

    private roadStats = {
        total: 0,
        yes: 0,
        no: 0,
        pending: 0,
        unknown: 0
    };

    // -------------------------------------------------------
    // Constructor
    // -------------------------------------------------------

    constructor(
        private http: HttpClient,
        private config: ConfigService
    ) { }

    // -------------------------------------------------------
    // Basic map methods
    // -------------------------------------------------------

    getRoadLayer(): L.GeoJSON | undefined {
        return this.roadLayer;
    }

    setMap(map: L.Map): void {
        this.map = map;
        this.addLegend();
        this.createSidePanel();
    }

    getMap(): L.Map {
        return this.map;
    }

    clearLayer(): void {
        this.closeSidePanel();

        if (this.roadLayer && this.map) {
            this.map.removeLayer(this.roadLayer);
            this.roadLayer = undefined;
        }

        if (this.searchControl && this.map) {
            this.map.removeControl(this.searchControl);
            this.searchControl = null;
        }

        this.features = [];
    }

    // -------------------------------------------------------
    // HTML safety helper
    // -------------------------------------------------------

    private escapeHtml(value: any): string {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
    }

private renderUploadedFile(props: any): string {
    const fileUrl = props.FineUrl;
    const fileName = props.FineFileName || 'Open uploaded file';

    if (!fileUrl) {
        return `
            <div class="mb-3" id="uploadedFileSection">
                <small class="text-muted">No file uploaded yet.</small>
            </div>
        `;
    }

    const extension = fileName.split('?')[0].split('.').pop()?.toLowerCase() || '';

    const fileType = extension === 'pdf'
        ? 'PDF Document'
        : extension === 'kml'
            ? 'KML Map File'
            : extension === 'kmz'
                ? 'KMZ Map File'
                : 'Uploaded File';

    const icon = extension === 'pdf'
        ? 'bi-file-earmark-pdf'
        : 'bi-geo-alt';

    return `
        <div class="mb-3" id="uploadedFileSection">
            <label class="form-label fw-bold">Uploaded Document</label>
            <div class="d-flex align-items-center gap-2">
                <i class="bi ${icon} fs-4"></i>
                <div>
                    <a href="${this.escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">
                        ${this.escapeHtml(fileName)}
                    </a>
                    <div class="small text-muted">${fileType}</div>
                </div>
            </div>
        </div>
    `;
}

    // -------------------------------------------------------
    // Side panel creation
    // -------------------------------------------------------

    private createSidePanel(): void {
        if (!this.map) {
            return;
        }

        const container = this.map.getContainer();

        // Remove an earlier panel if the map is re-initialized.
        this.sidePanel?.remove();

        // The panel is positioned relative to the Leaflet map container.
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const panel = document.createElement('div');
        panel.id = 'roadDetailsPanel';
        panel.setAttribute('role', 'complementary');
        panel.setAttribute('aria-label', 'Road details and entrustment actions');

        Object.assign(panel.style, {
            position: 'absolute',
            top: '0',
            right: '0',
            width: '410px',
            maxWidth: 'min(92%, 410px)',
            height: '100%',
            background: '#ffffff',
            color: '#212529',
            zIndex: '1000',
            overflowY: 'auto',
            boxShadow: '-3px 0 12px rgba(0,0,0,0.20)',
            display: 'none',
            padding: '18px',
            boxSizing: 'border-box',
            fontSize: '14px'
        });

        container.appendChild(panel);
        this.sidePanel = panel;

        // Prevent map drag/zoom/click handlers from receiving panel events.
        L.DomEvent.disableClickPropagation(panel);
        L.DomEvent.disableScrollPropagation(panel);
    }

    // -------------------------------------------------------
    // Side panel HTML
    // -------------------------------------------------------

    private createPanelHtml(props: any): string {
        const entrusted = String(props.Entrusted ?? '')
            .toLowerCase()
            .trim();

        const showUpc = entrusted === 'yes';

        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h5 class="mb-0">Road Details</h5>
                    <small class="text-muted">Highway Entrustment Information</small>
                </div>
                <button
                    id="btnClosePanel"
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    aria-label="Close road details">
                    &times;
                </button>
            </div>

            <hr>

            <h6 class="text-primary">Project Information</h6>

            <table class="table table-sm table-bordered">
                <tbody>
                    <tr>
                        <th style="width: 38%">UID</th>
                        <td>${this.escapeHtml(props.UID)}</td>
                    </tr>
                    <tr>
                        <th>NH Number</th>
                        <td>${this.escapeHtml(props.NH_Number)}</td>
                    </tr>
                    <tr>
                        <th>State</th>
                        <td>${this.escapeHtml(props.Chainage_S)}</td>
                    </tr>
                    <tr>
                        <th>RO</th>
                        <td>${this.escapeHtml(props.Chainage_R)}</td>
                    </tr>
                    <tr>
                        <th>PIU</th>
                        <td>${this.escapeHtml(props.Chainage_P)}</td>
                    </tr>
                    <tr>
                        <th>Length (KM)</th>
                        <td>${this.escapeHtml(props.LengthInKM)}</td>
                    </tr>
                </tbody>
            </table>

            <hr>

            <h6 class="text-primary">Entrustment Information</h6>

            <div class="mb-3">
                <label class="form-label fw-bold">Entrusted Status</label>
                <div class="d-flex flex-wrap gap-3">
                    <label>
                        <input type="radio" name="entrusted" value="yes"
                            ${entrusted === 'yes' ? 'checked' : ''}>
                        Yes
                    </label>
                    <label>
                        <input type="radio" name="entrusted" value="no"
                            ${entrusted === 'no' ? 'checked' : ''}>
                        No
                    </label>
                    <label >
                        <input type="radio" name="entrusted" value="pending"
                            ${entrusted === 'pending' ? 'checked' : ''}>
                        Entrusted (handover pending)
                    </label>
                </div>
            </div>

            <div id="upcRow" class="mb-3"
                style="display: ${showUpc ? 'block' : 'none'}">
                <label for="upc" class="form-label fw-bold">
                    UPC <span class="text-danger">*</span>
                </label>
                <input
                    id="upc"
                    type="text"
                    class="form-control"
                    value="${this.escapeHtml(showUpc ? props.UPC : '')}"
                    ${showUpc ? 'required' : ''}>
            </div>

            <div id="fineRow" class="mb-3"
                style="display: ${entrusted === 'yes' || entrusted === 'no' ? 'block' : 'none'}">
                <label id="fineFileLabel" for="fineFile" class="form-label fw-bold">
                    ${showUpc ? 'Upload KML / KMZ' : 'Upload PDF'} <span class="text-danger">*</span>
                </label>
                <input
                    id="fineFile"
                    type="file"
                    class="form-control"
                    accept="${showUpc ? '.kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz' : '.pdf,application/pdf'}"
                    ${(entrusted === 'yes' || entrusted === 'no') ? 'required' : ''}>
                <small id="fineFileHelp" class="text-muted">
                    ${showUpc ? 'Allowed formats: KML and KMZ' : (entrusted === 'no' ? 'Allowed format: PDF' : 'Select Entrusted status to upload a file')}
                </small>
            </div>
            ${this.renderUploadedFile(props)}
            <div class="mb-3">

                <label for="roadRemark" class="form-label fw-bold">
                    Remarks
                </label>

                <textarea
                    id="roadRemark"
                    class="form-control"
                    rows="4"
                    maxlength="2000"
                    placeholder="Enter remarks regarding road entrustment...">${this.escapeHtml(props.Remark ?? '')}</textarea>

                <small class="text-muted">
                    Maximum 2000 characters
                </small>

            </div>
            <div id="saveStatus" class="mb-2" aria-live="polite"></div>

            <button id="btnSave" type="button" class="btn btn-primary w-100">
                Save Changes
            </button>
        `;
    }

    // -------------------------------------------------------
    // Open side panel and attach its events
    // -------------------------------------------------------

    private openSidePanel(feature: any, layer: L.Layer, clickedAt: L.LatLng): void {
        if (!this.sidePanel) {
            this.createSidePanel();
        }

        if (!this.sidePanel) {
            return;
        }

        const panel = this.sidePanel;
        panel.innerHTML = this.createPanelHtml(feature.properties);
        panel.style.display = 'block';

        // Move the selected road into the visible map area. Since the panel
        // overlays the right side of the map, offset the map view left by
        // half the panel width so the selected line is not hidden underneath it.
        this.focusSelectedRoad(clickedAt, panel);

        panel.querySelector('#btnClosePanel')?.addEventListener('click', () => {
            this.closeSidePanel();
        });

        const radios = panel.querySelectorAll(
            'input[name="entrusted"]'
        ) as NodeListOf<HTMLInputElement>;

        const upcRow = panel.querySelector('#upcRow') as HTMLElement;
        const fineRow = panel.querySelector('#fineRow') as HTMLElement;
        const upcInput = panel.querySelector('#upc') as HTMLInputElement;
        const fineInput = panel.querySelector('#fineFile') as HTMLInputElement;
        const fineFileLabel = panel.querySelector('#fineFileLabel') as HTMLElement;
        const fineFileHelp = panel.querySelector('#fineFileHelp') as HTMLElement;

        const updateFields = (value: string): void => {
            const isYes = value === 'yes';
            const isNo = value === 'no';

            upcRow.style.display = isYes ? 'block' : 'none';
            fineRow.style.display = (isYes || isNo) ? 'block' : 'none';

            upcInput.required = isYes;
            fineInput.required = isYes || isNo;

            // Switch the same file input between KML/KMZ and PDF.
            fineFileLabel.innerHTML = isYes
                ? 'Upload KML / KMZ <span class="text-danger">*</span>'
                : 'Upload PDF <span class="text-danger">*</span>';
            fineInput.accept = isYes
                ? '.kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz'
                : '.pdf,application/pdf';
            fineFileHelp.textContent = isYes
                ? 'Allowed formats: KML and KMZ'
                : 'Allowed format: PDF';

            // Clear a previously selected file when the status changes so a
            // file selected for one status cannot be submitted for the other.
            fineInput.value = '';
            if (!isYes) {
                upcInput.value = '';
            }
        };

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    updateFields(radio.value);
                }
            });
        });

        const selected = panel.querySelector(
            'input[name="entrusted"]:checked'
        ) as HTMLInputElement | null;

        updateFields(selected?.value ?? '');

        panel.querySelector('#btnSave')?.addEventListener('click', () => {
            this.saveFeature(feature, layer, panel);
        });
    }

    // -------------------------------------------------------
    // Pan map to the selected road when the side panel opens
    // -------------------------------------------------------



private focusSelectedRoad(
    clickedAt: L.LatLng,
    panel: HTMLElement
): void {

    if (!this.map) return;

    // Stop any previous map animation
    this.map.stop();

    // Zoom directly to the clicked road location
    const targetZoom = Math.max(this.map.getZoom(), 11);

    this.map.setView(
        clickedAt,
        targetZoom,
        { animate: true }
    );

    // Account for the right-side panel
    const panelWidth = panel.getBoundingClientRect().width;

    // Move the clicked location into the visible map area
    if (panelWidth > 0) {
        this.map.panBy(
            [Math.round(panelWidth / 2), 0],
            { animate: true, duration: 0.5 }
        );
    }
}


    private closeSidePanel(): void {
        if (this.sidePanel) {
            this.sidePanel.style.display = 'none';
        }

    }

    // -------------------------------------------------------
    // Save road feature
    // -------------------------------------------------------

    private saveFeature(
        feature: any,
        layer: L.Layer,
        panel: HTMLElement
    ): void {
        const selectedEntrusted = panel.querySelector(
            'input[name="entrusted"]:checked'
        ) as HTMLInputElement | null;

        if (!selectedEntrusted) {
            alert('Please select Entrusted status.');
            return;
        }

        const entrusted = selectedEntrusted.value;
        const upcInput = panel.querySelector('#upc') as HTMLInputElement;
        const fineInput = panel.querySelector('#fineFile') as HTMLInputElement;
        const remarkInput = panel.querySelector('#roadRemark') as HTMLTextAreaElement;
        const status = panel.querySelector('#saveStatus') as HTMLElement;
        const saveButton = panel.querySelector('#btnSave') as HTMLButtonElement;

        const formData = new FormData();
        formData.append('entrust', entrusted);
        formData.append('remark', remarkInput.value.trim());

        const fineFile = fineInput.files?.[0];

        if (entrusted === 'yes') {
            const upc = upcInput.value.trim();

            if (!upc) {
                alert('Please enter UPC Number.');
                upcInput.focus();
                return;
            }

            if (!fineFile) {
                alert('Please upload a KML or KMZ file.');
                fineInput.focus();
                return;
            }

            if (!/\.(kml|kmz)$/i.test(fineFile.name)) {
                alert('Invalid file type. Please upload a KML or KMZ file.');
                fineInput.focus();
                return;
            }

            formData.append('upc', upc);
            // Keep the multipart field name identical for both statuses.
            formData.append('fine', fineFile, fineFile.name);
        } else if (entrusted === 'no') {
            if (!fineFile) {
                alert('Please upload a PDF file.');
                fineInput.focus();
                return;
            }

            if (!/\.pdf$/i.test(fineFile.name)) {
                alert('Invalid file type. Please upload a PDF file.');
                fineInput.focus();
                return;
            }

            formData.append('upc', '');
            // Same FormData key "fine" is used for PDF uploads as well.
            formData.append('fine', fineFile, fineFile.name);
        }else if (entrusted === 'pending'){
            // do no validation for attachment or number
            const remarkTxt=remarkInput.value.trim();
            if(!remarkTxt){
                alert('Need your remark, Why Entrusted but not handed over yet?')
                remarkInput.focus();
                return;
            } 

        } else {
            alert('Please select a valid Entrusted status.');
            return;
        }

        saveButton.disabled = true;
        status.className = 'text-muted mb-2';
        status.innerText = 'Saving changes...';

        this.updateFeature(feature.properties.id, formData).subscribe({
            next: (response: any) => {

                if (!response?.success) {
                    status.className = 'text-danger mb-2';
                    status.innerText = 'Upload completed, but response was invalid.';
                    saveButton.disabled = false;
                    return;
                }

                // Update the in-memory road properties.
                feature.properties.UPC = entrusted === 'yes'
                    ? upcInput.value.trim()
                    : '';

                feature.properties.Entrusted = entrusted;
                feature.properties.FineUrl = response.fineUrl || '';
                feature.properties.FineDriveId = response.fileId || '';
                feature.properties.FineFileName = response.fileName || '';
                feature.properties.FineFolderId = response.folderId || '';
                feature.properties.Remark = remarkInput.value.trim();

                // Refresh uploaded-file display.
                const fileSection = panel.querySelector(
                    '#uploadedFileSection'
                ) as HTMLElement | null;

                if (fileSection) {
                    fileSection.outerHTML = this.renderUploadedFile(
                        feature.properties
                    );
                }

                // Update road colour.
                if (layer instanceof L.Path) {
                    layer.setStyle(this.getRoadStyle(feature.properties));
                }

                // Refresh map statistics.
                this.calculateStats(this.features);

                status.className = 'text-success mb-2';
                status.innerText = '✔ Updated successfully';

                saveButton.disabled = false;
            },
            error: (err) => {
                console.error('Road update failed:', err);

                status.className = 'text-danger mb-2';
                status.innerText =
                    err?.error?.detail ||
                    err?.error?.message ||
                    'Update failed. Please try again.';

                saveButton.disabled = false;
            }
        });
    }

    // -------------------------------------------------------
    // Road styling
    // -------------------------------------------------------

    private getRoadStyle(props: any): L.PathOptions {
        const choiceColor: Record<string, string> = {
            yes: '#28a745',
            no: '#fa2c03',
            pending: '#0d6efd'
        };

        const status = String(props.Entrusted ?? '')
            .toLowerCase()
            .trim();

        const hasStatus = Object.prototype.hasOwnProperty.call(choiceColor, status);

        return {
            color: choiceColor[status] ?? '#03080d',
            weight: hasStatus ? 5 : 4
        };
    }

    // -------------------------------------------------------
    // Map legend
    // -------------------------------------------------------

    private addLegend(): void {
        if (!this.map) {
            return;
        }

        if (this.legend) {
            this.map.removeControl(this.legend);
        }

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

    private updateLegend(): void {
        if (!this.map) {
            return;
        }

        const div = this.map.getContainer().querySelector(
            '#roadLegend'
        ) as HTMLElement | null;

        if (!div) {
            return;
        }

        const s = this.roadStats;
        const completed = s.yes + s.no + s.pending;
        const percent = s.total
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

    // -------------------------------------------------------
    // Road statistics
    // -------------------------------------------------------

    private calculateStats(features: any[]): void {
        this.roadStats = {
            total: features.length,
            yes: 0,
            no: 0,
            pending: 0,
            unknown: 0
        };

        features.forEach(feature => {
            const status = String(feature.properties?.Entrusted ?? '')
                .toLowerCase()
                .trim();

            switch (status) {
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

    // -------------------------------------------------------
    // Display GeoJSON
    // -------------------------------------------------------

    displayGeoJson(data: any): void {
        if (!this.map) {
            console.error('Map has not been initialized. Call setMap() first.');
            return;
        }

        if (!data || !Array.isArray(data.features)) {
            console.error('Invalid GeoJSON: expected a FeatureCollection with features[].');
            return;
        }

        this.clearLayer();
        this.features = data.features;

        // Build searchable text for the Leaflet search plugin.
        data.features.forEach((feature: any) => {
            feature.properties = feature.properties ?? {};
            feature.properties.searchText =
                `${feature.properties.NH_Number ?? ''} ` +
                `${feature.properties.UID ?? ''} ` +
                `${feature.properties.Chainage_P ?? ''} ` +
                `${feature.properties.Chainage_S ?? ''} ` +
                `${feature.properties.Chainage_R ?? ''}`;
        });

        // Create the road GeoJSON layer.
        this.roadLayer = L.geoJSON(data, {
            style: (feature: any) => this.getRoadStyle(feature.properties),

            onEachFeature: (feature: any, layer: any) => {
                const props = feature.properties ?? {};

                // Tooltip remains available; popup is intentionally removed.
                layer.bindTooltip(
                    `<b>UID:</b> ${this.escapeHtml(props.UID)}<br>` +
                    `<b>NH:</b> ${this.escapeHtml(props.NH_Number)}`,
                    { sticky: true }
                );

                // Hover highlight.
                layer.on('mouseover', () => {
                    if (layer instanceof L.Path) {
                        layer.setStyle({
                            weight: 7,
                            color: '#ff9800'
                        });
                    }
                });

                layer.on('mouseout', () => {
                    if (layer instanceof L.Path) {
                        layer.setStyle(this.getRoadStyle(feature.properties));
                    }
                });

                // Click a road to open the right-side details panel.
                layer.on('click', (e: L.LeafletMouseEvent) => {
                    this.openSidePanel(feature, layer, e.latlng);
                });
            }
        });

        // Add layer and refresh dashboard counts.
        this.calculateStats(data.features);
        this.roadLayer.addTo(this.map);

        // Leaflet search control.
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

        // Zoom to all road features.
        if (this.roadLayer.getLayers().length > 0) {
            this.map.fitBounds(this.roadLayer.getBounds());
        }
    }

    // -------------------------------------------------------
    // API calls
    // -------------------------------------------------------

    public getRoads(): Observable<any> {
        console.log(this.config.apiUrl);
        return this.http.get(`${this.config.apiUrl}/roads`);
    }

    public getFilters(): Observable<any> {
        return this.http.get(`${this.config.apiUrl}/filters`);
    }

    public searchRoad(search: any): Observable<any> {
        return this.http.post(`${this.config.apiUrl}/search`, search);
    }

    public updateFeature(id: number, data: any): Observable<any> {
        return this.http.post(
            `${this.config.apiUrl}/feature/${id}`,
            data
        );
    }
}
