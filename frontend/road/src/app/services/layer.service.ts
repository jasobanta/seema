import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private apiUrl = 'http://127.0.0.1:8000';

  private map!: L.Map;
  private roadLayer?: L.GeoJSON;

  constructor(private http: HttpClient) { }

  //-------------------------
  // Map Methods
  //-------------------------

  setMap(map: L.Map): void {
    this.map = map;
  }

  getMap(): L.Map {
    return this.map;
  }

  clearLayer(): void {
    if (this.roadLayer) {
      this.map.removeLayer(this.roadLayer);
    }
  }

  displayGeoJson(data: any): void {

    this.clearLayer();

    this.roadLayer = L.geoJSON(data, {

      style: {
        color: '#0d6efd',
        weight: 4
      },

      onEachFeature: (feature, layer) => {

        layer.on('click', () => {

          console.log(feature.properties);

          // Popup will be added later

        });

      }

    });

    this.roadLayer.addTo(this.map);

    this.map.fitBounds(this.roadLayer.getBounds());

  }

  //-------------------------
  // API Calls
  //-------------------------

  getFilters(): Observable<any> {
    return this.http.get(`${this.apiUrl}/filters`);
  }

  searchRoad(search: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/search`, search);
  }

  updateFeature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/feature/${id}`, data);
  }

}