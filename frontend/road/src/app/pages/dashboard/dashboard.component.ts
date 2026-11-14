import { Component } from '@angular/core';
import { LayerListComponent } from '../../components/layer-list/layer-list.component';
import { MapComponent } from '../../components/map/map.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    LayerListComponent,
    MapComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {

}