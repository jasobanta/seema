import { AfterViewInit, Component } from '@angular/core';
import * as L from 'leaflet';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit {

   constructor(
    private mapService: MapService
  ) { }
  ngAfterViewInit(): void {

  const map = L.map('map').setView([20.5937, 78.9629], 5);
  

  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap'
    }
  ).addTo(map);

setTimeout(() => {
    map.invalidateSize();
    this.mapService.setMap(map);

    this.mapService.getRoads().subscribe({

      next: (geojson) => {

        this.mapService.displayGeoJson(geojson);

      },

      error: (err) => {

        console.error(err);

      }

    });    
},100);
}
}